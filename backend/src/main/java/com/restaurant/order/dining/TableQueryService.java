package com.restaurant.order.dining;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TableQueryService {
    private static final String SELECT = """
            SELECT t.*, s.id AS session_id, s.status AS session_status, s.opened_at,
                   u.id AS staff_id, u.username, u.display_name AS staff_name
            FROM restaurant_table t
            LEFT JOIN table_session s ON s.table_id = t.id AND s.status IN ('OPEN', 'CHECKOUT_PENDING')
            LEFT JOIN staff_user u ON u.id = s.opened_by
            """;
    private final JdbcTemplate jdbc;

    public TableQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public TableSnapshot snapshot() {
        // One statement keeps physical state and current visit in the same database snapshot.
        var result = jdbc.query(SELECT + " ORDER BY t.code", (row, index) -> view(row));
        return new TableSnapshot(result, result.size(), Instant.now());
    }

    @Transactional(readOnly = true)
    public TableView table(long id) {
        return jdbc.query(SELECT + " WHERE t.id = ?", (row, index) -> view(row), id).stream().findFirst()
                .orElseThrow(() -> new TableOperationException(HttpStatus.NOT_FOUND, "TABLE_NOT_FOUND",
                        "Không tìm thấy bàn này. Vui lòng tải lại danh sách bàn."));
    }

    private static TableView view(ResultSet row) throws SQLException {
        TableSessionView session = row.getObject("session_id") == null ? null : new TableSessionView(
                row.getLong("session_id"), row.getString("session_status"), row.getTimestamp("opened_at").toInstant(),
                new TableSessionView.OpenedBy(row.getLong("staff_id"), row.getString("username"), row.getString("staff_name")));
        return new TableView(row.getLong("id"), row.getString("code"), row.getString("display_name"),
                row.getString("area"), row.getInt("seats"), row.getString("status"), session);
    }
}
