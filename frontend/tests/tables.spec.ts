import { expect, test } from '@playwright/test'

test('reads real PostgreSQL tables through the backend and filters by area', async ({ page, request }) => {
  const response = await request.get('/api/tables')
  expect(response.ok()).toBeTruthy()
  const snapshot = await response.json()
  expect(snapshot.total).toBe(30)
  await page.goto('/#tables')
  await expect(page.getByRole('heading', { name: 'Không gian phục vụ' })).toBeVisible()
  await expect(page.getByTestId('table-card')).toHaveCount(snapshot.total)
  await expect(page.getByText(snapshot.tables[0].displayName, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Khu B', exact: true }).click()
  await expect(page.getByTestId('table-card')).toHaveCount(15)
  await expect(page.getByText('Bàn 30', { exact: true })).toBeVisible()
  await expect(page.getByText('Bàn 01', { exact: true })).toHaveCount(0)
})

test('shows a connection error and recovers without displaying fake tables', async ({ page }) => {
  await page.route('**/api/tables', route => route.abort())
  await page.goto('/#tables')
  await expect(page.getByRole('alert')).toContainText('Chưa kết nối được hệ thống quán')
  await expect(page.getByTestId('table-card')).toHaveCount(0)
  await page.unroute('**/api/tables')
  await page.getByRole('button', { name: 'Tải lại dữ liệu' }).click()
  await expect(page.getByTestId('table-card')).toHaveCount(30)
  await page.route('**/api/tables', route => route.abort())
  await page.getByRole('button', { name: 'Làm mới' }).click()
  await expect(page.getByRole('alert')).toContainText('Dữ liệu bên dưới là lần đọc thành công trước')
})

test('fits a tablet viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/#tables')
  await expect(page.getByTestId('table-card')).toHaveCount(30)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})
