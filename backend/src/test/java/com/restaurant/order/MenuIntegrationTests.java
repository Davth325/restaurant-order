package com.restaurant.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.restaurant.order.menu.MenuSnapshot;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("demo")
class MenuIntegrationTests {
    @LocalServerPort
    int port;
    @Autowired
    JdbcTemplate jdbc;

    private RestClient client() {
        return RestClient.create("http://127.0.0.1:" + port);
    }

    private MenuSnapshot menu() {
        return client().get().uri("/api/menu").retrieve().body(MenuSnapshot.class);
    }

    @Test
    void returnsOrderedDatabaseMenuIncludingSoldOutItemsAndIntegerPrices() {
        var response = client().get().uri("/api/menu").retrieve().toEntity(MenuSnapshot.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        var body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.total()).isEqualTo(6);
        assertThat(body.observedAt()).isNotNull();
        assertThat(body.categories()).extracting(MenuSnapshot.Category::name)
                .containsExactly("Khai vị", "Món chính", "Đồ uống");
        assertThat(body.categories().getFirst().items()).extracting(MenuSnapshot.Item::name)
                .containsExactly("Gỏi cuốn tôm", "Nem rán giòn");
        var items = body.categories().stream().flatMap(category -> category.items().stream()).toList();
        assertThat(items).anyMatch(item -> item.name().equals("Bún chả Hà Nội") && !item.available());
        assertThat(items).anyMatch(item -> item.name().equals("Gỏi cuốn tôm") && item.priceVnd() == 45000);
        assertThat(items).allMatch(item -> item.imagePath().startsWith("/menu-images/") && item.priceVnd() >= 0);
    }

    @Test
    void apiReadsCommittedEditsOnEveryRequestAndSeedNeverResetsThem() throws Exception {
        try {
            jdbc.update("UPDATE menu_item SET name = 'Món vừa sửa', price_vnd = 123456, available = false WHERE code = 'GOI_CUON'");
            jdbc.execute(new ClassPathResource("db/demo/R__demo_menu.sql").getContentAsString(StandardCharsets.UTF_8));
            for (int request = 0; request < 2; request++) {
                var body = menu();
                assertThat(body.total()).isEqualTo(6);
                assertThat(body.categories().getFirst().items()).anyMatch(item ->
                        item.name().equals("Món vừa sửa") && item.priceVnd() == 123456 && !item.available());
            }
            assertThat(jdbc.queryForObject("SELECT count(*) FROM menu_category", Integer.class)).isEqualTo(3);
        } finally {
            jdbc.update("UPDATE menu_item SET name = 'Gỏi cuốn tôm', price_vnd = 45000, available = true WHERE code = 'GOI_CUON'");
        }
    }

    @Test
    void returnsEmptyMenuWithoutInventingItems() {
        var savedItems = jdbc.queryForList("SELECT * FROM menu_item");
        try {
            jdbc.update("DELETE FROM menu_item");
            var body = menu();
            assertThat(body.total()).isZero();
            assertThat(body.categories()).hasSize(3).allMatch(category -> category.items().isEmpty());
        } finally {
            for (var item : savedItems) {
                jdbc.update("INSERT INTO menu_item(id,code,category_id,name,price_vnd,image_path,available,display_order) VALUES (?,?,?,?,?,?,?,?)",
                        item.get("id"), item.get("code"), item.get("category_id"), item.get("name"),
                        item.get("price_vnd"), item.get("image_path"), item.get("available"), item.get("display_order"));
            }
        }
    }

    @Test
    void postgresRejectsInvalidPriceAndMissingCategory() {
        assertThatThrownBy(() -> jdbc.update("UPDATE menu_item SET price_vnd = -1 WHERE code = 'COM_GA'"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE menu_item SET price_vnd = 9007199254740992 WHERE code = 'COM_GA'"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE menu_item SET category_id = -1 WHERE code = 'COM_GA'"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsWritesAndReturnsSanitized503WhenMenuCannotBeRead() {
        var status = client().post().uri("/api/menu").exchange((request, response) -> response.getStatusCode().value());
        assertThat(status).isEqualTo(405);
        try {
            // Simulate an unreadable relation only in the isolated test database.
            jdbc.execute("ALTER TABLE menu_item RENAME TO menu_item_unavailable");
            var response = client().get().uri("/api/menu").exchange((request, result) -> {
                assertThat(result.getStatusCode().value()).isEqualTo(503);
                return result.bodyTo(String.class);
            });
            assertThat(response).contains("Chưa đọc được dữ liệu nhà hàng")
                    .doesNotContain("jdbc:", "PSQLException", "menu_item_unavailable", "password");
        } finally {
            jdbc.execute("ALTER TABLE IF EXISTS menu_item_unavailable RENAME TO menu_item");
        }
    }
}
