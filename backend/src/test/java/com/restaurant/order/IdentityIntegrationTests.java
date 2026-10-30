package com.restaurant.order;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;

@Import({TestcontainersConfiguration.class, IdentityIntegrationTests.FastExpiry.class})
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DEMO_STAFF_PASSWORD=" + BrowserSession.STAFF_PASSWORD,
        "DEMO_KITCHEN_PASSWORD=" + BrowserSession.KITCHEN_PASSWORD })
@ActiveProfiles("demo")
class IdentityIntegrationTests {
    @TestConfiguration(proxyBeanMethods = false)
    static class FastExpiry {
        final AtomicBoolean shortenNext = new AtomicBoolean();
        // Tomcat rounds the Boot timeout to minutes. Shorten the real servlet session only
        // in this test context to exercise expiry without a minute-long sleep.
        @Bean
        HttpSessionListener shortSessions() {
            return new HttpSessionListener() {
                @Override public void sessionCreated(HttpSessionEvent event) {
                    if (shortenNext.compareAndSet(true, false)) event.getSession().setMaxInactiveInterval(2);
                }
            };
        }
    }
    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired Flyway flyway;
    @Autowired FastExpiry expiry;

    @Test
    void anonymousAndWrongRoleCannotCallProtectedApisButMenuRemainsPublic() {
        var anonymous = new BrowserSession(port);
        assertThat(anonymous.getStatus("/api/menu")).isEqualTo(200);
        assertThat(anonymous.getStatus("/api/tables")).isEqualTo(401);
        assertThat(anonymous.getStatus("/api/kitchen/workspace")).isEqualTo(401);
        assertThat(anonymous.getStatus("/api/auth/me")).isEqualTo(401);
        var staff = new BrowserSession(port);
        var kitchen = new BrowserSession(port);
        assertThat(staff.login("nhanvien", BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
        assertThat(kitchen.login("bep", BrowserSession.KITCHEN_PASSWORD)).isEqualTo(204);
        assertThat(staff.getStatus("/api/tables")).isEqualTo(200);
        assertThat(staff.getStatus("/api/kitchen/workspace")).isEqualTo(403);
        assertThat(kitchen.getStatus("/api/kitchen/workspace")).isEqualTo(200);
        assertThat(kitchen.getStatus("/api/tables")).isEqualTo(403);
        assertThat(staff.getStatus("/api/unlisted-resource")).isEqualTo(403);
        assertThat(staff.client.get().uri("/api/auth/me").retrieve().body(String.class))
                .contains("STAFF", "nhanvien").doesNotContain("password", "hash", BrowserSession.STAFF_PASSWORD);
    }

    @Test
    void loginFailuresAreGenericAndDisabledUsersAreDenied() {
        var session = new BrowserSession(port);
        assertThat(session.login("unknown", "wrong")).isEqualTo(401);
        assertThat(session.login("nhanvien", "wrong")).isEqualTo(401);
        var csrf = session.csrf();
        var body = session.client.post().uri("/api/auth/login")
                .header(csrf.get("headerName").toString(), csrf.get("token").toString())
                .contentType(org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED)
                .body("username=unknown&password=private-input")
                .exchange((request, response) -> response.bodyTo(String.class));
        assertThat(body).isEqualTo("{\"message\":\"Tên đăng nhập hoặc mật khẩu không đúng.\"}");
        try {
            jdbc.update("UPDATE staff_user SET enabled = false WHERE username = 'nhanvien'");
            assertThat(session.login("nhanvien", BrowserSession.STAFF_PASSWORD)).isEqualTo(401);
        } finally {
            jdbc.update("UPDATE staff_user SET enabled = true WHERE username = 'nhanvien'");
        }
    }

    @Test
    void csrfRequiredForLoginAndLogoutAndSessionIsRotatedAndRevoked() {
        var session = new BrowserSession(port);
        assertThat(session.client.post().uri("/api/auth/login").body("username=nhanvien")
                .<Integer>exchange((request, response) -> response.getStatusCode().value())).isEqualTo(403);
        var csrf = session.csrf();
        var before = session.cookies.getCookieStore().getCookies().getFirst().getValue();
        assertThat(session.login("nhanvien", BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
        var after = session.cookies.getCookieStore().getCookies().getFirst().getValue();
        assertThat(after).isNotEqualTo(before);
        assertThat(session.client.post().uri("/api/auth/logout")
                .<Integer>exchange((request, response) -> response.getStatusCode().value())).isEqualTo(403);
        assertThat(session.client.post().uri("/api/auth/logout").header(csrf.get("headerName").toString(), csrf.get("token").toString())
                .<Integer>exchange((request, response) -> response.getStatusCode().value())).isEqualTo(403);
        assertThat(session.getStatus("/api/auth/me")).isEqualTo(200);
        assertThat(session.logout()).isEqualTo(204);
        // Replay the actual old cookie, not just the cookie jar after deletion.
        var replay = RestClient.create("http://127.0.0.1:" + port);
        assertThat(replay.get().uri("/api/tables").header("Cookie", "JSESSIONID=" + after)
                .<Integer>exchange((request, response) -> response.getStatusCode().value())).isEqualTo(401);
    }

    @Test
    void serverExpiresIdleSessionAndAllowsSigningInAgain() throws Exception {
        var session = new BrowserSession(port);
        expiry.shortenNext.set(true);
        assertThat(session.login("nhanvien", BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
        Thread.sleep(3100); // Server checks maxInactiveInterval when this cookie is next used.
        assertThat(session.getStatus("/api/tables")).isEqualTo(401);
        assertThat(session.login("nhanvien", BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
        assertThat(session.getStatus("/api/tables")).isEqualTo(200);
    }

    @Test
    void demoPasswordsAreHashedAndRestartNeverResetsExistingAccounts() {
        var hash = jdbc.queryForObject("SELECT password_hash FROM staff_user WHERE username = 'bep'", String.class);
        assertThat(hash).startsWith("$2a$12$").doesNotContain(BrowserSession.KITCHEN_PASSWORD);
        assertThat(encoder.matches(BrowserSession.KITCHEN_PASSWORD, hash)).isTrue();
        flyway.migrate();
        assertThat(jdbc.queryForObject("SELECT password_hash FROM staff_user WHERE username = 'bep'", String.class)).isEqualTo(hash);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM staff_user", Integer.class)).isEqualTo(2);
    }
}
