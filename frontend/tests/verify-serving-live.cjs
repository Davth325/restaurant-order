// Only run via Verify-Serving.ps1 against its disposable database on 8081.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const stateFile = path.resolve(__dirname, '../../.work/serving-live-state.json');
const baseURL = 'http://127.0.0.1:8081';
async function post(context, url, data) {
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  return context.request.post(url, { headers: { [csrf.headerName]: csrf.token }, data });
}
async function login(context, username) {
  const key = { nhanvien: 'STAFF', nhanvien2: 'STAFF2', bep: 'KITCHEN', quanly: 'MANAGER' }[username];
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  assert.equal((await context.request.post('/api/auth/login', { headers: { [csrf.headerName]: csrf.token }, form: { username, password: process.env[`DEMO_${key}_PASSWORD`] } })).status(), 204);
}
async function snapshot(context) {
  const response = await context.request.get('/api/serving/orders'); assert.equal(response.status(), 200); return response.json();
}
(async () => {
  const browser = await chromium.launch(); const errors = [];
  const pageOf = async context => { const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); return page; };
  try {
    if (process.argv[2] === 'restart') {
      const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const staff = await browser.newContext({ baseURL, storageState: saved.staff });
      assert.equal((await staff.request.get('/api/serving/orders')).status(), 401);
      await login(staff, 'nhanvien'); assert.deepEqual((await snapshot(staff)).units, saved.units);
      const page = await pageOf(staff); await page.goto('/#serving');
      await expect(page.getByRole('article')).toHaveCount(1); await expect(page.getByRole('article')).toContainText('B02');
      await expect(page.getByRole('button', { name: /Đã phục vụ|Lịch sử suất/ })).toHaveCount(0);
      const manager = await browser.newContext({ baseURL }); await login(manager, 'quanly');
      assert.deepEqual((await snapshot(manager)).units, saved.managerUnits);
      const managerPage = await pageOf(manager); await managerPage.goto('/#serving');
      await managerPage.getByRole('button', { name: 'Đã phục vụ (2 suất)' }).click();
      await expect(managerPage.getByRole('article')).toContainText('2/3 suất đã phục vụ');
      const guest = await browser.newContext({ baseURL, storageState: saved.guest });
      const response = await guest.request.get(`/api/guest/sessions/${saved.session}/orders`);
      assert.equal(response.status(), 200); assert.deepEqual(await response.json(), saved.orders);
      assert.deepEqual(errors, []); console.log('Serving restart: exact actor/time/status/history preserved; served portions stay out of ready queue.');
      return;
    }
    const staff = await browser.newContext({ baseURL, viewport: { width: 768, height: 1024 } }); await login(staff, 'nhanvien');
    const other = await browser.newContext({ baseURL, viewport: { width: 1024, height: 768 } }); await login(other, 'nhanvien2');
    const manager = await browser.newContext({ baseURL }); await login(manager, 'quanly');
    const kitchen = await browser.newContext({ baseURL }); await login(kitchen, 'bep');
    const sp = await pageOf(staff), op = await pageOf(other), mp = await pageOf(manager), kp = await pageOf(kitchen);
    // This staff screen deliberately loses SSE; polling must still discover kitchen changes.
    await op.route('**/api/serving/events', r => r.abort());
    await sp.goto('/#serving'); await op.goto('/#serving'); await mp.goto('/#serving'); await kp.goto('/#kitchen');
    const menu = await (await staff.request.get('/api/menu')).json();
    const item = menu.categories.flatMap(c => c.items).find(i => i.name === 'Gỏi cuốn tôm');
    assert(item);
    const guests = [], sessions = [];
    for (const [code, quantity] of [['B01', 3], ['B02', 1]]) {
      const tables = await (await staff.request.get('/api/tables')).json(); const table = tables.tables.find(t => t.code === code);
      assert.equal((await post(staff, `/api/tables/${table.id}/sessions`, {})).status(), 201);
      const detail = await (await staff.request.get(`/api/tables/${table.id}`)).json();
      const session = detail.currentSession.id;
      const pairing = await (await post(staff, `/api/staff/sessions/${session}/pairing`, {})).json();
      const guest = await browser.newContext({ baseURL }); assert.equal((await post(guest, '/api/guest/pairing', { code: pairing.code })).status(), 200);
      assert.equal((await post(guest, `/api/guest/sessions/${session}/orders`, { requestKey: crypto.randomUUID(), items: [{ menuItemId: item.id, quantity, expectedPriceVnd: item.priceVnd, optionIds: [], note: 'Không ớt · Để sốt riêng' }] })).status(), 200);
      guests.push(guest); sessions.push(session);
    }
    const kitchenUnits = (await (await kitchen.request.get('/api/kitchen/orders')).json()).units;
    for (const unit of kitchenUnits.filter(u => u.tableCode === 'B02' || u.number <= 2)) {
      assert.equal((await post(kitchen, `/api/kitchen/units/${unit.id}/status`, { status: 'PREPARING' })).status(), 204);
      assert.equal((await post(kitchen, `/api/kitchen/units/${unit.id}/status`, { status: 'READY' })).status(), 204);
    }
    await expect(sp.getByRole('button', { name: 'Chờ mang (3 suất)' })).toBeVisible();
    await expect(op.getByRole('button', { name: 'Chờ mang (3 suất)' })).toBeVisible({ timeout: 20000 });
    const card = p => p.getByRole('article', { name: 'B01 đợt 1 Gỏi cuốn tôm' });
    // Hold both browser POSTs until both staff have clicked the same portion.
    let arrived = 0, release; const both = new Promise(r => release = r); const statuses = [];
    const firstId = kitchenUnits.find(u => u.tableCode === 'B01' && u.number === 1).id;
    for (const page of [sp, op]) {
      await page.route(`**/api/serving/units/${firstId}/actions`, async route => { if (++arrived === 2) release(); await both; const response = await route.fetch(); statuses.push(response.status()); await route.fulfill({ response }); });
    }
    await Promise.all([card(sp).getByRole('button', { name: 'Nhận mang suất 1', exact: true }).click(), card(op).getByRole('button', { name: 'Nhận mang suất 1', exact: true }).click()]);
    await expect.poll(() => statuses.length).toBe(2); assert.deepEqual(statuses.sort(), [204, 409]);
    for (const page of [sp, op]) await page.unroute(`**/api/serving/units/${firstId}/actions`);
    const winnerName = (await snapshot(manager)).units.find(u => u.id === firstId).pickedUpBy;
    const winner = winnerName === 'nhanvien' ? sp : op;
    const loser = winnerName === 'nhanvien' ? op : sp;
    await loser.getByRole('button', { name: 'Đang mang (0 suất)' }).click();
    await expect(loser.getByRole('article')).toHaveCount(0);
    await expect(loser.getByText('Bạn chưa có suất đang mang.', { exact: true })).toBeVisible();
    const losingContext = winnerName === 'nhanvien' ? other : staff;
    assert.equal((await snapshot(losingContext)).units.some(u => u.id === firstId), false);
    await expect(mp.getByRole('button', { name: 'Đang mang (1 suất)' })).toBeVisible();
    await loser.getByRole('button', { name: 'Chờ mang (2 suất)' }).click();
    await winner.getByRole('button', { name: 'Đang mang (1 suất)' }).click();
    await card(winner).getByRole('button', { name: 'Đã giao suất 1', exact: true }).click();
    await expect(winner.getByRole('button', { name: /Đã phục vụ|Lịch sử suất/ })).toHaveCount(0);
    await expect(mp.getByRole('button', { name: 'Đã phục vụ (1 suất)' })).toBeVisible();
    await op.getByRole('button', { name: /Chờ mang \(2 suất\)/ }).click();
    await card(op).getByRole('button', { name: 'Nhận mang suất 2', exact: true }).click();
    await expect(mp.getByRole('button', { name: 'Đang mang (1 suất)' })).toBeVisible();
    await mp.getByRole('button', { name: 'Đang mang (1 suất)' }).click();
    await card(mp).getByRole('button', { name: 'Trả lại suất 2' }).click();
    await mp.getByLabel('Lý do trả lại').fill('Nhận nhầm bàn · quản lý trả lại');
    await mp.getByRole('button', { name: 'Xác nhận trả lại', exact: true }).click();
    await expect(mp.getByRole('button', { name: 'Chờ mang (2 suất)' })).toBeVisible();
    await op.getByRole('button', { name: 'Tải lại món phục vụ' }).click();
    const secondId = kitchenUnits.find(u => u.tableCode === 'B01' && u.number === 2).id;
    // Lose a response after the real server committed; reload resolves the stored key, no extra pickup.
    let lostPosts = 0, lostCommitted = false;
    await op.route(`**/api/serving/units/${secondId}/actions`, async route => { lostPosts++; const response = await route.fetch(); assert.equal(response.status(), 204); lostCommitted = true; await route.abort(); });
    await card(op).getByRole('button', { name: 'Nhận mang suất 2', exact: true }).click();
    await expect(op.getByRole('region', { name: 'Thao tác chưa rõ kết quả' })).toBeVisible();
    // The pending panel appears before POST; prove commit before simulating a reload after a lost response.
    await expect.poll(() => lostCommitted).toBe(true);
    await op.reload(); await expect(op.getByRole('region', { name: 'Thao tác chưa rõ kết quả' })).toHaveCount(0);
    assert.equal(lostPosts, 1); await op.unroute(`**/api/serving/units/${secondId}/actions`);
    await op.getByRole('button', { name: 'Đang mang (1 suất)' }).click();
    await card(op).getByRole('button', { name: 'Đã giao suất 2', exact: true }).click();
    await expect(op.getByRole('button', { name: /Đã phục vụ|Lịch sử suất/ })).toHaveCount(0);
    await mp.getByRole('button', { name: 'Đã phục vụ (2 suất)' }).click();
    await card(mp).getByRole('button', { name: 'Lịch sử suất 2' }).click();
    await expect(mp.getByRole('region', { name: 'Lịch sử phục vụ', exact: true })).toContainText('Nhận nhầm bàn · quản lý trả lại');
    await expect(kp.getByRole('article', { name: 'B01 đợt 1', exact: true })).toContainText('2/3 đã xong · 1 chờ làm');
    await expect(kp.getByRole('article', { name: 'B01 đợt 1', exact: true })).toContainText('Đã phục vụ');
    const guestPage = await pageOf(guests[0]); await guestPage.goto('/#guest');
    await expect(guestPage.getByRole('region', { name: 'Món đã gọi' })).toContainText('2 đã phục vụ');
    await sp.reload(); await expect(sp.getByRole('article')).toHaveCount(1); await expect(sp.getByRole('article')).toContainText('B02');
    // Offline keeps the snapshot and blocks pickup. Reconnect reads the server again.
    await staff.setOffline(true); await sp.getByRole('button', { name: 'Tải lại món phục vụ' }).click();
    await expect(sp.getByRole('button', { name: 'Nhận mang suất 1' })).toBeDisabled();
    await staff.setOffline(false); await sp.getByRole('button', { name: 'Tải lại món phục vụ' }).click();
    await expect(sp.getByRole('button', { name: 'Nhận mang suất 1' })).toBeEnabled();
    for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 375, height: 812 }]) {
      await sp.setViewportSize(viewport);
      assert(await sp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await sp.getByRole('article').getByRole('button').evaluateAll(buttons => buttons.every(b => b.getBoundingClientRect().height >= 44)));
    }
    await sp.setViewportSize({ width: 768, height: 1024 }); await sp.screenshot({ path: path.resolve(__dirname, '../../.work/serving-portrait.png'), fullPage: true });
    const units = (await snapshot(staff)).units;
    assert.equal(units.filter(u => u.status === 'SERVED').length, 0); assert.equal(units.filter(u => u.status === 'READY').length, 1);
    const managerUnits = (await snapshot(manager)).units;
    assert.equal(managerUnits.filter(u => u.status === 'SERVED').length, 2);
    assert.equal((await staff.request.get(`/api/serving/units/${secondId}/history`)).status(), 403);
    const orders = await (await guests[0].request.get(`/api/guest/sessions/${sessions[0]}/orders`)).json();
    fs.writeFileSync(stateFile, JSON.stringify({ staff: await staff.storageState(), guest: await guests[0].storageState(), session: sessions[0], units, managerUnits, orders }));
    assert.deepEqual(errors, []); console.log('Serving live: two different staff clicks => 204/409; partial service, manager return/history, lost response/reload, SSE/polling/offline and guest/kitchen verified.');
  } catch (error) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
      if (page.url().endsWith('#serving')) {
        console.error('Serving failure alerts:', await page.getByRole('alert').allTextContents().catch(() => []));
        await page.screenshot({ path: path.resolve(__dirname, '../../.work/serving-failure.png'), fullPage: true }).catch(() => {});
      }
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
