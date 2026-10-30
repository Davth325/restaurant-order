import { expect, test } from '@playwright/test'
import { loginUi } from './auth-helpers.js'

type Item = { id: number; name: string; priceVnd: number; imagePath: string; available: boolean }
type Snapshot = { categories: { id: number; name: string; items: Item[] }[]; total: number; observedAt: string }
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

test('reads database menu, prices, images and availability; reload and navigation work', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await request.get('/api/menu')
  expect(response.ok()).toBeTruthy()
  expect(response.headers()['cache-control']).toBe('no-store')
  const snapshot: Snapshot = await response.json()
  expect(snapshot.total).toBe(6)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Thực đơn hôm nay' })).toBeVisible()
  await expect(page.getByTestId('menu-item')).toHaveCount(snapshot.total)
  for (const category of snapshot.categories) {
    await expect(page.getByRole('heading', { name: category.name, exact: true })).toBeVisible()
    for (const item of category.items) {
      const card = page.getByTestId('menu-item').filter({ has: page.getByRole('heading', { name: item.name, exact: true }) })
      await expect(card).toContainText(money.format(item.priceVnd))
      await expect(card).toContainText(item.available ? 'Còn bán' : 'Hết món')
      await expect(card.getByRole('img')).toHaveAttribute('src', item.imagePath)
      await expect(card.getByRole('img')).toHaveJSProperty('naturalWidth', 480)
    }
  }
  const category = snapshot.categories[1]
  await page.getByRole('button', { name: category.name, exact: true }).click()
  await expect(page.getByTestId('menu-item')).toHaveCount(category.items.length)
  await page.reload()
  await expect(page.getByTestId('menu-item')).toHaveCount(snapshot.total)
  await page.getByRole('link', { name: 'Sơ đồ bàn', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await loginUi(page, 'STAFF')
  await expect(page.getByTestId('table-card')).toHaveCount(30)
  await page.getByRole('link', { name: 'Thực đơn', exact: true }).click()
  await expect(page.getByTestId('menu-item')).toHaveCount(snapshot.total)
  expect(errors).toEqual([])
})

test('shows loading and empty menu, including categories with no dishes', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/menu', async route => {
    await gate
    await route.fulfill({ json: { categories: [{ id: 1, name: 'Nhóm trống', items: [] }], total: 0, observedAt: new Date().toISOString() } })
  })
  await page.goto('/')
  await expect(page.getByText('Đang tải thực đơn…', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đang tải…' })).toBeDisabled()
  release()
  await expect(page.getByText('Thực đơn chưa có món. Vui lòng quay lại sau.')).toBeVisible()
  await expect(page.getByTestId('menu-item')).toHaveCount(0)
  await page.route('**/api/menu', route => route.fulfill({ json: { categories: [], total: 0, observedAt: new Date().toISOString() } }))
  await page.getByRole('button', { name: 'Làm mới' }).click()
  await expect(page.getByText('Thực đơn chưa có món. Vui lòng quay lại sau.')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('handles network and HTTP errors, retries and marks stale prices', async ({ page }) => {
  await page.route('**/api/menu', route => route.abort())
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Chưa kết nối được dữ liệu')
  await expect(page.getByTestId('menu-item')).toHaveCount(0)
  await page.unroute('**/api/menu')
  await page.getByRole('button', { name: 'Tải lại thực đơn' }).click()
  await expect(page.getByTestId('menu-item')).toHaveCount(6)
  await page.route('**/api/menu', route => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }))
  await page.getByRole('button', { name: 'Làm mới' }).click()
  await expect(page.getByRole('alert')).toContainText('giá và tình trạng còn bán có thể đã thay đổi')
  await expect(page.getByTestId('menu-item')).toHaveCount(6)
  await page.unroute('**/api/menu')
  await page.getByRole('button', { name: 'Tải lại thực đơn' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('rejects malformed API data and shows a fallback for failed images', async ({ page }) => {
  await page.route('**/api/menu', route => route.fulfill({ json: { categories: [{ items: null }], total: 0, observedAt: 'invalid' } }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('menu-item')).toHaveCount(0)
  await page.unroute('**/api/menu')
  await page.route('**/menu-images/**', route => route.abort())
  await page.getByRole('button', { name: 'Tải lại thực đơn' }).click()
  await expect(page.getByText('Ảnh món đang cập nhật')).toHaveCount(6)
  await expect(page.getByTestId('menu-item')).toHaveCount(6)
})

test('retries failed images when refreshing the same menu', async ({ page }) => {
  await page.route('**/menu-images/**', route => route.abort())
  await page.goto('/')
  await expect(page.getByText('Ảnh món đang cập nhật')).toHaveCount(6)
  await page.unroute('**/menu-images/**')
  await page.getByRole('button', { name: 'Làm mới' }).click()
  await expect(page.getByText('Ảnh món đang cập nhật')).toHaveCount(0)
  const images = page.getByTestId('menu-item').getByRole('img')
  await expect(images).toHaveCount(6)
  for (const image of await images.all()) await expect(image).toHaveJSProperty('naturalWidth', 480)
})

test('isolates an invalid image path without discarding the menu or fetching that path', async ({ page, request }) => {
  const snapshot: Snapshot = await (await request.get('/api/menu')).json()
  const item = snapshot.categories[0].items[0]
  item.imagePath = '/menu-images/../outside-menu.svg'
  let unsafeRequests = 0
  await page.route('**/outside-menu.svg', route => { unsafeRequests++; return route.abort() })
  await page.route('**/api/menu', route => route.fulfill({ json: snapshot }))
  await page.goto('/')
  await expect(page.getByTestId('menu-item')).toHaveCount(snapshot.total)
  await expect(page.getByRole('img', { name: `Chưa có ảnh ${item.name}`, exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(unsafeRequests).toBe(0)
})

test('keeps stale-menu warning during retry until a fresh snapshot succeeds', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('menu-item')).toHaveCount(6)
  await page.route('**/api/menu', route => route.abort())
  await page.getByRole('button', { name: 'Làm mới' }).click()
  await expect(page.getByRole('alert')).toContainText('giá và tình trạng còn bán có thể đã thay đổi')
  await page.unroute('**/api/menu')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/menu', async route => { await gate; await route.continue() })
  await page.getByRole('button', { name: 'Tải lại thực đơn' }).click()
  await expect(page.getByText('Đang cập nhật thực đơn…', { exact: true })).toBeVisible()
  try {
    await expect(page.getByRole('alert')).toContainText('giá và tình trạng còn bán có thể đã thay đổi')
  } finally {
    release()
  }
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByTestId('menu-item')).toHaveCount(6)
})

for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
  test(`menu fits ${viewport.width} × ${viewport.height} with touch controls`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByTestId('menu-item')).toHaveCount(6)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    const filter = page.getByRole('button', { name: 'Món chính', exact: true })
    expect((await filter.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await filter.click()
    await expect(page.getByTestId('menu-item')).toHaveCount(2)
  })
}
