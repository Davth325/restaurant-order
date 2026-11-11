import { expect, test, type Page } from '@playwright/test'
import { loginApi } from './auth-helpers.js'

const unit = { id: 6701, version: 0, status: 'QUEUED', excluded: false, sessionId: 671, tableCode: 'B01', batchId: 6711, name: 'Gỏi cuốn tôm', number: 1, priceVnd: 45000 }

async function guestSession(page: Page) {
  await page.route('**/api/guest/session', r => r.fulfill({ json: { id: 671, tableCode: 'B01', tableName: 'Bàn 01', status: 'OPEN' } }))
  await page.route('**/api/guest/sessions/671/orders', r => r.fulfill({ json: [] }))
}

test('guest cancels without a reason and reload recovers a committed cancellation without posting twice', async ({ page }) => {
  let saved: Record<string, unknown> | undefined
  let posts = 0
  await guestSession(page)
  await page.route('**/api/guest/sessions/671/cancellations', r => r.fulfill({ json: [
    saved ? { ...unit, status: 'CANCELLED', excluded: true } : unit,
  ] }))
  await page.route('**/cancellations/cancel', r => {
    saved = r.request().postDataJSON()
    expect(saved).toEqual({ requestKey: expect.any(String), unitId: unit.id })
    posts++
    return r.abort()
  })
  await page.route('**/cancellations/cancel/by-key/*', r => r.fulfill({ json: saved }))
  await page.goto('/#guest')
  await page.getByRole('button', { name: 'Hủy suất 1 Gỏi cuốn tôm', exact: true }).click()
  await expect(page.getByLabel('Lý do', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Xác nhận hủy suất 1', exact: true }).dblclick()
  await expect.poll(() => posts).toBe(1)
  await expect(page.getByText(/Chưa xác định kết quả\. Giữ lượt gửi/)).toBeVisible()
  await page.reload()
  await expect(page.getByText('Đã hủy suất.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kiểm tra và thử lại', exact: true })).toHaveCount(0)
  expect(posts).toBe(1)
  await expect(page.getByRole('region', { name: 'Hủy món' })).toContainText('Đã hủy · Đã loại khỏi tạm tính')
})

test('guest sees a conflict and loses the cancel button when the kitchen starts first', async ({ page }) => {
  await guestSession(page)
  let current = { ...unit }
  await page.route('**/api/guest/sessions/671/cancellations', r => r.fulfill({ json: [current] }))
  await page.route('**/cancellations/cancel', r => {
    current = { ...current, version: 1, status: 'PREPARING' }
    return r.fulfill({ status: 409, json: { code: 'UNIT_STATE_CONFLICT', detail: 'Bếp đã bắt đầu làm suất này.' } })
  })
  await page.goto('/#guest')
  await page.getByRole('button', { name: 'Hủy suất 1 Gỏi cuốn tôm', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận hủy suất 1', exact: true }).click()
  await expect(page.getByText('Bếp đã bắt đầu làm suất này.', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Hủy món' })).toContainText('Đang làm')
  await expect(page.getByRole('button', { name: /Hủy suất|Xác nhận hủy/ })).toHaveCount(0)
})

for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
  test(`manager excludes served with reason, history and responsive controls ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await loginApi(page.request, 'MANAGER')
    let current = { ...unit, status: 'SERVED', version: 4, excluded: false }
    await page.route('**/api/cancellations/units', r => r.fulfill({ json: [current] }))
    await page.route('**/api/cancellations/actions', r => {
      expect(r.request().postDataJSON()).toMatchObject({ unitId: unit.id, version: 4, action: 'EXCLUDE', reason: 'Món lỗi đã xác nhận', cancellationKey: null })
      current = { ...current, excluded: true, version: 5 }; return r.fulfill({ status: 200 })
    })
    await page.route('**/api/cancellations/units/*/history', r => r.fulfill({ json: [{ requestKey: 'history', unitId: unit.id, actor: 'quanly', action: 'EXCLUDE', fromStatus: 'SERVED', toStatus: 'SERVED', reason: 'Món lỗi đã xác nhận', occurredAt: '2026-11-03T01:00:00Z' }] }))
    await page.goto('/#cancellations')
    const panel = page.getByRole('region', { name: 'Hủy món' })
    await expect(panel).toContainText('Đã phục vụ')
    await page.getByRole('button', { name: 'Loại khỏi tạm tính suất 1 Gỏi cuốn tôm' }).click()
    await expect(page.getByRole('button', { name: 'Xác nhận xử lý' })).toBeDisabled()
    await page.getByLabel('Lý do', { exact: true }).fill('Món lỗi đã xác nhận')
    await page.getByRole('button', { name: 'Xác nhận xử lý' }).click()
    await expect(panel).toContainText('Đã phục vụ · Đã loại khỏi tạm tính')
    await page.getByRole('button', { name: 'Lịch sử hủy suất 1 Gỏi cuốn tôm' }).click()
    await expect(panel).toContainText('quanly · Loại khỏi tạm tính · Đã phục vụ → Đã phục vụ · Món lỗi đã xác nhận')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    expect(await panel.locator('button').evaluateAll(buttons => buttons.every(b => b.getBoundingClientRect().height >= 44))).toBeTruthy()
  })
}

test('expired internal authority removes cancellation data and history before requiring login', async ({ page }) => {
  await loginApi(page.request, 'MANAGER')
  let allowed = true
  await page.route('**/api/cancellations/units', r => allowed ? r.fulfill({ json: [unit] }) : r.fulfill({ status: 401, json: {} }))
  await page.route('**/api/cancellations/units/*/history', r => r.fulfill({ json: [{ requestKey: 'history', unitId: unit.id, actor: 'quanly', action: 'REJECT', fromStatus: 'QUEUED', toStatus: 'QUEUED', reason: 'Lý do nội bộ', occurredAt: '2026-11-03T01:00:00Z' }] }))
  await page.goto('/#cancellations')
  await page.getByRole('button', { name: 'Lịch sử hủy suất 1 Gỏi cuốn tôm' }).click()
  await expect(page.getByText(/Lý do nội bộ/)).toBeVisible()
  allowed = false
  await page.getByRole('button', { name: 'Tải lại trạng thái món' }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await expect(page.getByText(/Lý do nội bộ/)).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Hủy món' })).toHaveCount(0)
})
