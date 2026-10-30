import { expect, test } from '@playwright/test'
import { demoPassword, loginUi } from './auth-helpers.js'

test('isolates staff and kitchen browsers, enforces API roles, rotates and revokes sessions', async ({ browser, baseURL }) => {
  const staff = await browser.newContext({ baseURL })
  const kitchen = await browser.newContext({ baseURL })
  const guest = await browser.newContext({ baseURL })
  try {
    expect((await guest.request.get('/api/tables')).status()).toBe(401)
    expect((await guest.request.get('/api/kitchen/workspace')).status()).toBe(401)
    expect((await guest.request.get('/api/menu')).status()).toBe(200)
    const staffPage = await staff.newPage()
    const kitchenPage = await kitchen.newPage()
    await loginUi(staffPage, 'STAFF')
    await loginUi(kitchenPage, 'KITCHEN')
    expect((await staff.request.get('/api/tables')).status()).toBe(200)
    expect((await staff.request.get('/api/kitchen/workspace')).status()).toBe(403)
    expect((await kitchen.request.get('/api/tables')).status()).toBe(403)
    expect((await kitchen.request.get('/api/kitchen/workspace')).status()).toBe(200)
    await kitchenPage.goto('/#tables')
    await expect(kitchenPage.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
    await kitchenPage.getByRole('link', { name: 'Về khu vực làm việc' }).click()
    await expect(kitchenPage.getByRole('heading', { name: 'Khu vực bếp', exact: true })).toBeVisible()
    await staffPage.reload()
    await expect(staffPage.getByTestId('table-card')).toHaveCount(30)
    const oldCookies = await staff.cookies()
    const sessionCookie = oldCookies.find(cookie => cookie.name === 'JSESSIONID')!
    expect(sessionCookie.httpOnly).toBeTruthy()
    expect(sessionCookie.sameSite).toBe('Strict')
    await staffPage.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await expect(staffPage.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
    expect((await staff.request.get('/api/tables')).status()).toBe(401)
    await guest.addCookies(oldCookies)
    expect((await guest.request.get('/api/tables')).status()).toBe(401)
    expect((await kitchen.request.get('/api/kitchen/workspace')).status()).toBe(200)
    await staffPage.goto('/#tables')
    await expect(staffPage.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
    await expect(staffPage.getByTestId('table-card')).toHaveCount(0)
  } finally {
    await staff.close(); await kitchen.close(); await guest.close()
  }
})

test('generic failed login, cleared password, network failure and recovery', async ({ page }) => {
  await page.goto('/#login')
  await page.getByLabel('Tên đăng nhập').fill('nhanvien')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Tên đăng nhập hoặc mật khẩu không đúng.')
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('')
  await page.route('**/api/auth/login', route => route.abort())
  await page.getByLabel('Mật khẩu', { exact: true }).fill(demoPassword('STAFF'))
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối được hệ thống quán')
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('')
  await page.unroute('**/api/auth/login')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(demoPassword('STAFF'))
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByTestId('table-card')).toHaveCount(30)
})

test('losing the server session removes protected data and allows signing in again', async ({ page, context }) => {
  await loginUi(page, 'STAFF')
  await expect(page.getByTestId('table-card')).toHaveCount(30)
  // Actual logout in a second tab/API invalidates the same server session, like expiry/restart.
  const csrf = await (await context.request.get('/api/auth/csrf')).json()
  expect((await context.request.post('/api/auth/logout', { headers: { [csrf.headerName]: csrf.token } })).status()).toBe(204)
  await page.getByRole('button', { name: 'Làm mới' }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
  await expect(page.getByText('Phiên đăng nhập đã hết hạn hoặc quyền đã thay đổi. Vui lòng đăng nhập lại.')).toBeVisible()
  await expect(page.getByTestId('table-card')).toHaveCount(0)
  await loginUi(page, 'STAFF')
  await expect(page.getByTestId('table-card')).toHaveCount(30)
})

test('CSRF blocks forged login and logout; failed logout stays retryable', async ({ page, context }) => {
  expect((await context.request.post('/api/auth/login', { form: { username: 'nhanvien', password: 'wrong' } })).status()).toBe(403)
  await loginUi(page, 'STAFF')
  expect((await context.request.post('/api/auth/logout')).status()).toBe(403)
  expect((await context.request.get('/api/tables')).status()).toBe(200)
  await page.route('**/api/auth/logout', route => route.abort())
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Chưa xác nhận được đăng xuất')
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeEnabled()
  await page.unroute('**/api/auth/logout')
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
})

for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
  test(`login fits ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/#login')
    await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    expect((await page.getByRole('button', { name: 'Đăng nhập', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  })
}
