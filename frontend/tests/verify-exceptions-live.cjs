// Run only through scripts/Verify-Exceptions.ps1 on its disposable database / port 8081.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const baseURL = 'http://127.0.0.1:8081';
const stateFile = path.resolve(__dirname, '../../.work/exceptions-live-state.json');
async function post(context, url, data) {
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  return context.request.post(url, { headers: { [csrf.headerName]: csrf.token }, data });
}
async function login(context, username) {
  const role = { nhanvien: 'STAFF', bep: 'KITCHEN', quanly: 'MANAGER' }[username];
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  assert.equal((await context.request.post('/api/auth/login', { headers: { [csrf.headerName]: csrf.token }, form: { username, password: process.env[`DEMO_${role}_PASSWORD`] } })).status(), 204);
}
async function read(context, url) { const response = await context.request.get(url); assert.equal(response.status(), 200); return response.json(); }
async function reasonAndConfirm(page, reason) {
  await page.getByLabel('Lý do', { exact: true }).fill(reason);
  await page.getByRole('button', { name: 'Xác nhận xử lý', exact: true }).click();
}
(async () => {
  const browser = await chromium.launch(); const errors = [];
  const pageOf = async context => { const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); return page; };
  try {
    if (process.argv[2] === 'restart') {
      const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const guest = await browser.newContext({ baseURL, storageState: saved.guest });
      assert.deepEqual(await read(guest, `/api/guest/sessions/${saved.session}/orders`), saved.orders);
      assert.deepEqual(await read(guest, `/api/guest/sessions/${saved.session}/cancellations`), saved.guestUnits);
      const manager = await browser.newContext({ baseURL }); await login(manager, 'quanly');
      assert.deepEqual(await read(manager, '/api/cancellations/units'), saved.units);
      for (const [id, history] of saved.histories) assert.deepEqual(await read(manager, `/api/cancellations/units/${id}/history`), history);
      const gp = await pageOf(guest); await gp.goto('/#guest');
      await expect(gp.getByRole('region', { name: 'Món đã gọi' })).toContainText('Tạm tính cả phiên: 90.000');
      const staff = await browser.newContext({ baseURL }); await login(staff, 'nhanvien');
      const sp = await pageOf(staff); await sp.goto(`/#order/${saved.session}`);
      await expect(sp.getByRole('region', { name: 'Món đã gọi' }).getByRole('article')).toHaveCount(2);
      await expect(sp.getByRole('region', { name: 'Món đã gọi' })).toContainText('90.000');
      assert.deepEqual(errors, []); console.log('6.7 restart: both batches, subtotal, guest authority, cancellation state and exact actor/time/reason history preserved.'); return;
    }
    const staff = await browser.newContext({ baseURL, viewport: { width: 768, height: 1024 } }); await login(staff, 'nhanvien');
    const manager = await browser.newContext({ baseURL }); await login(manager, 'quanly');
    const kitchen = await browser.newContext({ baseURL }); await login(kitchen, 'bep');
    const tables = await read(staff, '/api/tables'); const table = tables.tables.find(t => t.code === 'B01');
    assert.equal((await post(staff, `/api/tables/${table.id}/sessions`, {})).status(), 201);
    const session = (await read(staff, `/api/tables/${table.id}`)).currentSession.id;
    const pairing = await (await post(staff, `/api/staff/sessions/${session}/pairing`, {})).json();
    const guest = await browser.newContext({ baseURL, viewport: { width: 768, height: 1024 } });
    assert.equal((await post(guest, '/api/guest/pairing', { code: pairing.code })).status(), 200);
    const gp = await pageOf(guest), sp = await pageOf(staff), mp = await pageOf(manager), kp = await pageOf(kitchen);
    await gp.goto('/#guest');
    await gp.getByRole('button', { name: 'Thêm Gỏi cuốn tôm', exact: true }).click();
    await gp.getByLabel('Số lượng Gỏi cuốn tôm').fill('2');
    await gp.getByRole('button', { name: 'Xem lại đợt gọi' }).click(); await gp.getByRole('button', { name: 'Xác nhận gửi món' }).click();
    await expect(gp.getByRole('region', { name: 'Món đã gọi' }).getByRole('article')).toHaveCount(1);
    await sp.goto(`/#order/${session}`);
    await sp.getByRole('button', { name: 'Thêm Gỏi cuốn tôm', exact: true }).click(); await sp.getByLabel('Số lượng Gỏi cuốn tôm').fill('3');
    let staffPosts = 0;
    await sp.route(`**/api/staff/sessions/${session}/orders`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      staffPosts++; const response = await route.fetch(); assert.equal(response.status(), 200); await route.abort();
    });
    await sp.getByRole('button', { name: 'Xem lại đợt gọi' }).click(); await sp.getByRole('button', { name: 'Xác nhận gửi món' }).click();
    await expect(sp.getByRole('region', { name: 'Món đã gọi' }).getByRole('article')).toHaveCount(2);
    await sp.reload(); await expect(sp.getByRole('region', { name: 'Món đã gọi' })).toContainText('Tạm tính cả phiên: 225.000'); assert.equal(staffPosts, 1);
    await gp.getByRole('button', { name: 'Tải lại món đã gọi' }).click();
    await expect(gp.getByRole('region', { name: 'Món đã gọi' }).getByRole('article')).toHaveCount(2);
    await gp.getByRole('button', { name: 'Tải lại trạng thái món' }).click();
    let cancelPosts = 0, cancellationCommitted = false;
    await gp.route(`**/api/guest/sessions/${session}/cancellations/cancel`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      cancelPosts++; const response = await route.fetch(); assert.equal(response.status(), 200); cancellationCommitted = true; await route.abort();
    });
    await gp.getByRole('button', { name: 'Hủy suất 1 Gỏi cuốn tôm', exact: true }).first().click();
    await expect(gp.getByLabel('Lý do', { exact: true })).toHaveCount(0);
    await gp.getByRole('button', { name: 'Xác nhận hủy suất 1', exact: true }).click();
    await expect.poll(() => cancellationCommitted).toBe(true);
    await expect(gp.getByText(/Chưa xác định kết quả\. Giữ lượt gửi/)).toBeVisible();
    await expect(gp.getByRole('button', { name: 'Kiểm tra và thử lại', exact: true })).toBeVisible();
    await gp.reload(); await expect(gp.getByText('Đã hủy suất.', { exact: true })).toBeVisible(); assert.equal(cancelPosts, 1);
    await gp.unroute(`**/api/guest/sessions/${session}/cancellations/cancel`);
    await expect(gp.getByRole('region', { name: 'Món đã gọi' })).toContainText('Tạm tính cả phiên: 180.000');
    await kp.goto('/#kitchen');
    await kp.getByRole('button', { name: /Món đã hủy \/ loại tiền/ }).click();
    await expect(kp.getByText('Đã hủy · ngừng làm / không mang', { exact: true })).toBeVisible();
    await expect(kp.getByText(/Khách đã hủy/)).toBeVisible();
    let units = await read(manager, '/api/cancellations/units');
    const second = units[1];
    await kp.getByRole('button', { name: /Đang xử lý/ }).click();
    await kp.getByRole('button', { name: 'Bắt đầu suất 2 Gỏi cuốn tôm', exact: true }).first().click();
    await expect(kp.getByRole('button', { name: 'Hoàn thành suất 2 Gỏi cuốn tôm', exact: true })).toBeVisible();
    assert.equal((await post(guest, `/api/guest/sessions/${session}/cancellations/cancel`, { requestKey: crypto.randomUUID(), unitId: second.id })).status(), 409);
    await gp.getByRole('button', { name: 'Tải lại trạng thái món' }).click();
    const started = gp.getByRole('article').filter({ has: gp.getByRole('heading', { name: `B01 · Đợt #${second.batchId} · Gỏi cuốn tôm · Suất 2`, exact: true }) });
    await expect(started).toContainText('Đang làm');
    await expect(started.getByRole('button', { name: /Hủy suất/ })).toHaveCount(0);
    await expect(gp.getByRole('region', { name: 'Món đã gọi' })).toContainText('Tạm tính cả phiên: 180.000');
    await mp.goto('/#cancellations');
    await expect(mp.getByRole('button', { name: /Duyệt hủy/ })).toHaveCount(0);
    await mp.getByRole('button', { name: 'Hủy trực tiếp suất 2 Gỏi cuốn tôm', exact: true }).first().click();
    await reasonAndConfirm(mp, 'Đã báo bếp ngừng làm');
    await expect(mp.getByText('Đã lưu điều chỉnh.', { exact: true })).toBeVisible();
    units = await read(manager, '/api/cancellations/units'); const served = units[2];
    for (const status of ['PREPARING','READY']) assert.equal((await post(kitchen, `/api/kitchen/units/${served.id}/status`, { status })).status(), 204);
    for (const [version, action] of [[2,'PICK_UP'],[3,'SERVE']]) assert.equal((await post(staff, `/api/serving/units/${served.id}/actions`, { requestKey: crypto.randomUUID(), version, action, reason: '' })).status(), 204);
    await mp.getByRole('button', { name: 'Tải lại trạng thái món' }).click();
    await mp.getByRole('button', { name: 'Loại khỏi tạm tính suất 1 Gỏi cuốn tôm', exact: true }).click(); await reasonAndConfirm(mp, 'Món lỗi, quản lý xác nhận');
    await expect(mp.getByText('Đã phục vụ · Đã loại khỏi tạm tính', { exact: true })).toBeVisible();
    await mp.getByRole('button', { name: 'Lịch sử hủy suất 1 Gỏi cuốn tôm', exact: true }).nth(1).click();
    await expect(mp.getByText(/quanly · Loại khỏi tạm tính · Đã phục vụ → Đã phục vụ/)).toBeVisible();
    await gp.getByRole('button', { name: 'Tải lại món đã gọi' }).click(); await expect(gp.getByRole('region', { name: 'Món đã gọi' })).toContainText('Tạm tính cả phiên: 90.000');
    units = await read(manager, '/api/cancellations/units'); assert.deepEqual(units.map(u => u.status), ['CANCELLED','CANCELLED','SERVED','QUEUED','QUEUED']);
    assert.equal(units.filter(u => u.excluded).length, 3);
    assert.equal(second.id, units[1].id);
    const histories = []; for (const u of units.slice(0,3)) histories.push([u.id, await read(manager, `/api/cancellations/units/${u.id}/history`)]);
    for (const viewport of [{width:768,height:1024},{width:1024,height:768},{width:375,height:812}]) {
      await mp.setViewportSize(viewport); assert(await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await mp.getByRole('region', { name: 'Hủy món' }).locator('button').evaluateAll(buttons => buttons.every(b => b.getBoundingClientRect().height >= 44)));
    }
    await mp.setViewportSize({width:768,height:1024}); await mp.screenshot({path:path.resolve(__dirname,'../../.work/exceptions-manager.png'),fullPage:true});
    await kp.getByRole('button', { name: /Món đã hủy \/ loại tiền/ }).click(); await expect(kp.getByText(/Món lỗi, quản lý xác nhận/)).toBeVisible();
    fs.writeFileSync(stateFile, JSON.stringify({session,guest:await guest.storageState(),orders:await read(guest,`/api/guest/sessions/${session}/orders`),guestUnits:await read(guest,`/api/guest/sessions/${session}/cancellations`),units,histories},null,2));
    assert.deepEqual(errors, []); console.log('6.7 live: two batches, staff retry, guest cancellation retry, guest self-cancellation, started portions blocked, manager cancellation/exclusion, kitchen notification, subtotal 90,000.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
