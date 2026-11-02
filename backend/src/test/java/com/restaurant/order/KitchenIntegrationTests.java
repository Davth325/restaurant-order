package com.restaurant.order;

import static org.assertj.core.api.Assertions.assertThat;
import com.restaurant.order.fulfillment.KitchenService;
import com.restaurant.order.ordering.GuestOrderService;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DEMO_STAFF_PASSWORD=" + BrowserSession.STAFF_PASSWORD,
        "DEMO_KITCHEN_PASSWORD=" + BrowserSession.KITCHEN_PASSWORD })
@ActiveProfiles("demo")
class KitchenIntegrationTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    record Result(int status, String body) {}
    record Visit(long session, BrowserSession guest) {}
    private BrowserSession login(String username, String password) {
        var browser = new BrowserSession(port);
        assertThat(browser.login(username, password)).isEqualTo(204); return browser;
    }
    private BrowserSession kitchen() { return login("bep", BrowserSession.KITCHEN_PASSWORD); }
    private Result post(BrowserSession browser, String path, Object body) {
        var csrf = browser.csrf();
        return browser.client.post().uri(path).contentType(MediaType.APPLICATION_JSON)
                .header(csrf.get("headerName").toString(), csrf.get("token").toString()).body(body)
                .exchange((req, res) -> new Result(res.getStatusCode().value(), res.bodyTo(String.class)));
    }
    private Visit visit(String code) {
        var staff = login("nhanvien", BrowserSession.STAFF_PASSWORD);
        long table = jdbc.queryForObject("SELECT id FROM restaurant_table WHERE code = ?", Long.class, code);
        assertThat(post(staff, "/api/tables/" + table + "/sessions", Map.of()).status()).isEqualTo(201);
        long id = jdbc.queryForObject("SELECT id FROM table_session WHERE table_id = ? AND status = 'OPEN'", Long.class, table);
        var csrf = staff.csrf();
        var pairing = staff.client.post().uri("/api/staff/sessions/" + id + "/pairing")
                .header(csrf.get("headerName").toString(), csrf.get("token").toString()).retrieve().body(GuestOrderService.Pairing.class);
        var guest = new BrowserSession(port);
        assertThat(post(guest, "/api/guest/pairing", Map.of("code", pairing.code())).status()).isEqualTo(200);
        return new Visit(id, guest);
    }
    private Result order(Visit visit, int quantity) {
        long item = jdbc.queryForObject("SELECT id FROM menu_item WHERE code = 'GOI_CUON'", Long.class);
        long price = jdbc.queryForObject("SELECT price_vnd FROM menu_item WHERE id = ?", Long.class, item);
        return post(visit.guest(), "/api/guest/sessions/" + visit.session() + "/orders", new GuestOrderService.Submit(UUID.randomUUID(),
                List.of(new GuestOrderService.Line(item, quantity, price, List.of(), "Không ớt\nĐể sốt riêng"))));
    }
    private KitchenService.Snapshot snapshot(BrowserSession browser) {
        return browser.client.get().uri("/api/kitchen/orders").retrieve().body(KitchenService.Snapshot.class);
    }
    private String path(long unit) { return "/api/kitchen/units/" + unit + "/status"; }
    private Result move(BrowserSession browser, long unit, String state) { return post(browser, path(unit), Map.of("status", state)); }
    @AfterEach void cleanup() {
        jdbc.update("UPDATE staff_user SET enabled = true WHERE username = 'bep'");
        jdbc.update("DELETE FROM order_item"); jdbc.update("DELETE FROM order_batch");
        jdbc.update("DELETE FROM guest_device"); jdbc.update("DELETE FROM guest_pairing");
        jdbc.update("DELETE FROM table_session"); jdbc.update("UPDATE restaurant_table SET status = 'AVAILABLE'");
    }

    @Test void threePortionsKeepTableBatchNoteAndPartialProgressAcrossNewSessions() {
        var one = visit("B01"); var two = visit("B02"); var kitchen = kitchen();
        assertThat(order(one, 3).status()).isEqualTo(200); assertThat(order(two, 1).status()).isEqualTo(200);
        assertThat(order(one, 1).status()).isEqualTo(200);
        var initial = snapshot(kitchen);
        assertThat(initial.units()).hasSize(5);
        var first = initial.units().getFirst();
        assertThat(first.tableCode()).isEqualTo("B01"); assertThat(first.batchNumber()).isEqualTo(1);
        assertThat(first.quantity()).isEqualTo(3); assertThat(first.note()).isEqualTo("Không ớt\nĐể sốt riêng");
        assertThat(first.createdAt()).isNotNull();
        assertThat(initial.units().getLast().batchNumber()).isEqualTo(2);
        assertThat(move(kitchen, first.id(), "READY").status()).isEqualTo(409);
        assertThat(move(kitchen, first.id(), "PREPARING").status()).isEqualTo(204);
        var started = jdbc.queryForMap("SELECT started_at, started_by FROM fulfillment_unit WHERE id = ?", first.id());
        assertThat(move(kitchen, first.id(), "PREPARING").status()).isEqualTo(204);
        assertThat(jdbc.queryForMap("SELECT started_at, started_by FROM fulfillment_unit WHERE id = ?", first.id())).isEqualTo(started);
        assertThat(move(kitchen, first.id(), "READY").status()).isEqualTo(204);
        var ready = jdbc.queryForMap("SELECT ready_at, ready_by FROM fulfillment_unit WHERE id = ?", first.id());
        assertThat(move(kitchen, first.id(), "READY").status()).isEqualTo(204);
        assertThat(jdbc.queryForMap("SELECT ready_at, ready_by FROM fulfillment_unit WHERE id = ?", first.id())).isEqualTo(ready);
        assertThat(move(kitchen, first.id(), "PREPARING").body()).contains("UNIT_STATE_CONFLICT");
        assertThat(snapshot(kitchen()).units().stream().filter(u -> u.batchId() == first.batchId()).map(KitchenService.Unit::status))
                .containsExactly("READY", "QUEUED", "QUEUED");
        String guestOrders = one.guest().client.get().uri("/api/guest/sessions/" + one.session() + "/orders").retrieve().body(String.class);
        assertThat(guestOrders).contains("PARTIALLY_READY", "\"ready\":1", "\"queued\":2");
        assertThat(snapshot(kitchen).units().stream().filter(u -> u.tableCode().equals("B02")).map(KitchenService.Unit::status)).containsExactly("QUEUED");
    }

    @Test void kitchenRoleCsrfCurrentAccountAndVisitAreCheckedOnBackend() {
        var visit = visit("B01"); assertThat(order(visit, 3).status()).isEqualTo(200);
        var kitchen = kitchen(); long unit = snapshot(kitchen).units().getFirst().id();
        for (var browser : List.of(new BrowserSession(port), visit.guest(), login("nhanvien", BrowserSession.STAFF_PASSWORD))) {
            int expected = browser.getStatus("/api/auth/me") == 200 ? 403 : 401;
            assertThat(browser.getStatus("/api/kitchen/orders")).isEqualTo(expected);
            assertThat(browser.getStatus("/api/kitchen/events")).isEqualTo(expected);
            assertThat(move(browser, unit, "PREPARING").status()).isEqualTo(expected);
        }
        int noCsrf = kitchen.client.post().uri(path(unit)).contentType(MediaType.APPLICATION_JSON).body(Map.of("status", "PREPARING"))
                .exchange((req, res) -> res.getStatusCode().value());
        assertThat(noCsrf).isEqualTo(403);
        assertThat(move(kitchen, unit, "SERVED").status()).isEqualTo(400);
        assertThat(move(kitchen, Long.MAX_VALUE, "PREPARING").status()).isEqualTo(404);
        jdbc.update("UPDATE staff_user SET enabled = false WHERE username = 'bep'");
        assertThat(kitchen.getStatus("/api/kitchen/orders")).isEqualTo(403);
        assertThat(kitchen.getStatus("/api/kitchen/events")).isEqualTo(403);
        assertThat(move(kitchen, unit, "PREPARING").status()).isEqualTo(403);
        jdbc.update("UPDATE staff_user SET enabled = true WHERE username = 'bep'");
        jdbc.update("UPDATE table_session SET status = 'CHECKOUT_PENDING' WHERE id = ?", visit.session());
        assertThat(move(kitchen, unit, "PREPARING").status()).isEqualTo(204);
        jdbc.update("UPDATE table_session SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?", visit.session());
        assertThat(move(kitchen, unit, "READY").body()).contains("SESSION_INACTIVE");
        assertThat(snapshot(kitchen).units()).isEmpty();
    }

    @Test void twoRealKitchenSessionsContendOnSameUnitWithoutAdvancingAnotherPortion() throws Exception {
        var visit = visit("B01"); assertThat(order(visit, 3).status()).isEqualTo(200);
        var a = kitchen(); var b = kitchen(); long unit = snapshot(a).units().getFirst().id();
        for (String target : List.of("PREPARING", "READY")) {
            try (var blocker = dataSource.getConnection(); var pool = Executors.newFixedThreadPool(2)) {
                blocker.setAutoCommit(false);
                try (var statement = blocker.prepareStatement("SELECT id FROM table_session WHERE id = ? FOR UPDATE")) {
                    statement.setLong(1, visit.session()); statement.executeQuery().close();
                }
                var first = pool.submit(() -> move(a, unit, target));
                var second = pool.submit(() -> move(b, unit, target));
                try {
                    long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(10); int waiting;
                    do {
                        waiting = jdbc.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE OF s%'", Integer.class);
                        if (waiting >= 2) break;
                        Thread.sleep(30);
                    } while (System.nanoTime() < until);
                    assertThat(waiting).isGreaterThanOrEqualTo(2);
                } finally { blocker.commit(); }
                assertThat(first.get(10, TimeUnit.SECONDS).status()).isEqualTo(204);
                assertThat(second.get(10, TimeUnit.SECONDS).status()).isEqualTo(204);
            }
        }
        assertThat(snapshot(a).units().stream().map(KitchenService.Unit::status)).containsExactly("READY", "QUEUED", "QUEUED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM fulfillment_unit", Integer.class)).isEqualTo(3);
    }

    @Test void failureCreatingUnitsRollsBackBatchAndAllItems() {
        var visit = visit("B01");
        jdbc.execute("ALTER TABLE fulfillment_unit ADD CONSTRAINT test_reject_second CHECK (unit_number <> 2)");
        try {
            var result = order(visit, 3);
            assertThat(result.status()).isEqualTo(503);
            assertThat(result.body()).doesNotContain("test_reject_second", "INSERT INTO");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM order_batch", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM order_item", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM fulfillment_unit", Integer.class)).isZero();
        } finally { jdbc.execute("ALTER TABLE fulfillment_unit DROP CONSTRAINT test_reject_second"); }
        assertThat(order(visit, 3).status()).isEqualTo(200);
    }

    @Test void migrationUpgradesExisting64OrdersWithoutChangingTheirBusinessData() {
        String schema = "kitchen_upgrade_test";
        try {
            org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").target("5").load().migrate();
            jdbc.execute("""
                    INSERT INTO kitchen_upgrade_test.restaurant_table(id, code, display_name, area, seats) VALUES (1, 'B01', 'Bàn 01', 'A', 4);
                    INSERT INTO kitchen_upgrade_test.staff_user(id, username, display_name, password_hash, role) VALUES (1, 'test_staff', 'Test', 'unused', 'STAFF');
                    INSERT INTO kitchen_upgrade_test.table_session(id, table_id, opened_by) VALUES (1, 1, 1);
                    INSERT INTO kitchen_upgrade_test.menu_category(id, code, name) VALUES (1, 'MAIN', 'Món');
                    INSERT INTO kitchen_upgrade_test.menu_item(id, code, category_id, name, price_vnd, image_path) VALUES (1, 'TEST', 1, 'Tên mới', 50000, '/menu-images/test.svg');
                    INSERT INTO kitchen_upgrade_test.order_batch(id, session_id, request_key, request_hash, total_vnd) VALUES (1, 1, '00000000-0000-0000-0000-000000000001', 'saved-hash', 135000);
                    INSERT INTO kitchen_upgrade_test.order_item(id, batch_id, menu_item_id, item_name, unit_price_vnd, quantity, note) VALUES (1, 1, 1, 'Tên lúc gọi', 45000, 3, 'Ít cay');
                    """);
            var before = jdbc.queryForMap("SELECT id, batch_id, menu_item_id, item_name, unit_price_vnd, quantity, note FROM kitchen_upgrade_test.order_item");
            var batch = jdbc.queryForMap("SELECT * FROM kitchen_upgrade_test.order_batch");
            org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").load().migrate();
            assertThat(jdbc.queryForMap("SELECT * FROM kitchen_upgrade_test.order_item")).isEqualTo(before);
            assertThat(jdbc.queryForMap("SELECT * FROM kitchen_upgrade_test.order_batch")).isEqualTo(batch);
            assertThat(jdbc.queryForList("SELECT unit_number FROM kitchen_upgrade_test.fulfillment_unit ORDER BY unit_number", Integer.class)).containsExactly(1, 2, 3);
            assertThat(jdbc.queryForList("SELECT status FROM kitchen_upgrade_test.fulfillment_unit", String.class)).containsOnly("QUEUED");
        } finally { jdbc.execute("DROP SCHEMA IF EXISTS kitchen_upgrade_test CASCADE"); }
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void sseRequiresKitchenAndNotifiesOnlyCommittedChangesThenStopsAfterLogout(CapturedOutput output) throws Exception {
        var kitchen = kitchen(); var visit = visit("B01");
        try (var http = HttpClient.newBuilder().cookieHandler(kitchen.cookies).build()) {
            var response = http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/kitchen/events")).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.headers().firstValue("content-type").orElse("")).contains("text/event-stream");
            var messages = new LinkedBlockingQueue<String>();
            try (var body = response.body(); var reader = new BufferedReader(new InputStreamReader(body)); var pool = Executors.newSingleThreadExecutor()) {
                var reading = pool.submit(() -> { try { String line; while ((line = reader.readLine()) != null) if (line.startsWith("event:")) messages.add(line); } catch (Exception ignored) { } finally { messages.add("EOF"); } });
                assertThat(messages.poll(5, TimeUnit.SECONDS)).isEqualTo("event:connected");
                assertThat(order(visit, 3).status()).isEqualTo(200);
                String event;
                do { event = messages.poll(5, TimeUnit.SECONDS); } while ("event:heartbeat".equals(event));
                assertThat(event).isEqualTo("event:changed");
                var saved = snapshot(kitchen); assertThat(saved.units()).hasSize(3);
                assertThat(move(kitchen, saved.units().getFirst().id(), "PREPARING").status()).isEqualTo(204);
                do { event = messages.poll(5, TimeUnit.SECONDS); } while ("event:heartbeat".equals(event));
                assertThat(event).isEqualTo("event:changed");
                assertThat(kitchen.logout()).isEqualTo(204);
                // A change after logout must not deliver an invalidation to the old stream.
                assertThat(order(visit, 1).status()).isEqualTo(200);
                do { event = messages.poll(12, TimeUnit.SECONDS); } while ("event:heartbeat".equals(event));
                assertThat(event).isEqualTo("EOF");
                reading.get(5, TimeUnit.SECONDS);
                assertThat(output.getAll()).doesNotContain("AuthorizationDeniedException", "response is already committed");
            }
        }
    }
}
