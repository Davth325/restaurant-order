import { expect, test } from '@playwright/test'
import { loginApi } from './auth-helpers.js'

// UI failure/conflict simulations. Transaction/concurrency/permissions use real PostgreSQL
// and independent authenticated HTTP sessions in TableSessionIntegrationTests.
test.beforeEach(async ({ context, page }) => {
  await loginApi(context.request)
  const source = await (await context.request.get('/api/tables')).json()
  const tables = source.tables.map((table: Record<string, unknown>) => ({ ...table, status: 'AVAILABLE', currentSession: null }))
  await page.route('**/api/tables', route => route.fulfill({ json: { ...source, tables } }))
  await page.route('**/api/tables/*', route => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1))
    const table = tables.find((item: { id: number }) => item.id === id)
    return route.fulfill({ status: table ? 200 : 404, json: table ?? {} })
  })
})

const session = {
  id: 631, status: 'OPEN', openedAt: '2026-10-31T01:00:00Z',
  openedBy: { id: 1, username: 'nhanvien', displayName: 'Nhân viên demo' },
}

test('confirms B01, shows saved actor and time, leaves B02 unchanged and reloads', async ({ page }) => {
  const snapshot = await (await page.request.get('/api/tables')).json()
  const b01 = { ...snapshot.tables.find((table: { code: string }) => table.code === 'B01'), status: 'OCCUPIED', currentSession: session }
  let opened = false
  await page.route('**/api/tables', route => route.fulfill({ json: {
    ...snapshot, tables: snapshot.tables.map((table: { code: string }) => table.code === 'B01'
      ? (opened ? b01 : { ...table, status: 'AVAILABLE', currentSession: null }) : { ...table, status: 'AVAILABLE', currentSession: null }),
  } }))
  await page.route(`**/api/tables/${b01.id}`, route => route.fulfill({ json: opened ? b01 : { ...b01, status: 'AVAILABLE', currentSession: null } }))
  let posts = 0
  await page.route('**/api/tables/*/sessions', async route => {
    posts++
    opened = true
    await route.fulfill({ status: 201, json: b01 })
  })
  await page.goto('/#tables')
  await page.getByRole('button', { name: 'Mở bàn B01', exact: true }).click()
  const detail = page.getByRole('region', { name: 'Chi tiết B01' })
  await expect(detail.getByRole('button', { name: 'Mở phiên B01' })).toBeEnabled()
  expect(posts).toBe(0)
  await detail.getByRole('button', { name: 'Mở phiên B01' }).click()
  await expect(detail).toContainText('Đã mở phiên phục vụ cho B01')
  await expect(detail).toContainText('Nhân viên demo (nhanvien)')
  await expect(detail).toContainText('#631')
  await expect(detail.getByRole('button', { name: 'Mở phiên B01' })).toHaveCount(0)
  await expect(page.getByTestId('table-card').filter({ hasText: 'B02' })).toContainText('Bàn trống')
  expect(posts).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'Xem bàn B01', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Chi tiết B01' })).toContainText('#631')
})

test('shows conflict and reads the session opened by another employee', async ({ page }) => {
  let opened = false
  const snapshot = await (await page.request.get('/api/tables')).json()
  const b01 = snapshot.tables.find((table: { code: string }) => table.code === 'B01')
  await page.route(`**/api/tables/${b01.id}`, route => route.fulfill({ json: {
    ...b01, status: opened ? 'OCCUPIED' : 'AVAILABLE', currentSession: opened ? session : null,
  } }))
  await page.route('**/api/tables/*/sessions', route => {
    opened = true
    return route.fulfill({ status: 409, json: { code: 'TABLE_NOT_AVAILABLE' } })
  })
  await page.goto('/#tables')
  await page.getByRole('button', { name: 'Mở bàn B01', exact: true }).click()
  const detail = page.getByRole('region', { name: 'Chi tiết B01' })
  await detail.getByRole('button', { name: 'Mở phiên B01' }).click()
  await expect(detail).toContainText('không thể mở thêm phiên')
  await expect(detail).toContainText('#631')
})

test('lost response blocks retries until a successful state check and never reposts automatically', async ({ page }) => {
  let posts = 0
  await page.route('**/api/tables/*/sessions', route => { posts++; return route.abort() })
  await page.goto('/#tables')
  await page.getByRole('button', { name: 'Mở bàn B01', exact: true }).click()
  const detail = page.getByRole('region', { name: 'Chi tiết B01' })
  await detail.getByRole('button', { name: 'Mở phiên B01' }).click()
  await expect(detail).toContainText('Chưa xác định kết quả mở B01')
  await expect(detail.getByRole('button', { name: 'Mở phiên B01' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Mở bàn B02', exact: true })).toBeDisabled()
  await page.route('**/api/tables/*', route => route.abort())
  await detail.getByRole('button', { name: 'Kiểm tra trạng thái B01' }).click()
  await expect(detail.getByRole('alert')).toContainText('Chưa đọc được trạng thái mới nhất')
  await expect(detail.getByRole('button', { name: 'Mở phiên B01' })).toBeDisabled()
  expect(posts).toBe(1)
  const source = await (await page.request.get('/api/tables')).json()
  const b01 = source.tables.find((table: { code: string }) => table.code === 'B01')
  const saved = { ...b01, status: 'OCCUPIED', currentSession: session }
  await page.route('**/api/tables/*', route => route.fulfill({ json: saved }))
  await page.route('**/api/tables', route => route.fulfill({ json: {
    ...source, tables: source.tables.map((table: { id: number }) => table.id === b01.id ? saved : table),
  } }))
  await detail.getByRole('button', { name: 'Kiểm tra trạng thái B01' }).click()
  await expect(detail).toContainText('bàn đã có phiên phục vụ. Không gửi lại yêu cầu mở.')
  await expect(detail).toContainText('#631')
  await expect(detail.getByRole('button', { name: 'Mở phiên B01' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mở bàn B02', exact: true })).toBeEnabled()
  expect(posts).toBe(1)
})

test('keeps stale snapshot warning during refresh and blocks opening until fresh data', async ({ page }) => {
  await page.goto('/#tables')
  await page.getByRole('button', { name: 'Mở bàn B01', exact: true }).click()
  const detail = page.getByRole('region', { name: 'Chi tiết B01' })
  await expect(detail.getByRole('button', { name: 'Mở phiên B01' })).toBeEnabled()
  await page.route('**/api/tables', route => route.abort())
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Dữ liệu bên dưới là lần đọc thành công trước')
  await expect(detail.getByRole('button', { name: 'Mở phiên B01' })).toBeDisabled()
  let release: (() => void) | undefined
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/tables', async route => { await pending; await route.abort() })
  await page.getByRole('button', { name: 'Tải lại dữ liệu' }).click()
  await expect(page.getByRole('alert')).toContainText('Dữ liệu bên dưới là lần đọc thành công trước')
  release?.()
})

test('opening in progress prevents duplicate clicks and expired session returns to login', async ({ page }) => {
  let release: (() => void) | undefined
  const pending = new Promise<void>(resolve => { release = resolve })
  let posts = 0
  await page.route('**/api/tables/*/sessions', async route => {
    posts++
    await pending
    await route.fulfill({ status: 401, json: { message: 'Expired' } })
  })
  await page.goto('/#tables')
  await page.getByRole('button', { name: 'Mở bàn B01', exact: true }).click()
  await page.getByRole('button', { name: 'Mở phiên B01' }).click()
  await expect(page.getByRole('button', { name: 'Đang mở…', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Mở bàn B02', exact: true })).toBeDisabled()
  release?.()
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await expect(page.getByTestId('table-card')).toHaveCount(0)
  expect(posts).toBe(1)
})

test('cleaning state is visible and cannot be opened; detail fits tablet and mobile', async ({ page }) => {
  const snapshot = await (await page.request.get('/api/tables')).json()
  const b01 = snapshot.tables.find((table: { code: string }) => table.code === 'B01')
  const cleaning = { ...b01, status: 'NEEDS_CLEANING', currentSession: null }
  await page.route('**/api/tables', route => route.fulfill({ json: { ...snapshot, tables: snapshot.tables.map((table: { id: number }) => table.id === b01.id ? cleaning : table) } }))
  await page.route(`**/api/tables/${b01.id}`, route => route.fulfill({ json: cleaning }))
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/#tables')
    await page.getByRole('button', { name: 'Xem bàn B01', exact: true }).click()
    const detail = page.getByRole('region', { name: 'Chi tiết B01' })
    await expect(detail).toContainText('Chờ dọn')
    await expect(detail.getByRole('button', { name: 'Mở phiên B01' })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    const box = await detail.getByRole('button', { name: 'Kiểm tra trạng thái B01' }).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
})
