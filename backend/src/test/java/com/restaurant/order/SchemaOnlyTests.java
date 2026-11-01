package com.restaurant.order;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("default")
class SchemaOnlyTests {
    @Autowired
    JdbcTemplate jdbc;

    @Test
    void defaultProfileMigratesSchemaWithoutDemoData() {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM restaurant_table", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM menu_category", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM menu_item", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM staff_user", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM table_session", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success", Integer.class))
                .isEqualTo(5);
    }
}
