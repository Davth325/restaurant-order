package com.restaurant.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.restaurant.order.dining.TableSnapshot;
import com.restaurant.order.dining.TableView;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
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
class TableSessionIntegrationTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired Flyway flyway;
    @Autowired DataSource dataSource;

    private long id(String code) {
        return jdbc.queryForObject("SELECT id FROM restaurant_table WHERE code = ?", Long.class, code);
    }

    private BrowserSession staff() {
        var session = new BrowserSession(port);
        assertThat(session.login("nhanvien", BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
        return session;
    }

    private int open(BrowserSession session, long tableId) {
        var csrf = session.csrf();
        return session.client.post().uri("/api/tables/" + tableId + "/sessions")
                .header(csrf.get("headerName").toString(), csrf.get("token").toString())
                .exchange((request, response) -> response.getStatusCode().value());
    }

    private TableView table(BrowserSession session, String code) {
        return session.client.get().uri("/api/tables/" + id(code)).retrieve().body(TableView.class);
    }

    @AfterEach
    void cleanup() {
        // Only the isolated Testcontainers database; never touches the demo volume.
        jdbc.update("DELETE FROM table_session");
        jdbc.update("UPDATE restaurant_table SET status = 'AVAILABLE'");
        jdbc.update("DELETE FROM staff_user WHERE username = 'staff_two'");
    }

    @Test
    void opensOnlyB01RecordsServerActorAndTimeRejectsRepeatAndSurvivesSeedAndNewLogin() throws Exception {
        var staff = staff();
        var b02 = table(staff, "B02");
        var before = Instant.now().minusSeconds(1);
        var csrf = staff.csrf();
        var response = staff.client.post().uri("/api/tables/" + id("B01") + "/sessions")
                .header(csrf.get("headerName").toString(), csrf.get("token").toString())
                // Caller-supplied actor/time/state must not be trusted.
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("openedBy", "bep", "openedAt", "2000-01-01T00:00:00Z", "status", "CLOSED"))
                .retrieve().toEntity(TableView.class);
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(response.getHeaders().getLocation().toString()).isEqualTo("/api/tables/" + id("B01"));
        var opened = response.getBody();
        assertThat(opened.status()).isEqualTo("OCCUPIED");
        assertThat(opened.currentSession().status()).isEqualTo("OPEN");
        assertThat(opened.currentSession().openedBy().username()).isEqualTo("nhanvien");
        assertThat(opened.currentSession().openedAt()).isBetween(before, Instant.now().plusSeconds(1));
        var repeatCsrf = staff.csrf();
        var conflict = staff.client.post().uri("/api/tables/" + id("B01") + "/sessions")
                .header(repeatCsrf.get("headerName").toString(), repeatCsrf.get("token").toString())
                .exchange((request, result) -> {
                    assertThat(result.getStatusCode().value()).isEqualTo(409);
                    return result.bodyTo(String.class);
                });
        assertThat(conflict).contains("TABLE_NOT_AVAILABLE", "không thể mở thêm phiên");
        jdbc.execute(new ClassPathResource("db/demo/R__demo_tables.sql").getContentAsString(StandardCharsets.UTF_8));
        flyway.migrate();
        assertThat(table(staff(), "B01")).isEqualTo(opened);
        assertThat(table(staff, "B02")).isEqualTo(b02);
        var snapshot = staff.client.get().uri("/api/tables").retrieve().body(TableSnapshot.class);
        assertThat(snapshot.total()).isEqualTo(30);
        assertThat(snapshot.tables()).contains(opened, b02);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM table_session", Integer.class)).isEqualTo(1);
    }

    @Test
    void twoDifferentStaffOpeningConcurrentlyCreateExactlyOneVisit() throws Exception {
        jdbc.update("""
                INSERT INTO staff_user(username, display_name, password_hash, role)
                SELECT 'staff_two', 'Nhân viên thứ hai', password_hash, role FROM staff_user WHERE username = 'nhanvien'
                """);
        var first = staff();
        var second = new BrowserSession(port);
        assertThat(second.login("staff_two", BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
        // Repeat with separate tables; both contenders use real independent HTTP sessions/transactions.
        for (String code : new String[] { "B03", "B04", "B05", "B06", "B07" }) {
            var gate = new CountDownLatch(1);
            var ready = new CountDownLatch(2);
            try (var pool = Executors.newFixedThreadPool(2); var blocker = dataSource.getConnection()) {
                blocker.setAutoCommit(false);
                try (var lock = blocker.prepareStatement("SELECT id FROM restaurant_table WHERE id = ? FOR UPDATE")) {
                    lock.setLong(1, id(code));
                    lock.executeQuery().close();
                }
                var one = pool.submit(() -> { ready.countDown(); gate.await(); return open(first, id(code)); });
                var two = pool.submit(() -> { ready.countDown(); gate.await(); return open(second, id(code)); });
                try {
                    assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
                    gate.countDown();
                    // Prove both real server transactions reached the lock, not merely two
                    // requests that happened to execute sequentially on a fast machine.
                    int waiting = 0;
                    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                    while (waiting < 2 && System.nanoTime() < deadline) {
                        waiting = jdbc.queryForObject("""
                                SELECT count(*) FROM pg_stat_activity
                                WHERE datname = current_database() AND wait_event_type = 'Lock'
                                  AND query LIKE 'SELECT status FROM restaurant_table WHERE id = % FOR UPDATE'
                                """, Integer.class);
                        if (waiting < 2) Thread.sleep(25);
                    }
                    assertThat(waiting).as("both opening transactions are waiting for the same table").isEqualTo(2);
                } finally {
                    gate.countDown();
                    blocker.rollback();
                }
                assertThat(java.util.List.of(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS)))
                        .containsExactlyInAnyOrder(201, 409);
            }
            var opened = table(first, code);
            assertThat(opened.status()).isEqualTo("OCCUPIED");
            assertThat(opened.currentSession().openedBy().username()).isIn("nhanvien", "staff_two");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM table_session WHERE table_id = ?", Integer.class, id(code)))
                    .isEqualTo(1);
        }
    }

    @Test
    void anonymousKitchenAndMissingCsrfCannotOpenOrReadStaffDetails() {
        var anonymous = new BrowserSession(port);
        var kitchen = new BrowserSession(port);
        assertThat(kitchen.login("bep", BrowserSession.KITCHEN_PASSWORD)).isEqualTo(204);
        for (var session : new BrowserSession[] { anonymous, kitchen }) {
            int expected = session == anonymous ? 401 : 403;
            assertThat(open(session, id("B01"))).isEqualTo(expected);
            assertThat(session.getStatus("/api/tables/" + id("B01"))).isEqualTo(expected);
        }
        var staff = staff();
        assertThat(staff.client.post().uri("/api/tables/" + id("B01") + "/sessions")
                .exchange((request, response) -> response.getStatusCode().value()).intValue()).isEqualTo(403);
        assertThat(table(staff, "B01").status()).isEqualTo("AVAILABLE");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM table_session", Integer.class)).isZero();
    }

    @Test
    void rejectsCleaningMissingAndInconsistentActiveTablesWithoutChangingThem() {
        var staff = staff();
        jdbc.update("UPDATE restaurant_table SET status = 'NEEDS_CLEANING' WHERE code = 'B01'");
        assertThat(open(staff, id("B01"))).isEqualTo(409);
        assertThat(table(staff, "B01").status()).isEqualTo("NEEDS_CLEANING");
        assertThat(open(staff, -1)).isEqualTo(404);
        assertThat(staff.getStatus("/api/tables/-1")).isEqualTo(404);
        // Defensive check if legacy/manual writes left AVAILABLE with an active visit.
        jdbc.update("INSERT INTO table_session(table_id, opened_by) SELECT ?, id FROM staff_user WHERE username = 'nhanvien'", id("B02"));
        assertThat(open(staff, id("B02"))).isEqualTo(409);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM table_session", Integer.class)).isEqualTo(1);
    }

    @Test
    void databaseRejectsSecondActiveSessionIncludingCheckoutAndRetainsClosedHistory() {
        var staff = staff();
        assertThat(open(staff, id("B01"))).isEqualTo(201);
        Runnable duplicate = () -> jdbc.update("INSERT INTO table_session(table_id, opened_by) SELECT ?, id FROM staff_user WHERE username = 'nhanvien'", id("B01"));
        assertThatThrownBy(duplicate::run).isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("UPDATE table_session SET status = 'CHECKOUT_PENDING' WHERE table_id = ?", id("B01"));
        assertThatThrownBy(duplicate::run).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(table(staff, "B01").currentSession().status()).isEqualTo("CHECKOUT_PENDING");
        jdbc.update("UPDATE table_session SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE table_id = ?", id("B01"));
        jdbc.update("UPDATE restaurant_table SET status = 'AVAILABLE' WHERE code = 'B01'");
        assertThat(table(staff, "B01").currentSession()).isNull();
        assertThat(open(staff, id("B01"))).isEqualTo(201);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM table_session WHERE table_id = ?", Integer.class, id("B01"))).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM table_session WHERE table_id = ? AND status = 'CLOSED'", Integer.class, id("B01"))).isEqualTo(1);
    }

    @Test
    void failedInsertRollsBackPhysicalTableAndReturnsSanitized503() {
        var staff = staff();
        jdbc.execute("ALTER TABLE table_session ADD CONSTRAINT test_reject_open CHECK (table_id < 0)");
        try {
            var csrf = staff.csrf();
            var body = staff.client.post().uri("/api/tables/" + id("B01") + "/sessions")
                    .header(csrf.get("headerName").toString(), csrf.get("token").toString())
                    .exchange((request, response) -> {
                        assertThat(response.getStatusCode().value()).isEqualTo(503);
                        return response.bodyTo(String.class);
                    });
            assertThat(body).doesNotContain("test_reject_open", "jdbc:", "PSQLException", "password_hash");
            assertThat(table(staff, "B01").status()).isEqualTo("AVAILABLE");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM table_session", Integer.class)).isZero();
        } finally {
            jdbc.execute("ALTER TABLE table_session DROP CONSTRAINT test_reject_open");
        }
    }
}
