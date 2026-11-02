// Run only via Verify-Kitchen.ps1 against its disposable database on port 8081.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const stateFile = path.join(root, '.work/kitchen-live-state.json');
const baseURL = 'http://127.0.0.1:8081';
async function post(context, url, data) {
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  return context.request.post(url, { headers: { [csrf.headerName]: csrf.token }, data });
}
async function login(context, role) {
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  assert.equal((await context.request.post('/api/auth/login', { headers: { [csrf.headerName]: csrf.token }, form: { username: role === 'STAFF' ? 'nhanvien' : 'bep', password: process.env[`DEMO_${role}_PASSWORD`] } })).status(), 204);
}
async function snapshot(context) {
  const response = await context.request.get('/api/kitchen/orders');
  assert.equal(response.status(), 200); return response.json();
}
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const pageOf = async context => {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    return page;
  };
  try {
    if (process.argv[2] === 'restart') {
      const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const kitchen = await browser.newContext({ baseURL, storageState: saved.kitchen });
      assert.equal((await kitchen.request.get('/api/kitchen/orders')).status(), 401);
      await login(kitchen, 'KITCHEN');
      assert.deepEqual((await snapshot(kitchen)).units, saved.units);
      const page = await pageOf(kitchen);
      await page.goto('/#kitchen');
      await expect(page.getByRole('article', { name: 'B01 đợt 1' })).toContainText('2/3 đã xong · 1 chờ làm');
      await expect(page.getByRole('article', { name: 'B02 đợt 1' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Đã xong · chờ mang (1 đợt)', exact: true }).click();
      await expect(page.getByRole('article', { name: 'B02 đợt 1' })).toContainText('1/1 đã xong');
      const guest = await browser.newContext({ baseURL, storageState: saved.guest });
      const response = await guest.request.get(`/api/guest/sessions/${saved.session}/orders`);
      assert.equal(response.status(), 200);
      assert.deepEqual(await response.json(), saved.orders);
      assert.deepEqual(errors, []);
      console.log('Kitchen restart: persisted per-unit states, batches, notes and guest totals unchanged; internal login required again.');
      return;
    }
    const staff = await browser.newContext({ baseURL }); await login(staff, 'STAFF');
    const staffPage = await pageOf(staff); await staffPage.goto('/#tables');
    const guests = [], pages = [], sessions = [];
    for (const code of ['B01', 'B02']) {
      await staffPage.getByRole('button', { name: `Mở bàn ${code}`, exact: true }).click();
      const detail = staffPage.getByRole('region', { name: `Chi tiết ${code}` });
      await detail.getByRole('button', { name: `Mở phiên ${code}`, exact: true }).click();
      await detail.getByRole('button', { name: `Tạo mã gắn tablet ${code}` }).click();
      const codeText = await detail.getByLabel('Mã ghép tablet').innerText();
      const guest = await browser.newContext({ baseURL }); const page = await pageOf(guest);
      await page.goto('/#guest'); await page.getByLabel('Mã ghép từ nhân viên').fill(codeText);
      await page.getByRole('button', { name: 'Gắn tablet', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Giỏ món của bàn' })).toBeVisible();
      const session = await (await guest.request.get('/api/guest/session')).json();
      assert.equal(session.tableCode, code); guests.push(guest); pages.push(page); sessions.push(session);
    }
    const kitchen = await browser.newContext({ baseURL, viewport: { width: 768, height: 1024 } }); await login(kitchen, 'KITCHEN');
    const other = await browser.newContext({ baseURL, viewport: { width: 1024, height: 768 } }); await login(other, 'KITCHEN');
    const kp = await pageOf(kitchen), op = await pageOf(other);
    await kp.goto('/#kitchen'); await op.goto('/#kitchen');
    await expect(kp.getByRole('status')).toContainText('Cập nhật trực tiếp');
    await expect(kp.getByText('Chưa có món đã gửi.', { exact: false })).toBeVisible();
    async function send(index, qty, note) {
      const page = pages[index];
      await page.getByRole('button', { name: 'Thêm Gỏi cuốn tôm', exact: true }).click();
      await page.getByLabel('Số lượng Gỏi cuốn tôm').fill(String(qty));
      await page.getByLabel('Ghi chú Gỏi cuốn tôm').fill(note);
      await page.getByRole('button', { name: 'Xem lại đợt gọi' }).click();
      await page.getByRole('button', { name: 'Xác nhận gửi món' }).click();
    }
    // Reload just before submit: the first periodic recovery poll is still 15 seconds away.
    await kp.reload(); await expect(kp.getByRole('status')).toContainText('Cập nhật trực tiếp');
    await send(0, 3, 'Không ớt\nĐể sốt riêng');
    const first = kp.getByRole('article', { name: 'B01 đợt 1' });
    await expect(first).toContainText('0/3 đã xong · 3 chờ làm', { timeout: 5000 });
    await expect(op.getByRole('article', { name: 'B01 đợt 1' })).toContainText('3 chờ làm');
    await send(1, 1, 'Bàn khác');
    await expect(kp.getByRole('article', { name: 'B02 đợt 1' })).toContainText('Bàn khác');
    let saved = await snapshot(kitchen);
    const portions = saved.units.filter(u => u.tableCode === 'B01');
    assert.equal(portions.length, 3);
    // The mutation commits but the initiating screen never sees its response.
    await kp.route(`**/api/kitchen/units/${portions[0].id}/status`, async route => {
      const response = await route.fetch(); assert.equal(response.status(), 204); await route.abort();
    });
    await first.getByRole('button', { name: 'Bắt đầu suất 1 Gỏi cuốn tôm' }).click();
    await expect(first.getByRole('button', { name: 'Hoàn thành suất 1 Gỏi cuốn tôm' })).toBeEnabled();
    await kp.unroute(`**/api/kitchen/units/${portions[0].id}/status`);
    await first.getByRole('button', { name: 'Hoàn thành suất 1 Gỏi cuốn tôm' }).click();
    await expect(first).toContainText('1/3 đã xong · 2 chờ làm');
    await expect(op.getByRole('article', { name: 'B01 đợt 1' })).toContainText('1/3 đã xong · 2 chờ làm');
    for (let i = 0; i < 2; i++) assert.equal((await post(other, `/api/kitchen/units/${portions[0].id}/status`, { status: 'READY' })).status(), 204);
    assert.equal((await post(other, `/api/kitchen/units/${portions[0].id}/status`, { status: 'PREPARING' })).status(), 409);
    await kp.reload(); await expect(first).toContainText('1/3 đã xong · 2 chờ làm');
    for (const [width, height, file] of [[768, 1024, 'portrait'], [1024, 768, 'landscape'], [375, 812, 'phone']]) {
      await kp.setViewportSize({ width, height });
      assert(await kp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const heights = await first.getByRole('button').evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().height));
      assert(heights.every(h => h >= 44));
      await kp.screenshot({ path: path.join(root, `.work/kitchen-${file}.png`), fullPage: true });
    }
    await kp.setViewportSize({ width: 768, height: 1024 });
    // REST recovery remains functional with SSE blocked.
    await op.route('**/api/kitchen/events', route => route.abort()); await op.reload();
    await expect(op.getByRole('status')).toContainText('Mất kết nối cập nhật trực tiếp');
    await send(0, 1, 'Đợt gọi thêm');
    await expect(op.getByRole('article', { name: 'B01 đợt 2' })).toContainText('Đợt gọi thêm', { timeout: 20000 });
    // An offline screen must lock mutations, then reload the state changed by another screen.
    await kitchen.setOffline(true); await kp.getByRole('button', { name: 'Tải lại hàng đợi' }).click();
    await expect(kp.getByText('Dữ liệu có thể đã cũ.', { exact: false })).toBeVisible();
    await expect(first.getByRole('button', { name: 'Bắt đầu suất 2 Gỏi cuốn tôm' })).toBeDisabled();
    assert.equal((await post(other, `/api/kitchen/units/${portions[1].id}/status`, { status: 'PREPARING' })).status(), 204);
    assert.equal((await post(other, `/api/kitchen/units/${portions[1].id}/status`, { status: 'READY' })).status(), 204);
    await kitchen.setOffline(false); await kp.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(first).toContainText('2/3 đã xong · 1 chờ làm');
    await pages[0].getByRole('button', { name: 'Tải lại món đã gọi' }).click();
    await expect(pages[0].getByRole('region', { name: 'Món đã gọi' })).toContainText('2/3 đã xong');
    assert.equal((await guests[0].request.get('/api/kitchen/orders')).status(), 401);
    assert.equal((await staff.request.get('/api/kitchen/orders')).status(), 403);
    // Finish all portions in B02's first batch: remove only that batch from the active queue.
    const second = kp.getByRole('article', { name: 'B02 đợt 1' });
    await second.getByRole('button', { name: 'Bắt đầu suất 1 Gỏi cuốn tôm' }).click();
    await second.getByRole('button', { name: 'Hoàn thành suất 1 Gỏi cuốn tôm' }).click();
    await expect(second).toHaveCount(0);
    await expect(first).toContainText('2/3 đã xong · 1 chờ làm');
    await expect(op.getByRole('article', { name: 'B02 đợt 1' })).toHaveCount(0, { timeout: 20000 });
    await kp.getByRole('button', { name: 'Đã xong · chờ mang (1 đợt)', exact: true }).click();
    await expect(second).toContainText('1/1 đã xong');
    await expect(second).toContainText('Bàn khác');
    await kp.screenshot({ path: path.join(root, '.work/kitchen-ready.png'), fullPage: true });
    await kp.reload();
    await expect(second).toHaveCount(0);
    await expect(first).toBeVisible();
    await kp.getByRole('button', { name: 'Đã xong · chờ mang (1 đợt)', exact: true }).click();
    await expect(second).toContainText('1/1 đã xong');
    saved = await snapshot(kitchen);
    assert.equal(saved.units.length, 5);
    assert.deepEqual(saved.units.filter(u => u.batchId === portions[0].batchId).map(u => u.status), ['READY', 'READY', 'QUEUED']);
    assert.equal(saved.units.find(u => u.tableCode === 'B02').status, 'READY');
    const orders = await (await guests[0].request.get(`/api/guest/sessions/${sessions[0].id}/orders`)).json();
    fs.writeFileSync(stateFile, JSON.stringify({ kitchen: await kitchen.storageState(), guest: await guests[0].storageState(), session: sessions[0].id, units: saved.units, orders }));
    assert.deepEqual(errors, []);
    console.log('Kitchen live: two tables/screens, SSE, partial portions, complete batch hides and remains reviewable after reload, lost response, polling and reconnect passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
