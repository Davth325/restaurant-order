import { expect, test } from '@playwright/test'
import { loginApi } from './auth-helpers.js'

function snapshot() {
  return { observedAt: new Date().toISOString(), units: [1, 2, 3].map(number => ({ id: number, itemId: 10, number, status: number === 1 ? 'READY' : 'QUEUED', batchId: 12, batchNumber: 2, sessionId: 4, tableCode: 'B02', createdAt: new Date(Date.now() - 1200000).toISOString(), name: 'Gỏi cuốn tôm', quantity: 3, note: 'Không ớt\nĐể sốt riêng ' + 'rất dài '.repeat(20) })) }
}

test('kitchen partial portions, long notes, wait age and touch controls fit tablet and phone', async ({ page }) => {
  await loginApi(page.request, 'KITCHEN')
  await page.route('**/api/kitchen/events', route => route.abort())
  await page.route('**/api/kitchen/orders', route => route.fulfill({ json: snapshot() }))
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/#kitchen')
    const batch = page.getByRole('article', { name: 'B02 đợt 2' })
    await expect(batch).toContainText('1/3 đã xong · 2 chờ làm · 0 đang làm')
    await expect(batch).toContainText('Chờ lâu')
    await expect(batch).toContainText('Không ớt')
    await expect(batch.getByRole('button')).toHaveCount(2)
    const sizes = await batch.getByRole('button').evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().height))
    expect(sizes.every(height => height >= 44)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('failed snapshot retains stale warning and locks portions until successful retry', async ({ page }) => {
  await loginApi(page.request, 'KITCHEN')
  await page.route('**/api/kitchen/events', route => route.abort())
  let fail = false
  await page.route('**/api/kitchen/orders', route => fail ? route.abort() : route.fulfill({ json: snapshot() }))
  await page.goto('/#kitchen')
  await expect(page.getByRole('button', { name: 'Bắt đầu suất 2 Gỏi cuốn tôm' })).toBeEnabled()
  fail = true
  await page.getByRole('button', { name: 'Tải lại hàng đợi' }).click()
  await expect(page.getByRole('alert')).toContainText('Dữ liệu có thể đã cũ')
  await expect(page.getByRole('button', { name: 'Bắt đầu suất 2 Gỏi cuốn tôm' })).toBeDisabled()
  fail = false
  await page.getByRole('button', { name: 'Tải lại hàng đợi' }).click()
  await expect(page.getByRole('button', { name: 'Bắt đầu suất 2 Gỏi cuốn tôm' })).toBeEnabled()
  await expect(page.getByRole('status')).toContainText('Mất kết nối cập nhật trực tiếp')
})

test('state conflict refetches authoritative portions and expired kitchen session hides data', async ({ page }) => {
  await loginApi(page.request, 'KITCHEN')
  await page.route('**/api/kitchen/events', route => route.abort())
  const data = snapshot()
  let expired = false
  await page.route('**/api/kitchen/orders', route => expired ? route.fulfill({ status: 401, json: {} }) : route.fulfill({ json: data }))
  await page.route('**/api/kitchen/units/2/status', async route => {
    data.units[1].status = 'READY'
    await route.fulfill({ status: 409, json: { code: 'UNIT_STATE_CONFLICT', detail: 'Suất món đã đổi trạng thái.' } })
  })
  await page.goto('/#kitchen')
  await page.getByRole('button', { name: 'Bắt đầu suất 2 Gỏi cuốn tôm' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Suất món đã đổi trạng thái' })).toBeVisible()
  await expect(page.getByRole('article')).toContainText('2/3 đã xong · 1 chờ làm')
  expired = true
  await page.getByRole('button', { name: 'Tải lại hàng đợi' }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(0)
})

test('only a fully completed batch moves out of the queue and remains available after reload', async ({ page }) => {
  await loginApi(page.request, 'KITCHEN')
  await page.route('**/api/kitchen/events', route => route.abort())
  const data = snapshot()
  data.units[0].status = 'READY'
  data.units[1].status = 'READY'
  data.units[0].quantity = data.units[1].quantity = 2
  Object.assign(data.units[2], { itemId: 11, number: 1, quantity: 1, name: 'Cơm gà nướng', status: 'PREPARING' })
  data.units.push({ ...data.units[0], id: 4, itemId: 20, batchId: 13, batchNumber: 3, number: 1, quantity: 1, status: 'QUEUED' })
  await page.route('**/api/kitchen/orders', route => route.fulfill({ json: data }))
  let posts = 0
  await page.route('**/api/kitchen/units/3/status', async route => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({ status: 'READY' })
    posts++
    data.units[2].status = 'READY'
    await route.fulfill({ status: 204 })
  })
  await page.goto('/#kitchen')
  const completed = page.getByRole('article', { name: 'B02 đợt 2', exact: true })
  const next = page.getByRole('article', { name: 'B02 đợt 3', exact: true })
  await expect(completed).toBeVisible() // One dish finished; another dish in this batch is still preparing.
  await expect(next).toBeVisible()
  await completed.getByRole('button', { name: 'Hoàn thành suất 1 Cơm gà nướng' }).click()
  await expect(completed).toHaveCount(0)
  await expect(next).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đang xử lý (1 đợt)', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Đã xong · chờ mang (1 đợt)', exact: true }).click()
  await expect(completed).toContainText('2/2 đã xong')
  await expect(completed).toContainText('1/1 đã xong')
  await expect(next).toHaveCount(0)
  await page.reload()
  await expect(completed).toHaveCount(0)
  await expect(next).toBeVisible()
  await page.getByRole('button', { name: 'Đã xong · chờ mang (1 đợt)', exact: true }).click()
  await expect(completed).toBeVisible()
  expect(posts).toBe(1)
  expect(data.units).toHaveLength(4)
})
