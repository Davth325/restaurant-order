import { expect, test, type Page } from '@playwright/test'
import { loginApi } from './auth-helpers.js'

// UI states use simulated guest responses, real menu/CSRF. Real authorization, locking and
// snapshots are tested with PostgreSQL; Verify-GuestOrdering.ps1 runs the complete live flow.
const session = { id: 6401, tableCode: 'B01', tableName: 'Bàn 01', status: 'OPEN' }
const emptyBatch = { id: 641, requestKey: '', totalVnd: 90000, createdAt: '2026-10-31T02:00:00Z', items: [{ id: 1, name: 'Gỏi cuốn tôm', quantity: 2, unitPriceVnd: 45000, note: 'Ít cay', status: 'QUEUED' }] }
function receipt(body: { requestKey: string; items: { menuItemId: number; quantity: number; expectedPriceVnd: number; note: string }[] }) {
  return { ...emptyBatch, requestKey: body.requestKey, totalVnd: body.items.reduce((sum, line) => sum + line.quantity * line.expectedPriceVnd, 0), items: body.items.map((line, index) => ({ ...emptyBatch.items[0], id: index + 1, menuItemId: line.menuItemId, quantity: line.quantity, unitPriceVnd: line.expectedPriceVnd, note: line.note })) }
}
async function setup(page: Page) {
  await page.route('**/api/guest/sessions/*/cancellations', route => route.fulfill({ json: [] }))
  await page.route('**/api/guest/session', route => route.fulfill({ json: session }))
  await page.route('**/api/guest/sessions/*/orders', route => route.fulfill({ json: [] }))
  await page.goto('/#guest')
  await expect(page.getByRole('heading', { name: 'Giỏ món của bàn' })).toBeVisible()
  await page.getByRole('button', { name: 'Thêm Gỏi cuốn tôm', exact: true }).click()
}
test('cart reviews quantity and notes, prevents double submit and shows server batch', async ({ page }) => {
  await setup(page)
  await page.getByLabel('Số lượng Gỏi cuốn tôm').fill('2')
  await page.getByLabel('Ghi chú Gỏi cuốn tôm').fill('Ít cay')
  let posts = 0
  await page.route('**/api/guest/sessions/*/orders', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] })
    posts++
    const body = route.request().postDataJSON()
    expect(body.items[0]).toMatchObject({ quantity: 2, note: 'Ít cay', expectedPriceVnd: 45000, optionIds: [] })
    await new Promise(resolve => setTimeout(resolve, 250))
    return route.fulfill({ json: receipt(body) })
  })
  await expect(page.getByRole('button', { name: 'Xác nhận gửi món' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem lại đợt gọi' }).click()
  await expect(page.getByLabel('Số lượng Gỏi cuốn tôm')).toBeDisabled()
  const send = page.getByRole('button', { name: 'Xác nhận gửi món' })
  await send.dblclick()
  await expect(page.getByRole('region', { name: 'Món đã gọi' })).toContainText('Đợt #641')
  expect(posts).toBe(1)
  await expect(page.getByRole('region', { name: 'Giỏ món' })).toContainText('Chọn món từ thực đơn')
})
test('lost response after save is reconciled by key without a second POST', async ({ page }) => {
  await setup(page)
  let key = '', posts = 0, checks = 0
  let saved: Parameters<typeof receipt>[0]
  await page.route('**/api/guest/sessions/*/orders', route => {
    if (route.request().method() === 'POST') { posts++; saved = route.request().postDataJSON(); key = saved.requestKey; return route.abort() }
    return route.fulfill({ json: [] })
  })
  await page.route('**/orders/by-key/*', route => {
    checks++; expect(route.request().url()).toContain(key)
    return route.fulfill({ json: receipt(saved) })
  })
  await page.getByRole('button', { name: 'Xem lại đợt gọi' }).click()
  await page.getByRole('button', { name: 'Xác nhận gửi món' }).click()
  await expect(page.getByRole('region', { name: 'Món đã gọi' })).toContainText('Đợt #641')
  expect(posts).toBe(1); expect(checks).toBe(1)
})
test('uncertain attempt survives reload and retries with identical key and payload after checking', async ({ page }) => {
  await setup(page)
  let recovered = false
  const requests: unknown[] = []
  await page.route('**/api/guest/sessions/*/orders', route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] })
    const body = route.request().postDataJSON(); requests.push(body)
    return recovered ? route.fulfill({ json: receipt(body) }) : route.abort()
  })
  await page.route('**/orders/by-key/*', route => recovered ? route.fulfill({ status: 404, json: {} }) : route.abort())
  await page.getByRole('button', { name: 'Xem lại đợt gọi' }).click()
  await page.getByRole('button', { name: 'Xác nhận gửi món' }).click()
  await expect(page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' })).toBeEnabled()
  await expect(page.getByLabel('Số lượng Gỏi cuốn tôm')).toBeDisabled()
  recovered = true
  await page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' }).click()
  await expect(page.getByRole('region', { name: 'Món đã gọi' })).toContainText('Đợt #641')
  expect(requests).toHaveLength(2); expect(requests[0]).toEqual(requests[1])
})
test('price change and sold out reject the whole batch and require a new review', async ({ page }) => {
  await setup(page)
  let posts = 0
  await page.route('**/api/guest/sessions/*/orders', route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] })
    posts++
    return route.fulfill({ status: 409, json: { code: posts === 1 ? 'PRICE_CHANGED' : 'ITEM_UNAVAILABLE', detail: posts === 1 ? 'Giá đã đổi thành 50000 ₫. Đợt gọi chưa được gửi.' : 'Gỏi cuốn tôm đã hết món. Đợt gọi chưa được gửi.' } })
  })
  for (const message of ['Giá đã đổi', 'đã hết món']) {
    await page.getByRole('button', { name: 'Xem lại đợt gọi' }).click()
    await page.getByRole('button', { name: 'Xác nhận gửi món' }).click()
    await expect(page.getByRole('status').filter({ hasText: message })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Giỏ món của bàn' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Xác nhận gửi món' })).toHaveCount(0)
  }
  expect(posts).toBe(2)
})
test('invalid device clears private data and staff browser cannot be handed to a guest', async ({ page, context }) => {
  await setup(page)
  await page.route('**/api/guest/sessions/*/orders', route => route.fulfill({ status: 403, json: { code: 'SESSION_INACTIVE' } }))
  await page.getByRole('button', { name: 'Tải lại món đã gọi' }).click()
  await expect(page.getByRole('heading', { name: 'Gắn tablet vào bàn' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Giỏ món' })).toHaveCount(0)
  await loginApi(context.request)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Cần trình duyệt riêng cho khách' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gắn tablet', exact: true })).toHaveCount(0)
})
test('guest cart has usable touch targets and no overflow in tablet and phone sizes', async ({ page }) => {
  await setup(page)
  await page.getByLabel('Ghi chú Gỏi cuốn tôm').fill('x'.repeat(300))
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const button of await page.getByRole('region', { name: 'Giỏ món' }).getByRole('button').all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
  }
})

test('CSRF rejection keeps the pending attempt and retries with the same key', async ({ page }) => {
  await setup(page)
  const bodies: unknown[] = []
  await page.route('**/api/guest/sessions/*/orders', route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] })
    const body = route.request().postDataJSON(); bodies.push(body)
    return bodies.length === 1
      ? route.fulfill({ status: 403, json: { message: 'Kiểm tra CSRF rồi thử lại.' } })
      : route.fulfill({ json: receipt(body) })
  })
  await page.route('**/orders/by-key/*', route => route.fulfill({ status: 404, json: {} }))
  await page.getByRole('button', { name: 'Xem lại đợt gọi' }).click()
  await page.getByRole('button', { name: 'Xác nhận gửi món' }).click()
  await expect(page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' })).toBeEnabled()
  await expect(page.getByRole('heading', { name: 'Gắn tablet vào bàn' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' }).click()
  await expect(page.getByRole('region', { name: 'Món đã gọi' })).toContainText('Đợt #641')
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0])
})

test('lookup with same key but different content keeps pending and never accepts the other batch', async ({ page }) => {
  await setup(page)
  let saved: Parameters<typeof receipt>[0], posts = 0
  await page.route('**/api/guest/sessions/*/orders', route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] })
    saved = route.request().postDataJSON(); posts++; return route.abort()
  })
  await page.route('**/orders/by-key/*', route => route.fulfill({ json: receipt({ ...saved, items: saved.items.map(line => ({ ...line, quantity: line.quantity + 1 })) }) }))
  await page.getByRole('button', { name: 'Xem lại đợt gọi' }).click()
  await page.getByRole('button', { name: 'Xác nhận gửi món' }).click()
  await expect(page.getByText('Biên nhận khác nội dung đang chờ. Giữ nguyên lượt gửi và nhờ nhân viên kiểm tra.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Món đã gọi' }).getByRole('article')).toHaveCount(0)
  await page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' }).click()
  expect(posts).toBe(1)
})
