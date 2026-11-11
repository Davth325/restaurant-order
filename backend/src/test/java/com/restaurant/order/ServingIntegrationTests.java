package com.restaurant.order;

import static org.assertj.core.api.Assertions.assertThat;
import com.restaurant.order.fulfillment.KitchenService;
import com.restaurant.order.fulfillment.ServingService;
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
        "DEMO_KITCHEN_PASSWORD=" + BrowserSession.KITCHEN_PASSWORD,
        "DEMO_STAFF2_PASSWORD=" + BrowserSession.STAFF_PASSWORD,
        "DEMO_MANAGER_PASSWORD=" + BrowserSession.STAFF_PASSWORD })
@ActiveProfiles("demo")
class ServingIntegrationTests {
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
        jdbc.update("UPDATE staff_user SET enabled = true WHERE username IN ('bep', 'nhanvien', 'nhanvien2', 'quanly')");
        jdbc.update("DELETE FROM order_item"); jdbc.update("DELETE FROM order_batch");
        jdbc.update("DELETE FROM guest_device"); jdbc.update("DELETE FROM guest_pairing");
        jdbc.update("DELETE FROM table_session"); jdbc.update("UPDATE restaurant_table SET status = 'AVAILABLE'");
    }

    private BrowserSession staff() { return login("nhanvien", BrowserSession.STAFF_PASSWORD); }
    private BrowserSession second() { return login("nhanvien2", BrowserSession.STAFF_PASSWORD); }
    private BrowserSession manager() { return login("quanly", BrowserSession.STAFF_PASSWORD); }
    private ServingService.Snapshot serving(BrowserSession browser) {
        return browser.client.get().uri("/api/serving/orders").retrieve().body(ServingService.Snapshot.class);
    }
    private List<KitchenService.Unit> ready(Visit visit, int quantity) {
        assertThat(order(visit, quantity).status()).isEqualTo(200);
        var kitchen = kitchen();
        var units = snapshot(kitchen).units().stream().filter(u -> u.sessionId() == visit.session()).toList();
        for (var unit : units) {
            assertThat(move(kitchen, unit.id(), "PREPARING").status()).isEqualTo(204);
            assertThat(move(kitchen, unit.id(), "READY").status()).isEqualTo(204);
        }
        return units;
    }
    private ServingService.Command command(long version, String action, String reason) {
        return new ServingService.Command(UUID.randomUUID(), version, action, reason);
    }
    private Result act(BrowserSession browser, long id, ServingService.Command command) {
        return post(browser, "/api/serving/units/" + id + "/actions", command);
    }
    @Test void receiveServeOneOfThreePersistsActorTimeAndDoesNotChangeOtherTableOrTotals() {
        var visit = visit("B01"); var other = visit("B02");
        var units = ready(visit, 3); assertThat(order(other, 1).status()).isEqualTo(200);
        var staff = staff(); long id = units.getFirst().id();
        var pick = command(2, "PICK_UP", "");
        assertThat(act(staff, id, pick).status()).isEqualTo(204);
        var before = jdbc.queryForMap("SELECT picked_up_by, picked_up_at, version FROM fulfillment_unit WHERE id = ?", id);
        assertThat(before.get("picked_up_by")).isEqualTo(jdbc.queryForObject("SELECT id FROM staff_user WHERE username = 'nhanvien'", Long.class));
        assertThat(before.get("picked_up_at")).isNotNull();
        assertThat(act(staff, id, pick).status()).isEqualTo(204);
        assertThat(jdbc.queryForMap("SELECT picked_up_by, picked_up_at, version FROM fulfillment_unit WHERE id = ?", id)).isEqualTo(before);
        var serve = command(3, "SERVE", ""); assertThat(act(staff, id, serve).status()).isEqualTo(204);
        assertThat(act(staff, id, serve).status()).isEqualTo(204);
        assertThat(serving(staff()).units().stream().map(ServingService.Unit::status)).containsExactly("READY", "READY");
        var saved = serving(manager()).units().getFirst();
        assertThat(saved.pickedUpBy()).isEqualTo("nhanvien"); assertThat(saved.servedAt()).isAfterOrEqualTo(saved.pickedUpAt());
        String guest = visit.guest().client.get().uri("/api/guest/sessions/" + visit.session() + "/orders").retrieve().body(String.class);
        assertThat(guest).contains("PARTIALLY_SERVED", "\"served\":1", "\"ready\":2", "\"totalVnd\":135000");
        assertThat(snapshot(kitchen()).units().stream().filter(u -> u.tableCode().equals("B02")).map(KitchenService.Unit::status)).containsExactly("QUEUED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM serving_operation", Integer.class)).isEqualTo(2);
        assertThat(act(staff, id, command(4, "PICK_UP", "")).status()).isEqualTo(409);
        assertThat(act(staff, id, command(4, "RETURN", "Nhầm")).status()).isEqualTo(409);
    }
    @Test void twoDifferentStaffReallyContendForOnePortionExactlyOneWins() throws Exception {
        var visit = visit("B01"); long id = ready(visit, 3).getFirst().id();
        var a = staff(); var b = second();
        try (var blocker = dataSource.getConnection(); var pool = Executors.newFixedThreadPool(2)) {
            blocker.setAutoCommit(false);
            try (var statement = blocker.prepareStatement("SELECT id FROM table_session WHERE id = ? FOR UPDATE")) {
                statement.setLong(1, visit.session()); statement.executeQuery().close();
            }
            var first = pool.submit(() -> act(a, id, command(2, "PICK_UP", "")));
            var second = pool.submit(() -> act(b, id, command(2, "PICK_UP", "")));
            try {
                long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(10); int waiting;
                do {
                    waiting = jdbc.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE OF s%'", Integer.class);
                    if (waiting >= 2) break; Thread.sleep(30);
                } while (System.nanoTime() < until);
                assertThat(waiting).isGreaterThanOrEqualTo(2);
            } finally { blocker.commit(); }
            int firstStatus = first.get(10, TimeUnit.SECONDS).status(); int secondStatus = second.get(10, TimeUnit.SECONDS).status();
            assertThat(List.of(firstStatus, secondStatus)).containsExactlyInAnyOrder(204, 409);
            assertThat(serving(manager()).units().getFirst().pickedUpBy()).isEqualTo(firstStatus == 204 ? "nhanvien" : "nhanvien2");
            assertThat(serving(firstStatus == 204 ? a : b).units()).hasSize(3);
            assertThat(serving(firstStatus == 204 ? b : a).units()).hasSize(2);
        }
        assertThat(serving(manager()).units().stream().map(ServingService.Unit::status)).containsExactly("PICKED_UP", "READY", "READY");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM serving_operation", Integer.class)).isEqualTo(1);
    }
    @Test void ownerOrManagerCanReturnWithReasonAndStaleRequestsCannotReclaimReturnedPortion() {
        long id = ready(visit("B01"), 1).getFirst().id(); var a = staff(); var b = second(); var manager = manager();
        var pick = command(2, "PICK_UP", ""); assertThat(act(a, id, pick).status()).isEqualTo(204);
        assertThat(act(b, id, command(3, "SERVE", "")).status()).isEqualTo(403);
        assertThat(act(b, id, command(3, "RETURN", "Nhận nhầm")).status()).isEqualTo(403);
        assertThat(act(manager, id, command(3, "SERVE", "")).status()).isEqualTo(403);
        assertThat(act(a, id, command(3, "RETURN", "  ")).status()).isEqualTo(400);
        var giveBack = command(3, "RETURN", "Nhận nhầm bàn");
        assertThat(act(manager, id, giveBack).status()).isEqualTo(204);
        assertThat(act(manager, id, giveBack).status()).isEqualTo(204);
        assertThat(serving(a).units().getFirst().pickedUpBy()).isNull();
        // A replay returns the old receipt; it must not pick it up again after the RETURN.
        assertThat(act(a, id, pick).status()).isEqualTo(204);
        assertThat(serving(a).units().getFirst().status()).isEqualTo("READY");
        assertThat(act(b, id, command(2, "PICK_UP", "")).status()).isEqualTo(409);
        assertThat(act(manager, id, command(4, "PICK_UP", "")).status()).isEqualTo(403);
        assertThat(act(b, id, command(4, "PICK_UP", "")).status()).isEqualTo(204);
        assertThat(act(a, id, command(3, "SERVE", "")).status()).isEqualTo(409);
        assertThat(act(b, id, command(5, "RETURN", "Lấy nhầm suất")).status()).isEqualTo(204);
        String history = manager.client.get().uri("/api/serving/units/" + id + "/history").retrieve().body(String.class);
        assertThat(history).contains("nhanvien", "quanly", "nhanvien2", "Nhận nhầm bàn", "Lấy nhầm suất");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM serving_operation", Integer.class)).isEqualTo(4);
        assertThat(a.getStatus("/api/serving/operations/" + pick.requestKey())).isEqualTo(200);
        assertThat(b.getStatus("/api/serving/operations/" + pick.requestKey())).isEqualTo(403);
        assertThat(a.getStatus("/api/serving/operations/" + UUID.randomUUID())).isEqualTo(404);
        assertThat(act(a, id, new ServingService.Command(pick.requestKey(), 6L, "PICK_UP", "")).body()).contains("IDEMPOTENCY_CONFLICT");
    }
    @Test void roleCsrfEnabledAndActiveVisitAreEnforcedForReadsWritesAndEvents() {
        var visit = visit("B01"); long id = ready(visit, 1).getFirst().id(); var staff = staff();
        for (var browser : List.of(new BrowserSession(port), visit.guest(), kitchen())) {
            int expected = browser.getStatus("/api/auth/me") == 200 ? 403 : 401;
            for (String path : List.of("/api/serving/orders", "/api/serving/events", "/api/serving/units/" + id + "/history"))
                assertThat(browser.getStatus(path)).isEqualTo(expected);
            assertThat(act(browser, id, command(2, "PICK_UP", "")).status()).isEqualTo(expected);
        }
        int noCsrf = staff.client.post().uri("/api/serving/units/" + id + "/actions").contentType(MediaType.APPLICATION_JSON)
                .body(command(2, "PICK_UP", "")).exchange((req, res) -> res.getStatusCode().value());
        assertThat(noCsrf).isEqualTo(403);
        assertThat(act(staff, Long.MAX_VALUE, command(2, "PICK_UP", "")).status()).isEqualTo(404);
        assertThat(act(staff, id, new ServingService.Command(null, 2L, "PICK_UP", "")).status()).isEqualTo(400);
        assertThat(act(staff, id, command(2, "SERVED", "")).status()).isEqualTo(400);
        assertThat(act(staff, id, command(2, "SERVE", "")).status()).isEqualTo(409);
        jdbc.update("UPDATE staff_user SET enabled = false WHERE username = 'nhanvien'");
        assertThat(staff.getStatus("/api/serving/orders")).isEqualTo(403);
        assertThat(staff.getStatus("/api/serving/events")).isEqualTo(403);
        assertThat(act(staff, id, command(2, "PICK_UP", "")).status()).isEqualTo(403);
        jdbc.update("UPDATE staff_user SET enabled = true WHERE username = 'nhanvien'");
        jdbc.update("UPDATE table_session SET status = 'CHECKOUT_PENDING' WHERE id = ?", visit.session());
        assertThat(act(staff, id, command(2, "PICK_UP", "")).status()).isEqualTo(204);
        jdbc.update("UPDATE table_session SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?", visit.session());
        assertThat(act(staff, id, command(3, "SERVE", "")).body()).contains("SESSION_INACTIVE");
        assertThat(serving(staff).units()).isEmpty();
    }
    @Test void journalFailureRollsBackPickupSoRetryDoesNotLosePortion() {
        long id = ready(visit("B01"), 1).getFirst().id(); var staff = staff(); var command = command(2, "PICK_UP", "");
        jdbc.execute("ALTER TABLE serving_operation ADD CONSTRAINT test_reject_pickup CHECK (action <> 'PICK_UP')");
        try {
            var failed = act(staff, id, command); assertThat(failed.status()).isEqualTo(503);
            assertThat(failed.body()).doesNotContain("test_reject_pickup", "INSERT INTO");
            assertThat(serving(staff).units().getFirst().status()).isEqualTo("READY");
            assertThat(serving(staff).units().getFirst().version()).isEqualTo(2);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM serving_operation", Integer.class)).isZero();
        } finally { jdbc.execute("ALTER TABLE serving_operation DROP CONSTRAINT test_reject_pickup"); }
        assertThat(act(staff, id, command).status()).isEqualTo(204);
        assertThat(serving(staff).units().getFirst().status()).isEqualTo("PICKED_UP");
    }
    @Test void serverScopesPickupsToOwnerAndRestrictsServedHistoryToCurrentEnabledManager() {
        var units = ready(visit("B01"), 3); var a = staff(); var b = second(); var manager = manager();
        long first = units.get(0).id(), second = units.get(1).id(), served = units.get(2).id();
        assertThat(act(a, first, command(2, "PICK_UP", "")).status()).isEqualTo(204);
        assertThat(act(b, second, command(2, "PICK_UP", "")).status()).isEqualTo(204);
        assertThat(act(a, served, command(2, "PICK_UP", "")).status()).isEqualTo(204);
        var deliver = command(3, "SERVE", ""); assertThat(act(a, served, deliver).status()).isEqualTo(204);
        assertThat(serving(a).units().stream().map(ServingService.Unit::id)).containsExactly(first);
        assertThat(serving(b).units().stream().map(ServingService.Unit::id)).containsExactly(second);
        assertThat(serving(staff()).units().stream().map(ServingService.Unit::id)).containsExactly(first);
        var forged = a.client.get().uri("/api/serving/orders?role=MANAGER&scope=all").retrieve().body(ServingService.Snapshot.class);
        assertThat(forged.units().stream().map(ServingService.Unit::id)).containsExactly(first);
        assertThat(serving(manager).units().stream().map(ServingService.Unit::status)).containsExactly("PICKED_UP", "PICKED_UP", "SERVED");
        for (var staff : List.of(a, b)) {
            assertThat(staff.getStatus("/api/serving/units/" + first + "/history")).isEqualTo(403);
            assertThat(staff.getStatus("/api/serving/units/" + served + "/history")).isEqualTo(403);
        }
        assertThat(manager.getStatus("/api/serving/units/" + served + "/history")).isEqualTo(200);
        // A served unit leaving the staff workspace must not prevent resolving a lost response.
        assertThat(a.getStatus("/api/serving/operations/" + deliver.requestKey())).isEqualTo(200);
        assertThat(act(a, served, deliver).status()).isEqualTo(204);
        jdbc.update("UPDATE staff_user SET enabled = false WHERE username = 'quanly'");
        assertThat(manager.getStatus("/api/serving/units/" + served + "/history")).isEqualTo(403);
        jdbc.update("UPDATE staff_user SET enabled = true, role = 'STAFF' WHERE username = 'quanly'");
        try {
            // Existing HTTP session still has its old role; service must recheck the database.
            assertThat(manager.getStatus("/api/serving/units/" + served + "/history")).isEqualTo(403);
            assertThat(serving(manager).units()).isEmpty();
        } finally { jdbc.update("UPDATE staff_user SET role = 'MANAGER' WHERE username = 'quanly'"); }
    }
    @Test void upgradeFrom65PreservesKitchenPortionsAndBusinessData() {
        String schema = "serving_upgrade_test";
        try {
            org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").target("6").load().migrate();
            jdbc.execute("""
                    INSERT INTO serving_upgrade_test.restaurant_table(id, code, display_name, area, seats) VALUES (1, 'B01', 'Bàn 01', 'A', 4);
                    INSERT INTO serving_upgrade_test.staff_user(id, username, display_name, password_hash, role) VALUES (1, 'test_staff', 'Test', 'unused', 'STAFF');
                    INSERT INTO serving_upgrade_test.table_session(id, table_id, opened_by) VALUES (1, 1, 1);
                    INSERT INTO serving_upgrade_test.menu_category(id, code, name) VALUES (1, 'MAIN', 'Món');
                    INSERT INTO serving_upgrade_test.menu_item(id, code, category_id, name, price_vnd, image_path) VALUES (1, 'TEST', 1, 'Tên mới', 50000, '/menu-images/test.svg');
                    INSERT INTO serving_upgrade_test.order_batch(id, session_id, request_key, request_hash, total_vnd) VALUES (1, 1, '00000000-0000-0000-0000-000000000001', 'saved-hash', 135000);
                    INSERT INTO serving_upgrade_test.order_item(id, batch_id, menu_item_id, item_name, unit_price_vnd, quantity, note) VALUES (1, 1, 1, 'Tên lúc gọi', 45000, 3, 'Ít cay');
                    INSERT INTO serving_upgrade_test.fulfillment_unit(order_item_id, unit_number, status, started_at, started_by, ready_at, ready_by)
                    VALUES (1, 1, 'READY', CURRENT_TIMESTAMP - INTERVAL '5 minutes', 1, CURRENT_TIMESTAMP, 1),
                           (1, 2, 'PREPARING', CURRENT_TIMESTAMP, 1, NULL, NULL), (1, 3, 'QUEUED', NULL, NULL, NULL, NULL);
                    """);
            var business = jdbc.queryForMap("SELECT * FROM serving_upgrade_test.order_item");
            var batch = jdbc.queryForMap("SELECT * FROM serving_upgrade_test.order_batch");
            batch.put("created_by", null); // V8 preserves old guest batches without inventing a staff actor.
            String columns = "id, order_item_id, unit_number, status, started_at, started_by, ready_at, ready_by";
            var portions = jdbc.queryForList("SELECT " + columns + " FROM serving_upgrade_test.fulfillment_unit ORDER BY unit_number");
            org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").load().migrate();
            assertThat(jdbc.queryForMap("SELECT * FROM serving_upgrade_test.order_item")).isEqualTo(business);
            assertThat(jdbc.queryForMap("SELECT * FROM serving_upgrade_test.order_batch")).isEqualTo(batch);
            assertThat(jdbc.queryForList("SELECT " + columns + " FROM serving_upgrade_test.fulfillment_unit ORDER BY unit_number")).isEqualTo(portions);
            assertThat(jdbc.queryForList("SELECT version FROM serving_upgrade_test.fulfillment_unit", Long.class)).containsOnly(0L);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM serving_upgrade_test.serving_operation", Integer.class)).isZero();
        } finally { jdbc.execute("DROP SCHEMA IF EXISTS serving_upgrade_test CASCADE"); }
    }
    @Test @ExtendWith(OutputCaptureExtension.class)
    void servingSseDeliversCommittedPickupAndClosesAfterLogout(CapturedOutput output) throws Exception {
        long id = ready(visit("B01"), 1).getFirst().id(); var staff = staff();
        try (var http = HttpClient.newBuilder().cookieHandler(staff.cookies).build()) {
            var response = http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/serving/events")).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
            assertThat(response.statusCode()).isEqualTo(200);
            var messages = new LinkedBlockingQueue<String>();
            try (var body = response.body(); var reader = new BufferedReader(new InputStreamReader(body)); var pool = Executors.newSingleThreadExecutor()) {
                var reading = pool.submit(() -> { try { String line; while ((line = reader.readLine()) != null) if (line.startsWith("event:")) messages.add(line); } catch (Exception ignored) {} finally { messages.add("EOF"); } });
                assertThat(messages.poll(5, TimeUnit.SECONDS)).isEqualTo("event:connected");
                assertThat(act(second(), id, command(2, "PICK_UP", "")).status()).isEqualTo(204);
                String event; do { event = messages.poll(5, TimeUnit.SECONDS); } while ("event:heartbeat".equals(event));
                assertThat(event).isEqualTo("event:changed");
                assertThat(serving(staff).units()).isEmpty();
                assertThat(serving(manager()).units().getFirst().pickedUpBy()).isEqualTo("nhanvien2");
                assertThat(staff.logout()).isEqualTo(204);
                assertThat(act(manager(), id, command(3, "RETURN", "Trả khi kết thúc ca")).status()).isEqualTo(204);
                do { event = messages.poll(12, TimeUnit.SECONDS); } while ("event:heartbeat".equals(event));
                assertThat(event).isEqualTo("EOF"); reading.get(5, TimeUnit.SECONDS);
            }
        }
        assertThat(output.getAll()).doesNotContain("AuthorizationDeniedException", "response is already committed");
    }
}
