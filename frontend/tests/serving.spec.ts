import { expect, test } from '@playwright/test'
import { loginApi } from './auth-helpers.js'

const snapshot = () => ({ observedAt: new Date().toISOString(), units: [1, 2, 3].map(n => ({ id: n, itemId: 10, number: n, status: 'READY', version: 2, batchId: 11, batchNumber: 1, sessionId: 5, tableCode: 'B01', name: 'Gỏi cuốn tôm', quantity: 3, note: 'Không ớt · Để sốt riêng', readyAt: new Date(Date.now() - 180000).toISOString(), pickedUpBy: null, pickedUpName: null, pickedUpAt: null, servedAt: null as string | null })) })
test('serving shows portions and wait time on portrait landscape and phone without overflow', async ({ page }) => {
  await loginApi(page.request)
  const data = snapshot() // Keep readyAt stable across snapshot reads and viewport reloads.
  await page.route('**/api/serving/events', r => r.abort())
  await page.route('**/api/serving/orders', r => r.fulfill({ json: data }))
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport); await page.goto('/#serving')
    const card = page.getByRole('article', { name: 'B01 đợt 1 Gỏi cuốn tôm' })
    await expect(card).toContainText('3/3 suất chờ mang')
    await expect(card).toContainText('Chờ từ bếp xong: 3 phút')
    await expect(card.getByRole('button', { name: /Nhận mang suất/ })).toHaveCount(3)
    expect(await card.getByRole('button').evaluateAll(buttons => buttons.every(b => b.getBoundingClientRect().height >= 44))).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
test('conflict refetches owner and stale snapshots lock actions until recovery and expiry hides data', async ({ page }) => {
  await loginApi(page.request)
  const data = snapshot(); let failure = false, expired = false
  await page.route('**/api/serving/events', r => r.abort())
  await page.route('**/api/serving/orders', r => expired ? r.fulfill({ status: 401 }) : failure ? r.abort() : r.fulfill({ json: data }))
  await page.route('**/api/serving/units/1/actions', async r => {
    Object.assign(data.units[0], { status: 'PICKED_UP', version: 3, pickedUpBy: 'nhanvien2', pickedUpName: 'Nhân viên 2', pickedUpAt: new Date().toISOString() })
    await r.fulfill({ status: 409, json: { code: 'UNIT_STATE_CONFLICT', detail: 'Suất đã có người nhận.' } })
  })
  await page.goto('/#serving'); await page.getByRole('button', { name: 'Nhận mang suất 1', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Suất đã có người nhận' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chờ mang (2 suất)', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Đang mang (0 suất)' }).click()
  await expect(page.getByText('Bạn chưa có suất đang mang.', { exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Đã giao suất/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Chờ mang (2 suất)' }).click()
  failure = true; await page.getByRole('button', { name: 'Tải lại món phục vụ' }).click()
  await expect(page.getByRole('button', { name: 'Nhận mang suất 2' })).toBeDisabled()
  failure = false; await page.getByRole('button', { name: 'Tải lại món phục vụ' }).click()
  await expect(page.getByRole('button', { name: 'Nhận mang suất 2' })).toBeEnabled()
  expired = true; await page.getByRole('button', { name: 'Tải lại món phục vụ' }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(0)
})

for (const [role, visibleNumbers] of [['STAFF', [1, 3]], ['STAFF2', [2]], ['MANAGER', [1, 2, 3]]] as const) {
  test(`${role} sees the correct personal or manager pickup queue and count after reload`, async ({ page }) => {
    await loginApi(page.request, role)
    const data = snapshot()
    for (const unit of data.units) Object.assign(unit, { status: 'PICKED_UP', version: 3, pickedUpBy: unit.number === 2 ? 'nhanvien2' : 'nhanvien', pickedUpName: unit.number === 2 ? 'Nhân viên 2' : 'Nhân viên demo', pickedUpAt: new Date().toISOString() })
    data.units.push({ ...data.units[0], id: 4, number: 4, status: 'SERVED', servedAt: new Date().toISOString() })
    await page.route('**/api/serving/events', r => r.abort())
    await page.route('**/api/serving/orders', r => r.fulfill({ json: data }))
    await page.goto('/#serving')
    for (let reload = 0; reload < 2; reload++) {
      if (reload) await page.reload()
      await page.getByRole('button', { name: `Đang mang (${visibleNumbers.length} suất)`, exact: true }).click()
      for (const number of [1, 2, 3]) {
        const visible = (visibleNumbers as readonly number[]).includes(number)
        await expect(page.getByRole('region', { name: `Suất ${number} Gỏi cuốn tôm`, exact: true })).toHaveCount(visible ? 1 : 0)
      }
      await expect(page.getByRole('button', { name: /Đã giao suất/ })).toHaveCount(role === 'MANAGER' ? 0 : visibleNumbers.length)
      await expect(page.getByRole('button', { name: /Trả lại suất/ })).toHaveCount(visibleNumbers.length)
      await expect(page.getByRole('button', { name: /Đã phục vụ/ })).toHaveCount(role === 'MANAGER' ? 1 : 0)
      await expect(page.getByRole('button', { name: /Lịch sử suất/ })).toHaveCount(role === 'MANAGER' ? visibleNumbers.length : 0)
    }
    if (role === 'MANAGER') {
      await page.getByRole('button', { name: 'Đã phục vụ (1 suất)', exact: true }).click()
      await expect(page.getByRole('region', { name: 'Suất 4 Gỏi cuốn tôm', exact: true })).toBeVisible()
    }
  })
}
test('uncertain pickup survives reload and lookup precedes retry with identical key version and portion', async ({ page }) => {
  await loginApi(page.request)
  const data = snapshot(); const posted: unknown[] = []
  await page.route('**/api/serving/events', r => r.abort())
  await page.route('**/api/serving/orders', r => r.fulfill({ json: data }))
  await page.route('**/api/serving/operations/*', r => r.fulfill({ status: 404, json: {} }))
  await page.route('**/api/serving/units/1/actions', async r => {
    posted.push(r.request().postDataJSON())
    if (posted.length === 1) await r.abort()
    else {
      Object.assign(data.units[0], { status: 'PICKED_UP', version: 3, pickedUpBy: 'nhanvien', pickedUpName: 'Nhân viên demo', pickedUpAt: new Date().toISOString() })
      await r.fulfill({ status: 204 })
    }
  })
  await page.goto('/#serving'); await page.getByRole('button', { name: 'Nhận mang suất 1', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Thao tác chưa rõ kết quả' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nhận mang suất 2' })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa thấy thao tác được lưu' })).toBeVisible()
  expect(posted).toHaveLength(1)
  await page.getByRole('button', { name: 'Kiểm tra và thử lại', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Thao tác chưa rõ kết quả' })).toHaveCount(0)
  expect(posted).toHaveLength(2); expect(posted[0]).toEqual(posted[1])
  await expect(page.getByRole('button', { name: 'Chờ mang (2 suất)' })).toBeVisible()
})
test('manager sees all ownership and returns with required reason but cannot receive or mark served', async ({ page }) => {
  await loginApi(page.request, 'MANAGER')
  const data = snapshot()
  Object.assign(data.units[0], { status: 'PICKED_UP', version: 3, pickedUpBy: 'nhanvien', pickedUpName: 'Nhân viên demo', pickedUpAt: new Date().toISOString() })
  await page.route('**/api/serving/events', r => r.abort())
  await page.route('**/api/serving/orders', r => r.fulfill({ json: data }))
  let posted: unknown
  await page.route('**/api/serving/units/1/actions', async r => {
    posted = r.request().postDataJSON()
    Object.assign(data.units[0], { status: 'READY', version: 4, pickedUpBy: null, pickedUpName: null, pickedUpAt: null })
    await r.fulfill({ status: 204 })
  })
  await page.goto('/#serving')
  await expect(page.getByRole('heading', { name: 'Giám sát phục vụ' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Nhận mang suất/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Đang mang (1 suất)' }).click()
  await expect(page.getByRole('button', { name: /Đã giao suất/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Trả lại suất 1' }).click()
  await expect(page.getByRole('button', { name: 'Xác nhận trả lại', exact: true })).toBeDisabled()
  await page.getByLabel('Lý do trả lại').fill('Nhận nhầm bàn')
  await page.getByRole('button', { name: 'Xác nhận trả lại', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Chờ mang (3 suất)' })).toBeVisible()
  expect(posted).toMatchObject({ action: 'RETURN', version: 3, reason: 'Nhận nhầm bàn' })
})
test('kitchen treats picked up and served as finished and never offers kitchen actions on them', async ({ page }) => {
  await loginApi(page.request, 'KITCHEN')
  const data = snapshot().units.map(u => ({ ...u, createdAt: u.readyAt, status: u.number === 1 ? 'SERVED' : 'PICKED_UP' }))
  await page.route('**/api/kitchen/events', r => r.abort())
  await page.route('**/api/kitchen/orders', r => r.fulfill({ json: { units: data, observedAt: new Date().toISOString() } }))
  await page.goto('/#kitchen')
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.getByRole('button', { name: 'Đã xong · chờ mang (1 đợt)' }).click()
  await expect(page.getByRole('article')).toContainText('Đã phục vụ')
  await expect(page.getByRole('article').getByRole('button')).toHaveCount(0)
})
