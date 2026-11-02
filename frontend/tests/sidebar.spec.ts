import { expect, test } from '@playwright/test'
import { loginApi } from './auth-helpers.js'

test.beforeEach(async ({ context }) => { await loginApi(context.request) })

test('keeps navigation and logout inside short laptop and zoom-equivalent viewports', async ({ page }) => {
  // Browser zoom/Windows scale reduces the CSS viewport, as in the reported screenshot.
  for (const viewport of [
    { width: 1366, height: 600 }, { width: 1280, height: 630 },
    { width: 1024, height: 500 }, { width: 853, height: 420 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/#tables')
    await expect(page.getByTestId('table-card')).toHaveCount(30)
    const sidebar = page.locator('.sidebar')
    for (const control of [sidebar.getByRole('link', { name: 'Khu vực bếp' }), sidebar.getByRole('button', { name: 'Đăng xuất', exact: true })]) {
      const box = await control.boundingBox()
      expect(box, `${viewport.width}×${viewport.height}`).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const logout = await sidebar.getByRole('button', { name: 'Đăng xuất', exact: true }).boundingBox()
    expect(logout!.y + logout!.height).toBeLessThanOrEqual(viewport.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  }
})

test('can scroll the sidebar independently at extreme height and still log out', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 240 })
  await page.goto('/#tables')
  await expect(page.getByTestId('table-card')).toHaveCount(30)
  const sidebar = page.locator('.sidebar')
  const logout = sidebar.getByRole('button', { name: 'Đăng xuất', exact: true })
  await logout.focus()
  await expect(logout).toBeInViewport({ ratio: 1 })
  expect(await sidebar.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await logout.press('Enter')
  await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible()
})

test('mobile header stays in document flow without filling the screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/#tables')
  await expect(page.getByTestId('table-card')).toHaveCount(30)
  // Linux falls back to Arial/sans-serif; its wider labels exposed overflow missed by Segoe UI.
  for (const font of ['Segoe UI', 'Arial', 'Verdana', 'sans-serif']) {
    const family = font === 'sans-serif' ? font : `'${font}'`
    await page.addStyleTag({ content: `.main-nav a { font-family: ${family} !important; }` })
    const sidebar = await page.locator('.sidebar').boundingBox()
    expect(sidebar!.height, font).toBeLessThan(300)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), font).toBeTruthy()
    expect(await page.locator('.main-nav a').evaluateAll(links => links.every(link => link.getBoundingClientRect().height >= 44)), font).toBeTruthy()
  }
})
