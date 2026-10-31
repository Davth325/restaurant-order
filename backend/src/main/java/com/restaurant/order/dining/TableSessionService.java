package com.restaurant.order.dining;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TableSessionService {
    private final JdbcTemplate jdbc;
    private final TableQueryService queries;

    public TableSessionService(JdbcTemplate jdbc, TableQueryService queries) {
        this.jdbc = jdbc;
        this.queries = queries;
    }

    @Transactional
    public TableView open(long tableId, String username) {
        // Serialize every opening attempt on the physical table, including across server instances.
        var states = jdbc.queryForList("SELECT status FROM restaurant_table WHERE id = ? FOR UPDATE", String.class, tableId);
        if (states.isEmpty()) {
            throw new TableOperationException(HttpStatus.NOT_FOUND, "TABLE_NOT_FOUND", "Không tìm thấy bàn này.");
        }
        if (!states.getFirst().equals("AVAILABLE") || Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM table_session WHERE table_id = ? AND status IN ('OPEN', 'CHECKOUT_PENDING'))",
                Boolean.class, tableId))) {
            throw new TableOperationException(HttpStatus.CONFLICT, "TABLE_NOT_AVAILABLE",
                    "Bàn đang phục vụ hoặc chờ dọn, không thể mở thêm phiên. Vui lòng làm mới để xem phiên hiện tại.");
        }
        var staff = jdbc.queryForList("SELECT id FROM staff_user WHERE username = ? AND role = 'STAFF' AND enabled", Long.class, username);
        if (staff.isEmpty()) {
            throw new TableOperationException(HttpStatus.FORBIDDEN, "STAFF_REQUIRED", "Chỉ nhân viên đang có quyền mới được mở bàn.");
        }
        // Actor and time come only from the authenticated principal and database clock.
        jdbc.update("UPDATE restaurant_table SET status = 'OCCUPIED' WHERE id = ?", tableId);
        jdbc.update("INSERT INTO table_session(table_id, opened_by) VALUES (?, ?)", tableId, staff.getFirst());
        return queries.table(tableId);
    }
}
