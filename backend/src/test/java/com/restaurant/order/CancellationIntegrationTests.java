package com.restaurant.order;

import static org.assertj.core.api.Assertions.assertThat;
import com.restaurant.order.ordering.CancellationService;
import com.restaurant.order.ordering.GuestOrderService;
import com.restaurant.order.fulfillment.KitchenService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
        "DEMO_STAFF_PASSWORD=" + BrowserSession.STAFF_PASSWORD, "DEMO_KITCHEN_PASSWORD=" + BrowserSession.KITCHEN_PASSWORD,
        "DEMO_STAFF2_PASSWORD=" + BrowserSession.STAFF_PASSWORD, "DEMO_MANAGER_PASSWORD=" + BrowserSession.STAFF_PASSWORD })
@ActiveProfiles("demo")
class CancellationIntegrationTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    record Result(int status, String body) {}
    record Visit(long id, BrowserSession guest, BrowserSession staff) {}
    private BrowserSession login(String username) {
        var browser = new BrowserSession(port);
        assertThat(browser.login(username, username.equals("bep") ? BrowserSession.KITCHEN_PASSWORD : BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
        return browser;
    }
    private Result post(BrowserSession browser, String path, Object body) {
        var csrf = browser.csrf();
        return browser.client.post().uri(path).contentType(MediaType.APPLICATION_JSON)
                .header(csrf.get("headerName").toString(), csrf.get("token").toString()).body(body)
                .exchange((req, res) -> new Result(res.getStatusCode().value(), res.bodyTo(String.class)));
    }
    private Visit visit(String code) {
        var staff = login("nhanvien");
        long table = jdbc.queryForObject("SELECT id FROM restaurant_table WHERE code = ?", Long.class, code);
        assertThat(post(staff, "/api/tables/" + table + "/sessions", Map.of()).status()).isEqualTo(201);
        long id = jdbc.queryForObject("SELECT id FROM table_session WHERE table_id = ?", Long.class, table);
        var csrf = staff.csrf();
        var pairing = staff.client.post().uri("/api/staff/sessions/" + id + "/pairing")
                .header(csrf.get("headerName").toString(), csrf.get("token").toString()).retrieve().body(GuestOrderService.Pairing.class);
        var guest = new BrowserSession(port);
        assertThat(post(guest, "/api/guest/pairing", Map.of("code", pairing.code())).status()).isEqualTo(200);
        return new Visit(id, guest, staff);
    }
    private String orders(Visit visit) { return "/api/guest/sessions/" + visit.id() + "/orders"; }
    private String cancellations(Visit visit) { return "/api/guest/sessions/" + visit.id() + "/cancellations"; }
    private GuestOrderService.Submit batch(UUID key, int quantity) {
        long item = jdbc.queryForObject("SELECT id FROM menu_item WHERE code = 'GOI_CUON'", Long.class);
        return new GuestOrderService.Submit(key, List.of(new GuestOrderService.Line(item, quantity, 45000L, List.of(), "Gọi thêm")));
    }
    private List<Long> submit(Visit visit, int quantity) {
        assertThat(post(visit.guest(), orders(visit), batch(UUID.randomUUID(), quantity)).status()).isEqualTo(200);
        return jdbc.queryForList("SELECT u.id FROM fulfillment_unit u JOIN order_item i ON i.id = u.order_item_id JOIN order_batch b ON b.id = i.batch_id WHERE b.session_id = ? ORDER BY u.id", Long.class, visit.id());
    }
    private Result cancel(Visit visit, CancellationService.GuestCancellation command) {
        return post(visit.guest(), cancellations(visit) + "/cancel", command);
    }
    private CancellationService.GuestCancellation cancellation(long id) {
        return new CancellationService.GuestCancellation(UUID.randomUUID(), id);
    }
    private CancellationService.Command command(long id, long version, String action, UUID request) {
        return new CancellationService.Command(UUID.randomUUID(), id, version, action, request, "Đã kiểm tra với bếp");
    }
    private Result act(BrowserSession actor, CancellationService.Command command) { return post(actor, "/api/cancellations/actions", command); }
    private long net(Visit visit) {
        return java.util.Arrays.stream(visit.guest().client.get().uri(orders(visit)).retrieve().body(GuestOrderService.Batch[].class)).mapToLong(GuestOrderService.Batch::netTotalVnd).sum();
    }
    private String state(long id) { return jdbc.queryForObject("SELECT status FROM fulfillment_unit WHERE id = ?", String.class, id); }
    @AfterEach void cleanup() {
        jdbc.update("DELETE FROM order_item"); jdbc.update("DELETE FROM order_batch"); jdbc.update("DELETE FROM guest_device");
        jdbc.update("DELETE FROM guest_pairing"); jdbc.update("DELETE FROM table_session"); jdbc.update("UPDATE restaurant_table SET status = 'AVAILABLE'");
        jdbc.update("UPDATE staff_user SET enabled = true, role = 'MANAGER' WHERE username = 'quanly'");
        jdbc.update("UPDATE staff_user SET enabled = true WHERE username = 'nhanvien'");
    }
    @Test void multipleBatchesAndStaffOrderingKeepHistoryActorAndIdempotency() {
        var visit = visit("B01"); submit(visit, 2);
        String staffPath = "/api/staff/sessions/" + visit.id() + "/orders";
        var body = batch(UUID.randomUUID(), 3);
        var first = post(visit.staff(), staffPath, body);
        assertThat(first.status()).isEqualTo(200); assertThat(post(visit.staff(), staffPath, body)).isEqualTo(first);
        assertThat(post(login("nhanvien2"), staffPath, body).body()).contains("IDEMPOTENCY_CONFLICT");
        assertThat(post(visit.guest(), orders(visit), body).body()).contains("IDEMPOTENCY_CONFLICT");
        assertThat(post(visit.staff(), staffPath, batch(body.requestKey(), 4)).body()).contains("IDEMPOTENCY_CONFLICT");
        assertThat(visit.staff().getStatus(staffPath + "/by-key/" + body.requestKey())).isEqualTo(200);
        assertThat(login("bep").getStatus(staffPath)).isEqualTo(403);
        assertThat(visit.guest().getStatus(staffPath)).isEqualTo(401);
        assertThat(login("quanly").getStatus(staffPath)).isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM order_batch", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT a.username FROM order_batch b JOIN staff_user a ON a.id = b.created_by", String.class)).isEqualTo("nhanvien");
        assertThat(net(visit)).isEqualTo(225000);
        assertThat(login("nhanvien").client.get().uri(staffPath).retrieve().body(GuestOrderService.Batch[].class)).hasSize(2);
        jdbc.update("UPDATE table_session SET status = 'CHECKOUT_PENDING' WHERE id = ?", visit.id());
        assertThat(post(visit.staff(), staffPath, body).status()).isEqualTo(200);
        assertThat(post(visit.staff(), staffPath, batch(UUID.randomUUID(), 1)).body()).contains("SESSION_NOT_OPEN");
    }
    @Test void guestCancelsOnlyOneQueuedPortionAndCanRecoverReceiptWithoutApproval() {
        var visit = visit("B01");
        var ids = submit(visit, 3);
        var cancel = cancellation(ids.getFirst());
        assertThat(net(visit)).isEqualTo(135000);
        assertThat(post(visit.guest(), cancellations(visit), Map.of("requestKey", cancel.requestKey(), "unitId", cancel.unitId(), "reason", "Cũ")).status()).isEqualTo(405);
        assertThat(state(cancel.unitId())).isEqualTo("QUEUED");
        assertThat(cancel(visit, cancel).status()).isEqualTo(200);
        assertThat(cancel(visit, cancel).status()).isEqualTo(200);
        assertThat(cancel(visit, new CancellationService.GuestCancellation(cancel.requestKey(), ids.get(1))).body()).contains("IDEMPOTENCY_CONFLICT");
        assertThat(cancel(visit, cancellation(cancel.unitId())).status()).isEqualTo(409);
        assertThat(net(visit)).isEqualTo(90000);
        assertThat(jdbc.queryForObject("SELECT total_vnd FROM order_batch", Long.class)).isEqualTo(135000);
        assertThat(state(cancel.unitId())).isEqualTo("CANCELLED");
        assertThat(state(ids.get(1))).isEqualTo("QUEUED");
        assertThat(jdbc.queryForObject("SELECT version FROM fulfillment_unit WHERE id = ?", Long.class, cancel.unitId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM guest_cancellation", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM cancellation_request", Integer.class)).isZero();
        assertThat(visit.guest().getStatus(cancellations(visit) + "/cancel/by-key/" + cancel.requestKey())).isEqualTo(200);
        assertThat(visit.staff().getStatus("/api/cancellations/units")).isEqualTo(403);
        var manager = login("quanly");
        assertThat(manager.client.get().uri("/api/cancellations/units/" + cancel.unitId() + "/history").retrieve().body(String.class)).contains("GUEST_CANCEL", "Khách");
        var kitchen = login("bep");
        var snapshot = kitchen.client.get().uri("/api/kitchen/orders").retrieve().body(KitchenService.Snapshot.class);
        assertThat(snapshot.units().getFirst().guestCancelled()).isTrue();
        assertThat(post(kitchen, "/api/kitchen/units/" + cancel.unitId() + "/status", Map.of("status","PREPARING")).status()).isEqualTo(409);
    }

    @Test void guestCannotCancelOnceKitchenStartsAndManagerAdjustmentsRequireReasonAndRole() {
        var visit = visit("B01");
        var ids = submit(visit, 4);
        var kitchen = login("bep");
        var manager = login("quanly");
        for (int index = 0; index < ids.size(); index++) {
            long id = ids.get(index);
            assertThat(post(kitchen, "/api/kitchen/units/" + id + "/status", Map.of("status","PREPARING")).status()).isEqualTo(204);
            if (index > 0) assertThat(post(kitchen, "/api/kitchen/units/" + id + "/status", Map.of("status","READY")).status()).isEqualTo(204);
            if (index > 1) assertThat(post(visit.staff(), "/api/serving/units/" + id + "/actions", Map.of("requestKey",UUID.randomUUID(),"version",2,"action","PICK_UP","reason","")).status()).isEqualTo(204);
            if (index == 3) assertThat(post(visit.staff(), "/api/serving/units/" + id + "/actions", Map.of("requestKey",UUID.randomUUID(),"version",3,"action","SERVE","reason","")).status()).isEqualTo(204);
            String current = List.of("PREPARING", "READY", "PICKED_UP", "SERVED").get(index);
            long previousNet = net(visit);
            assertThat(cancel(visit, cancellation(id)).body()).contains("UNIT_STATE_CONFLICT");
            assertThat(net(visit)).isEqualTo(previousNet);
            assertThat(state(id)).isEqualTo(current);
            String action = index == 3 ? "EXCLUDE" : "CANCEL";
            var adjustment = command(id, index + 1, action, null);
            assertThat(act(visit.staff(), adjustment).status()).isEqualTo(403);
            assertThat(act(manager, new CancellationService.Command(UUID.randomUUID(), id, (long) index + 1, action, null, " ")).status()).isEqualTo(400);
            assertThat(act(manager, adjustment).status()).isEqualTo(200);
            assertThat(act(manager, adjustment).status()).isEqualTo(200);
            assertThat(state(id)).isEqualTo(index == 3 ? "SERVED" : "CANCELLED");
        }
        assertThat(net(visit)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM guest_cancellation", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM cancellation_operation", Integer.class)).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM serving_operation", Integer.class)).isEqualTo(3);
    }
    @Test void cancellationAndKitchenStartActuallyContendOnSameVisitAndOnlyOneWins() throws Exception {
        var visit = visit("B01"); long id = submit(visit, 1).getFirst(); var request = cancellation(id); var kitchen = login("bep");
        try (var blocker = dataSource.getConnection(); var pool = Executors.newFixedThreadPool(2)) {
            blocker.setAutoCommit(false);
            try (var statement = blocker.prepareStatement("SELECT id FROM table_session WHERE id = ? FOR UPDATE")) { statement.setLong(1, visit.id()); statement.executeQuery().close(); }
            var cancel = pool.submit(() -> cancel(visit, request));
            var start = pool.submit(() -> post(kitchen, "/api/kitchen/units/" + id + "/status", Map.of("status","PREPARING")));
            int waiting = 0;
            try {
                long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                do { waiting = jdbc.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE OF s%'", Integer.class); if (waiting >= 2) break; Thread.sleep(30); } while (System.nanoTime() < until);
                assertThat(waiting).isGreaterThanOrEqualTo(2);
            } finally { blocker.commit(); }
            var a = cancel.get(10, TimeUnit.SECONDS); var b = start.get(10, TimeUnit.SECONDS);
            if (a.status() == 200) { assertThat(b.status()).isEqualTo(409); assertThat(state(id)).isEqualTo("CANCELLED"); assertThat(net(visit)).isZero(); }
            else { assertThat(a.status()).isEqualTo(409); assertThat(b.status()).isEqualTo(204); assertThat(state(id)).isEqualTo("PREPARING"); assertThat(net(visit)).isEqualTo(45000); assertThat(cancel(visit, request).status()).isEqualTo(409); }
        }
    }
    @Test void guestAuthorizationAndReceiptFailureCannotChangeTheSubtotal() {
        var a = visit("B01");
        var b = visit("B02");
        long id = submit(a, 1).getFirst();
        var request = cancellation(id);
        String endpoint = cancellations(a) + "/cancel";
        assertThat(cancel(b, request).status()).isEqualTo(403);
        assertThat(post(b.guest(), endpoint, request).status()).isEqualTo(403);
        assertThat(post(a.staff(), endpoint, request).status()).isEqualTo(401);
        int missingCsrf = a.guest().client.post().uri(endpoint).contentType(MediaType.APPLICATION_JSON).body(request)
                .exchange((req, res) -> res.getStatusCode().value());
        assertThat(missingCsrf).isEqualTo(403);
        jdbc.execute("ALTER TABLE guest_cancellation ADD CONSTRAINT test_reject_guest_cancel CHECK (false)");
        try {
            assertThat(cancel(a, request).status()).isEqualTo(503);
            assertThat(state(id)).isEqualTo("QUEUED");
            assertThat(net(a)).isEqualTo(45000);
            assertThat(jdbc.queryForObject("SELECT version FROM fulfillment_unit WHERE id = ?", Long.class, id)).isZero();
        } finally {
            jdbc.execute("ALTER TABLE guest_cancellation DROP CONSTRAINT test_reject_guest_cancel");
        }
        assertThat(cancel(a, request).status()).isEqualTo(200);
        assertThat(b.guest().getStatus(cancellations(b) + "/cancel/by-key/" + request.requestKey())).isEqualTo(404);
        jdbc.update("UPDATE table_session SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?", a.id());
        assertThat(cancel(a, request).status()).isEqualTo(403);
        assertThat(a.guest().getStatus(cancellations(a))).isEqualTo(403);
    }
    @Test void approvalIsRetiredAndManagerDirectActionsRemainStateLimited() {
        var visit = visit("B01");
        long queued = submit(visit, 1).getFirst();
        var manager = login("quanly");
        assertThat(act(manager, command(queued, 0, "APPROVE", UUID.randomUUID())).body()).contains("APPROVAL_RETIRED");
        assertThat(act(manager, command(queued, 0, "REJECT", UUID.randomUUID())).status()).isEqualTo(409);
        assertThat(act(manager, command(queued, 0, "EXCLUDE", null)).status()).isEqualTo(403);
        assertThat(state(queued)).isEqualTo("QUEUED");
        assertThat(net(visit)).isEqualTo(45000);
        jdbc.update("UPDATE staff_user SET enabled = false WHERE username = 'quanly'");
        assertThat(act(manager, command(queued, 0, "CANCEL", null)).status()).isEqualTo(403);
        assertThat(manager.getStatus("/api/cancellations/units")).isEqualTo(403);
    }
    @Test void migrationFrom66PreservesServedAndPickedUpActorsTimesPricesAndVersions() {
        String schema = "cancellation_upgrade_test";
        try {
            org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").target("7").load().migrate();
            jdbc.execute("""
                    INSERT INTO cancellation_upgrade_test.restaurant_table(id,code,display_name,area,seats) VALUES (1,'B01','Bàn 01','A',4);
                    INSERT INTO cancellation_upgrade_test.staff_user(id,username,display_name,password_hash,role) VALUES (1,'staff','Test','unused','STAFF');
                    INSERT INTO cancellation_upgrade_test.table_session(id,table_id,opened_by) VALUES (1,1,1);
                    INSERT INTO cancellation_upgrade_test.menu_category(id,code,name) VALUES (1,'MAIN','Món');
                    INSERT INTO cancellation_upgrade_test.menu_item(id,code,category_id,name,price_vnd,image_path) VALUES (1,'TEST',1,'Tên mới',50000,'/menu-images/test.svg');
                    INSERT INTO cancellation_upgrade_test.order_batch(id,session_id,request_key,request_hash,total_vnd) VALUES (1,1,'00000000-0000-0000-0000-000000000001','saved-hash',135000);
                    INSERT INTO cancellation_upgrade_test.order_item(id,batch_id,menu_item_id,item_name,unit_price_vnd,quantity,note) VALUES (1,1,1,'Tên lúc gọi',45000,3,'Ít cay');
                    INSERT INTO cancellation_upgrade_test.fulfillment_unit(order_item_id,unit_number,status,version,started_at,started_by,ready_at,ready_by,picked_up_at,picked_up_by,served_at,served_by)
                    VALUES (1,1,'SERVED',4,CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP,1),
                           (1,2,'PICKED_UP',3,CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP,1,NULL,NULL),
                           (1,3,'QUEUED',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
                    """);
            var before = jdbc.queryForList("SELECT * FROM " + schema + ".fulfillment_unit ORDER BY id");
            before.forEach(row -> row.put("bill_excluded", false));
            var batch = jdbc.queryForMap("SELECT * FROM " + schema + ".order_batch"); batch.put("created_by", null);
            org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration").target("9").load().migrate();
            jdbc.execute("""
                    INSERT INTO cancellation_upgrade_test.guest_device(token_hash, session_id, expires_at)
                    VALUES ('test-guest-hash', 1, CURRENT_TIMESTAMP + INTERVAL '1 hour');
                    INSERT INTO cancellation_upgrade_test.cancellation_request(request_key, unit_id, requested_by, reason)
                    SELECT '00000000-0000-0000-0000-000000000002', id, 'test-guest-hash', 'Yêu cầu cũ'
                    FROM cancellation_upgrade_test.fulfillment_unit WHERE unit_number = 3;
                    """);
            org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).locations("classpath:db/migration").load().migrate();
            assertThat(jdbc.queryForObject("SELECT status FROM " + schema + ".cancellation_request", String.class)).isEqualTo("SUPERSEDED");
            assertThat(jdbc.queryForObject("SELECT reason FROM " + schema + ".cancellation_request", String.class)).isEqualTo("Yêu cầu cũ");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".guest_cancellation", Integer.class)).isZero();
            assertThat(jdbc.queryForList("SELECT * FROM " + schema + ".fulfillment_unit ORDER BY id")).isEqualTo(before);
            assertThat(jdbc.queryForMap("SELECT * FROM " + schema + ".order_batch")).isEqualTo(batch);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".cancellation_operation", Integer.class)).isZero();
        } finally { jdbc.execute("DROP SCHEMA IF EXISTS cancellation_upgrade_test CASCADE"); }
    }
}
