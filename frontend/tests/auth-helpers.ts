import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// CI and local demo use independently generated credentials. Never print/store them in reports.
export function demoPassword(role: 'STAFF' | 'KITCHEN') {
  const key = `DEMO_${role}_PASSWORD`
  const value = process.env[key] ?? readFileSync(resolve(import.meta.dirname, '../../.env'), 'utf8')
    .split(/\r?\n/).find(line => line.startsWith(`${key}=`))?.slice(key.length + 1)
  if (!value) throw new Error(`Configure ${key} via Initialize-Dev.ps1`)
  return value
}

export async function loginApi(request: APIRequestContext, role: 'STAFF' | 'KITCHEN' = 'STAFF') {
  const csrf = await (await request.get('/api/auth/csrf')).json()
  const response = await request.post('/api/auth/login', {
    headers: { [csrf.headerName]: csrf.token },
    form: { username: role === 'STAFF' ? 'nhanvien' : 'bep', password: demoPassword(role) },
  })
  expect(response.status()).toBe(204)
}

export async function loginUi(page: Page, role: 'STAFF' | 'KITCHEN') {
  await page.goto('/#login')
  await page.getByLabel('Tên đăng nhập').fill(role === 'STAFF' ? 'nhanvien' : 'bep')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(demoPassword(role))
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('heading', { name: role === 'STAFF' ? 'Không gian phục vụ' : 'Khu vực bếp', exact: true })).toBeVisible()
}
