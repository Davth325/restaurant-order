package com.restaurant.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.restaurant.order.dining.TableSnapshot;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "DEMO_STAFF_PASSWORD=" + BrowserSession.STAFF_PASSWORD,
        "DEMO_KITCHEN_PASSWORD=" + BrowserSession.KITCHEN_PASSWORD })
@ActiveProfiles("demo")
class RestaurantOrderApplicationTests {

	@LocalServerPort
	int port;

	@Autowired
	JdbcTemplate jdbc;

	private RestClient client() {
		var session = new BrowserSession(port);
		assertThat(session.login("nhanvien", BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
		return session.client;
	}

	@Test
	void apiReadsThirtyDemoTablesFromPostgres() {
		var response = client().get().uri("/api/tables").retrieve().toEntity(TableSnapshot.class);
		assertThat(response.getStatusCode().value()).isEqualTo(200);
		assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
		assertThat(response.getBody()).isNotNull();
		assertThat(response.getBody().total()).isEqualTo(30);
		assertThat(response.getBody().tables()).hasSize(30);
		assertThat(response.getBody().tables().getFirst().code()).isEqualTo("B01");
		assertThat(response.getBody().tables().getLast().code()).isEqualTo("B30");
		assertThat(response.getBody().observedAt()).isNotNull();
		assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success", Integer.class))
				.isEqualTo(8);
	}

	@Test
	void healthIncludesRealDatabaseConnection() {
		assertThat(client().get().uri("/actuator/health").retrieve().body(String.class))
				.contains("\"status\":\"UP\"");
	}

	@Test
	void apiReflectsCommittedDatabaseChanges() {
		jdbc.update("INSERT INTO restaurant_table(code,display_name,area,seats) VALUES ('TEST31','Bàn kiểm thử','Test',2)");
		try {
			var body = client().get().uri("/api/tables").retrieve().body(TableSnapshot.class);
			assertThat(body).isNotNull();
			assertThat(body.total()).isEqualTo(31);
			assertThat(body.tables()).anyMatch(table -> table.code().equals("TEST31"));
		} finally {
			jdbc.update("DELETE FROM restaurant_table WHERE code = 'TEST31'");
		}
	}

	@Test
	void postgresRejectsDuplicateTableCodeAndInvalidSeats() {
		assertThatThrownBy(() -> jdbc.update("INSERT INTO restaurant_table(code,display_name,area,seats) VALUES ('B01','Duplicate','Test',4)"))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> jdbc.update("INSERT INTO restaurant_table(code,display_name,area,seats) VALUES ('INVALID','Test','Test',0)"))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void unsupportedMutationIsRejected() {
		var session = new BrowserSession(port);
		assertThat(session.login("nhanvien", BrowserSession.STAFF_PASSWORD)).isEqualTo(204);
		var csrf = session.csrf();
		var status = session.client.post().uri("/api/tables")
				.header(csrf.get("headerName").toString(), csrf.get("token").toString())
				.exchange((request, response) -> response.getStatusCode().value());
		assertThat(status).isEqualTo(405);
	}

}
