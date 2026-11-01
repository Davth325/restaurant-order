package com.restaurant.order;

import static org.assertj.core.api.Assertions.assertThat;
import com.restaurant.order.ordering.GuestOrderService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DEMO_STAFF_PASSWORD=" + BrowserSession.STAFF_PASSWORD,
        "DEMO_KITCHEN_PASSWORD=" + BrowserSession.KITCHEN_PASSWORD })
@ActiveProfiles("demo")
class GuestOrderIntegrationTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    record Result(int status, String body) {}

    private BrowserSession staff() {
        var browser = new BrowserSession(port);
        assertThat(browser.login("nhanvien", BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
        return browser;
    }
    private Result post(BrowserSession browser, String path, Object body) {
        var csrf = browser.csrf();
        return browser.client.post().uri(path).contentType(MediaType.APPLICATION_JSON)
                .header(csrf.get("headerName").toString(), csrf.get("token").toString()).body(body)
                .exchange((req, res) -> new Result(res.getStatusCode().value(), res.bodyTo(String.class)));
    }
    private long open(BrowserSession staff, String code) {
        long table = jdbc.queryForObject("SELECT id FROM restaurant_table WHERE code = ?", Long.class, code);
        assertThat(post(staff, "/api/tables/" + table + "/sessions", Map.of()).status()).isEqualTo(201);
        return jdbc.queryForObject("SELECT id FROM table_session WHERE table_id = ? AND status = 'OPEN'", Long.class, table);
    }
    private GuestOrderService.Pairing pairing(BrowserSession staff, long session) {
        var csrf = staff.csrf();
        return staff.client.post().uri("/api/staff/sessions/" + session + "/pairing")
                .header(csrf.get("headerName").toString(), csrf.get("token").toString())
                .retrieve().body(GuestOrderService.Pairing.class);
    }
    private BrowserSession bind(BrowserSession staff, long session) {
        var browser = new BrowserSession(port);
        assertThat(post(browser, "/api/guest/pairing", Map.of("code", pairing(staff, session).code())).status()).isEqualTo(200);
        return browser;
    }
    private long item() { return jdbc.queryForObject("SELECT id FROM menu_item WHERE code = 'GOI_CUON'", Long.class); }
    private long price() { return jdbc.queryForObject("SELECT price_vnd FROM menu_item WHERE id = ?", Long.class, item()); }
    private GuestOrderService.Submit order(UUID key, long price, int qty, List<Long> options) {
        return new GuestOrderService.Submit(key, List.of(new GuestOrderService.Line(item(), qty, price, options, "Ít cay")));
    }
    private String path(long session) { return "/api/guest/sessions/" + session + "/orders"; }
    private int count(String table) { return jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class); }
    @AfterEach void cleanup() {
        jdbc.update("DELETE FROM order_item"); jdbc.update("DELETE FROM order_batch");
        jdbc.update("DELETE FROM guest_device"); jdbc.update("DELETE FROM guest_pairing");
        jdbc.update("DELETE FROM table_session"); jdbc.update("UPDATE restaurant_table SET status = 'AVAILABLE'");
        jdbc.update("UPDATE menu_item SET price_vnd = 45000, available = true WHERE code = 'GOI_CUON'");
    }
    @Test void pairingNeedsStaffAndCsrfIsSingleUseExpiringAndNeverReusesStaffAuthority() {
        var staff = staff(); long session = open(staff, "B01");
        var guest = new BrowserSession(port);
        assertThat(post(guest, "/api/staff/sessions/" + session + "/pairing", Map.of()).status()).isEqualTo(401);
        var kitchen = new BrowserSession(port); kitchen.login("bep", BrowserSession.KITCHEN_PASSWORD);
        assertThat(post(kitchen, "/api/staff/sessions/" + session + "/pairing", Map.of()).status()).isEqualTo(403);
        int noCsrf = staff.client.post().uri("/api/staff/sessions/" + session + "/pairing")
                .exchange((req, res) -> res.getStatusCode().value());
        assertThat(noCsrf).isEqualTo(403);
        var first = pairing(staff, session);
        assertThat(post(staff, "/api/guest/pairing", Map.of("code", first.code())).body()).contains("SEPARATE_BROWSER_REQUIRED");
        var current = pairing(staff, session);
        assertThat(post(guest, "/api/guest/pairing", Map.of("code", first.code())).status()).isEqualTo(400);
        jdbc.update("UPDATE guest_pairing SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE consumed_at IS NULL");
        assertThat(post(guest, "/api/guest/pairing", Map.of("code", current.code())).status()).isEqualTo(400);
        current = pairing(staff, session);
        assertThat(post(guest, "/api/guest/pairing", Map.of("code", current.code())).status()).isEqualTo(200);
        assertThat(post(new BrowserSession(port), "/api/guest/pairing", Map.of("code", current.code())).status()).isEqualTo(400);
        var cookie = guest.cookies.getCookieStore().getCookies().stream().filter(value -> value.getName().equals("GUEST_DEVICE")).findFirst().orElseThrow();
        assertThat(cookie.isHttpOnly()).isTrue(); assertThat(cookie.getPath()).isEqualTo("/api/guest");
        assertThat(jdbc.queryForObject("SELECT token_hash FROM guest_device", String.class)).doesNotContain(cookie.getValue()).hasSize(64);
        assertThat(guest.getStatus("/api/auth/me")).isEqualTo(401);
        assertThat(guest.getStatus("/api/tables")).isEqualTo(401);
        assertThat(post(guest, "/api/staff/sessions/" + session + "/pairing", Map.of()).status()).isEqualTo(401);
    }
    @Test void isolatedVisitsCannotReadWriteOrLookupEachOtherAndClosedExpiredDevicesStopImmediately() {
        var staff = staff(); long one = open(staff, "B01"), two = open(staff, "B02");
        var a = bind(staff, one); var b = bind(staff, two);
        UUID key = UUID.randomUUID();
        assertThat(post(a, path(one), order(key, price(), 2, List.of())).status()).isEqualTo(200);
        assertThat(b.getStatus(path(one))).isEqualTo(403);
        assertThat(b.getStatus(path(one) + "/by-key/" + key)).isEqualTo(403);
        assertThat(post(b, path(one), order(UUID.randomUUID(), price(), 1, List.of())).status()).isEqualTo(403);
        assertThat(a.getStatus(path(two))).isEqualTo(403);
        assertThat(b.client.get().uri(path(two)).retrieve().body(String.class)).isEqualTo("[]");
        assertThat(new BrowserSession(port).getStatus(path(one))).isEqualTo(401);
        jdbc.update("UPDATE table_session SET status = 'CHECKOUT_PENDING' WHERE id = ?", one);
        assertThat(a.getStatus(path(one))).isEqualTo(200);
        assertThat(post(a, path(one), order(UUID.randomUUID(), price(), 1, List.of())).body()).contains("SESSION_NOT_OPEN");
        jdbc.update("UPDATE table_session SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?", one);
        assertThat(a.getStatus("/api/guest/session")).isEqualTo(403);
        assertThat(a.getStatus(path(one))).isEqualTo(403);
        assertThat(post(a, path(one), order(key, price(), 2, List.of())).status()).isEqualTo(403);
        jdbc.update("UPDATE guest_device SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'");
        assertThat(b.getStatus("/api/guest/session")).isEqualTo(401);
        assertThat(count("order_batch")).isEqualTo(1);
    }
    @Test void retriesReturnOriginalSnapshotEvenWhenMenuChangesAndDifferentPayloadConflicts() {
        var staff = staff(); long session = open(staff, "B01"); var guest = bind(staff, session);
        UUID key = UUID.randomUUID(); long original = price(); var body = order(key, original, 2, List.of());
        var first = post(guest, path(session), body);
        assertThat(first.status()).isEqualTo(200);
        jdbc.update("UPDATE menu_item SET price_vnd = price_vnd + 5000, available = false WHERE id = ?", item());
        var repeat = post(guest, path(session), body);
        assertThat(repeat).isEqualTo(first);
        assertThat(guest.client.get().uri(path(session) + "/by-key/" + key).retrieve().body(String.class)).isEqualTo(first.body());
        assertThat(post(guest, path(session), order(key, original, 3, List.of())).body()).contains("IDEMPOTENCY_CONFLICT");
        assertThat(count("order_batch")).isEqualTo(1); assertThat(count("order_item")).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT total_vnd FROM order_batch", Long.class)).isEqualTo(original * 2);
        assertThat(jdbc.queryForObject("SELECT unit_price_vnd FROM order_item", Long.class)).isEqualTo(original);
        var replacement = bind(staff, session);
        assertThat(replacement.client.get().uri(path(session)).retrieve().body(String.class)).contains(first.body());
    }
    @Test void validatesPriceAvailabilityOptionsQuantityAndTotalWithoutPartialWrites() {
        var staff = staff(); long session = open(staff, "B01"); var guest = bind(staff, session);
        assertThat(post(guest, path(session), order(UUID.randomUUID(), 1, 1, List.of())).body()).contains("PRICE_CHANGED");
        assertThat(post(guest, path(session), order(UUID.randomUUID(), price(), 0, List.of())).status()).isEqualTo(400);
        assertThat(post(guest, path(session), order(UUID.randomUUID(), price(), 21, List.of())).status()).isEqualTo(400);
        assertThat(post(guest, path(session), order(UUID.randomUUID(), price(), 1, List.of(123L))).body()).contains("INVALID_ORDER");
        var badNote = new GuestOrderService.Line(item(), 1, price(), List.of(), "x".repeat(301));
        assertThat(post(guest, path(session), new GuestOrderService.Submit(UUID.randomUUID(), List.of(badNote))).status()).isEqualTo(400);
        var invalid = new GuestOrderService.Line(999999L, 1, 100L, List.of(), "");
        assertThat(post(guest, path(session), new GuestOrderService.Submit(UUID.randomUUID(), List.of(order(UUID.randomUUID(), price(), 1, List.of()).items().getFirst(), invalid))).body()).contains("ITEM_UNAVAILABLE");
        jdbc.update("UPDATE menu_item SET available = false WHERE id = ?", item());
        assertThat(post(guest, path(session), order(UUID.randomUUID(), price(), 1, List.of())).body()).contains("ITEM_UNAVAILABLE");
        jdbc.update("UPDATE menu_item SET available = true, price_vnd = 9007199254740991 WHERE id = ?", item());
        assertThat(post(guest, path(session), order(UUID.randomUUID(), price(), 2, List.of())).body()).contains("TOTAL_TOO_LARGE");
        assertThat(count("order_batch")).isZero(); assertThat(count("order_item")).isZero();
        int noCsrf = guest.client.post().uri(path(session)).contentType(MediaType.APPLICATION_JSON).body(order(UUID.randomUUID(), price(), 1, List.of()))
                .exchange((req, res) -> res.getStatusCode().value());
        assertThat(noCsrf).isEqualTo(403);
    }
    @Test void concurrentSameKeyRequestsActuallyWaitOnVisitLockAndCreateOneBatch() throws Exception {
        var staff = staff(); long session = open(staff, "B01"); var one = bind(staff, session); var two = bind(staff, session);
        var body = order(UUID.randomUUID(), price(), 2, List.of());
        try (var blocker = dataSource.getConnection(); var pool = Executors.newFixedThreadPool(2)) {
            blocker.setAutoCommit(false);
            try (var statement = blocker.prepareStatement("SELECT id FROM table_session WHERE id = ? FOR UPDATE")) {
                statement.setLong(1, session); statement.executeQuery().close();
            }
            var ready = new CountDownLatch(2); var gate = new CountDownLatch(1);
            var a = pool.submit(() -> { ready.countDown(); gate.await(); return post(one, path(session), body); });
            var b = pool.submit(() -> { ready.countDown(); gate.await(); return post(two, path(session), body); });
            try {
                assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue(); gate.countDown();
                long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                int waiting;
                do {
                    waiting = jdbc.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE OF s%'", Integer.class);
                    if (waiting >= 2) break;
                    Thread.sleep(30);
                } while (System.nanoTime() < until);
                assertThat(waiting).isGreaterThanOrEqualTo(2);
            } finally { blocker.commit(); }
            var first = a.get(10, TimeUnit.SECONDS); var second = b.get(10, TimeUnit.SECONDS);
            assertThat(first.status()).isEqualTo(200); assertThat(second).isEqualTo(first);
            assertThat(count("order_batch")).isEqualTo(1); assertThat(count("order_item")).isEqualTo(1);
        }
    }
    @Test void failureAfterBatchInsertRollsBackEntireAttemptAndRetryWithSameKeyWorks() {
        var staff = staff(); long session = open(staff, "B01"); var guest = bind(staff, session);
        var body = order(UUID.randomUUID(), price(), 2, List.of());
        jdbc.execute("ALTER TABLE order_item ADD CONSTRAINT test_reject_note CHECK (note <> 'Ít cay')");
        try {
            var result = post(guest, path(session), body);
            assertThat(result.status()).isEqualTo(503); assertThat(result.body()).doesNotContain("test_reject_note", "INSERT INTO", "password");
            assertThat(count("order_batch")).isZero(); assertThat(count("order_item")).isZero();
        } finally { jdbc.execute("ALTER TABLE order_item DROP CONSTRAINT test_reject_note"); }
        assertThat(post(guest, path(session), body).status()).isEqualTo(200);
        assertThat(count("order_batch")).isEqualTo(1);
    }
}
