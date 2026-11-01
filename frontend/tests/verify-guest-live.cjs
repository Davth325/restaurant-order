// Invoked only by scripts/Verify-GuestOrdering.ps1 against its disposable database on port 8081.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const stateFile = path.join(root, '.work/guest-live-state.json');
const baseURL = 'http://127.0.0.1:8081';
async function post(context, url, data) {
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  return context.request.post(url, { headers: { [csrf.headerName]: csrf.token }, data });
}
async function orders(context, session) {
  const response = await context.request.get(`/api/guest/sessions/${session.id}/orders`);
  assert.equal(response.status(), 200);
  return response.json();
}
(async () => {
  const browser = await chromium.launch();
  const pageErrors = [];
  try {
    if (process.argv[2] === 'restart') {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      for (const saved of state) {
        const context = await browser.newContext({ baseURL, storageState: saved.storage });
        const page = await context.newPage();
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.goto('/#guest');
        await expect(page.getByRole('heading', { name: 'Giỏ món của bàn' })).toBeVisible();
        assert.deepEqual(await orders(context, saved.session), saved.orders);
        assert.equal((await context.request.get('/api/auth/me')).status(), 401);
        await expect(page.getByRole('region', { name: 'Món đã gọi' }).locator('.order-batch')).toHaveCount(saved.orders.length);
      }
      assert.deepEqual(pageErrors, []);
      console.log('Live restart: both persisted device cookies remain scoped, committed orders and prices are identical.');
      return;
    }
    const staff = await browser.newContext({ baseURL });
    const staffPage = await staff.newPage();
    await staffPage.goto('/#login');
    await staffPage.getByLabel('Tên đăng nhập').fill('nhanvien');
    await staffPage.getByLabel('Mật khẩu', { exact: true }).fill(process.env.DEMO_STAFF_PASSWORD);
    await staffPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(staffPage.getByTestId('table-card')).toHaveCount(30);
    const contexts = [], pages = [], sessions = [];
    for (const code of ['B01', 'B02']) {
      await staffPage.getByRole('button', { name: `Mở bàn ${code}`, exact: true }).click();
      const panel = staffPage.getByRole('region', { name: `Chi tiết ${code}` });
      await panel.getByRole('button', { name: `Mở phiên ${code}`, exact: true }).click();
      await panel.getByRole('button', { name: `Tạo mã gắn tablet ${code}` }).click();
      const pairingCode = await panel.getByLabel('Mã ghép tablet').innerText();
      const context = await browser.newContext({ baseURL, viewport: { width: 768, height: 1024 } });
      const page = await context.newPage();
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto('/#guest');
      await page.getByLabel('Mã ghép từ nhân viên').fill(pairingCode);
      await page.getByRole('button', { name: 'Gắn tablet', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Giỏ món của bàn' })).toBeVisible();
      const session = await (await context.request.get('/api/guest/session')).json();
      assert.equal(session.tableCode, code);
      assert.equal((await context.request.get('/api/auth/me')).status(), 401);
      assert.equal((await context.request.get('/api/tables')).status(), 401);
      assert.equal((await post(context, '/api/guest/pairing', { code: pairingCode })).status(), 400);
      contexts.push(context); pages.push(page); sessions.push(session);
    }
    for (const [index, other] of [[0, 1], [1, 0]]) {
      assert.equal((await contexts[index].request.get(`/api/guest/sessions/${sessions[other].id}/orders`)).status(), 403);
      assert.equal((await post(contexts[index], `/api/guest/sessions/${sessions[other].id}/orders`, {})).status(), 403);
    }
    const page = pages[0], endpoint = `/api/guest/sessions/${sessions[0].id}/orders`;
    await page.getByRole('button', { name: 'Thêm Gỏi cuốn tôm', exact: true }).click();
    await page.getByLabel('Số lượng Gỏi cuốn tôm').fill('2');
    await page.getByLabel('Ghi chú Gỏi cuốn tôm').fill('Ít cay');
    await page.getByRole('button', { name: 'Xem lại đợt gọi' }).click();
    let committedBody;
    await page.route(`**${endpoint}`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      committedBody = route.request().postDataJSON();
      const accepted = await route.fetch();
      assert.equal(accepted.status(), 200);
      await route.abort(); // Commit really happened, but the tablet loses the response.
    });
    await page.getByRole('button', { name: 'Xác nhận gửi món' }).click();
    await expect(page.getByRole('region', { name: 'Món đã gọi' }).locator('.order-batch')).toHaveCount(1);
    await page.unroute(`**${endpoint}`);
    const first = (await orders(contexts[0], sessions[0]))[0];
    assert.equal(first.totalVnd, 90000);
    const repeated = await post(contexts[0], endpoint, committedBody);
    assert.equal(repeated.status(), 200); assert.deepEqual(await repeated.json(), first);
    const tampered = structuredClone(committedBody);
    tampered.requestKey = crypto.randomUUID(); tampered.items[0].expectedPriceVnd = 1;
    tampered.totalVnd = 1; tampered.items[0].unitPriceVnd = 1;
    const rejected = await post(contexts[0], endpoint, tampered);
    assert.equal(rejected.status(), 409); assert.equal((await rejected.json()).code, 'PRICE_CHANGED');
    const rightPriceFakeTotal = structuredClone(committedBody);
    rightPriceFakeTotal.totalVnd = 1; rightPriceFakeTotal.items[0].unitPriceVnd = 1;
    assert.deepEqual(await (await post(contexts[0], endpoint, rightPriceFakeTotal)).json(), first);
    assert.equal((await contexts[1].request.get(`${endpoint}/by-key/${committedBody.requestKey}`)).status(), 403);
    await pages[1].getByRole('button', { name: 'Thêm Cơm gà nướng', exact: true }).click();
    await pages[1].getByRole('button', { name: 'Xem lại đợt gọi' }).click();
    await pages[1].getByRole('button', { name: 'Xác nhận gửi món' }).click();
    await expect(pages[1].getByRole('region', { name: 'Món đã gọi' })).toContainText('Cơm gà nướng');
    await expect(pages[1].getByRole('region', { name: 'Món đã gọi' })).not.toContainText('Gỏi cuốn tôm');
    // Failure before commit + unavailable status check: reload must retain exactly the same attempt.
    const attempts = [];
    await page.getByRole('button', { name: 'Thêm Trà đào cam sả', exact: true }).click();
    await page.getByRole('button', { name: 'Xem lại đợt gọi' }).click();
    await page.route(`**${endpoint}`, route => {
      if (route.request().method() !== 'POST') return route.continue();
      attempts.push(route.request().postDataJSON()); return route.abort();
    });
    await page.route('**/orders/by-key/*', route => route.abort());
    await page.getByRole('button', { name: 'Xác nhận gửi món' }).click();
    await expect(page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' })).toBeEnabled();
    await page.unroute(`**${endpoint}`); await page.unroute('**/orders/by-key/*');
    await page.route(`**${endpoint}`, route => {
      if (route.request().method() === 'POST') attempts.push(route.request().postDataJSON());
      return route.continue();
    });
    await page.getByRole('button', { name: 'Kiểm tra và thử gửi lại' }).click();
    await expect(page.getByRole('region', { name: 'Món đã gọi' }).locator('.order-batch')).toHaveCount(2);
    assert.equal(attempts.length, 2); assert.deepEqual(attempts[0], attempts[1]);
    for (const [name, viewport] of Object.entries({ portrait: { width: 768, height: 1024 }, landscape: { width: 1024, height: 768 }, mobile: { width: 375, height: 812 } })) {
      await page.setViewportSize(viewport);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(root, `.work/guest-${name}.png`), fullPage: true });
    }
    const saved = [];
    for (let i = 0; i < 2; i++) {
      const expected = await orders(contexts[i], sessions[i]);
      await pages[i].reload();
      await expect(pages[i].getByRole('region', { name: 'Món đã gọi' }).locator('.order-batch')).toHaveCount(expected.length);
      assert.deepEqual(await orders(contexts[i], sessions[i]), expected);
      saved.push({ storage: await contexts[i].storageState(), session: sessions[i], orders: expected });
    }
    fs.writeFileSync(stateFile, JSON.stringify(saved)); // Ignored .work; includes only disposable test cookies.
    assert.deepEqual(pageErrors, []);
    console.log('Live UI: staff pairs two browsers; isolation/forged price/duplicates/lost responses/reload verified; 3 viewports without overflow.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
