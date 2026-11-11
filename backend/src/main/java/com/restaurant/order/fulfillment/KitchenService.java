package com.restaurant.order.fulfillment;

import com.restaurant.order.dining.TableOperationException;
import java.time.Instant;
import java.util.List;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KitchenService {
    public record Unit(long id, long itemId, int number, String status, long batchId, long batchNumber,
            long sessionId, String tableCode, Instant createdAt, String name, int quantity, String note,
            boolean guestCancelled, boolean billExcluded, String cancellationReason) {}
    public record Snapshot(List<Unit> units, Instant observedAt) {}
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher events;
    public KitchenService(JdbcTemplate jdbc, ApplicationEventPublisher events) { this.jdbc = jdbc; this.events = events; }

    public long requireKitchen(String username) {
        var ids = jdbc.queryForList("SELECT id FROM staff_user WHERE username = ? AND role = 'KITCHEN' AND enabled", Long.class, username);
        if (ids.isEmpty()) throw new TableOperationException(HttpStatus.FORBIDDEN, "KITCHEN_REQUIRED", "Tài khoản không còn quyền bếp. Vui lòng đăng nhập lại.");
        return ids.getFirst();
    }

    @Transactional(readOnly = true)
    public Snapshot snapshot(String username) {
        requireKitchen(username);
        var units = jdbc.query("""
                WITH batches AS (
                    SELECT b.*, row_number() OVER (PARTITION BY session_id ORDER BY id) AS batch_number FROM order_batch b
                )
                SELECT u.id, u.order_item_id, u.unit_number, u.status, b.id AS batch_id, b.batch_number,
                       s.id AS session_id, t.code, b.created_at, i.item_name, i.quantity, i.note, u.bill_excluded,
                       EXISTS (SELECT 1 FROM guest_cancellation c WHERE c.unit_id = u.id) AS guest_cancelled,
                       (SELECT reason FROM cancellation_operation o WHERE o.unit_id = u.id AND action <> 'REJECT' ORDER BY occurred_at DESC LIMIT 1) AS cancel_reason
                FROM fulfillment_unit u JOIN order_item i ON i.id = u.order_item_id
                JOIN batches b ON b.id = i.batch_id JOIN table_session s ON s.id = b.session_id
                JOIN restaurant_table t ON t.id = s.table_id WHERE s.status IN ('OPEN', 'CHECKOUT_PENDING')
                ORDER BY b.created_at, b.id, i.id, u.unit_number
                """, (rs, row) -> new Unit(rs.getLong("id"), rs.getLong("order_item_id"), rs.getInt("unit_number"),
                rs.getString("status"), rs.getLong("batch_id"), rs.getLong("batch_number"), rs.getLong("session_id"),
                rs.getString("code"), rs.getTimestamp("created_at").toInstant(), rs.getString("item_name"),
                rs.getInt("quantity"), rs.getString("note"), rs.getBoolean("guest_cancelled"), rs.getBoolean("bill_excluded"), rs.getString("cancel_reason")));
        return new Snapshot(units, Instant.now());
    }

    @Transactional
    public void transition(String username, long id, String target) {
        long actor = requireKitchen(username);
        if (!"PREPARING".equals(target) && !"READY".equals(target))
            throw new TableOperationException(HttpStatus.BAD_REQUEST, "INVALID_UNIT_STATUS", "Chỉ có thể bắt đầu làm hoặc xác nhận đã xong.");
        // Use the same visit lock as ordering and future checkout/close. Never lock a unit first.
        var sessions = jdbc.queryForList("""
                SELECT s.id FROM table_session s JOIN order_batch b ON b.session_id = s.id
                JOIN order_item i ON i.batch_id = b.id JOIN fulfillment_unit u ON u.order_item_id = i.id
                WHERE u.id = ? FOR UPDATE OF s
                """, Long.class, id);
        if (sessions.isEmpty()) throw new TableOperationException(HttpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Không tìm thấy suất món.");
        String visit = jdbc.queryForObject("SELECT status FROM table_session WHERE id = ?", String.class, sessions.getFirst());
        if ("CLOSED".equals(visit)) throw new TableOperationException(HttpStatus.CONFLICT, "SESSION_INACTIVE", "Phiên bàn đã kết thúc. Hãy tải lại hàng đợi.");
        String current = jdbc.queryForObject("SELECT status FROM fulfillment_unit WHERE id = ?", String.class, id);
        if (target.equals(current)) return; // Retrying the exact unit/target never advances another portion.
        String expected = target.equals("PREPARING") ? "QUEUED" : "PREPARING";
        if (!expected.equals(current)) throw new TableOperationException(HttpStatus.CONFLICT, "UNIT_STATE_CONFLICT", "Suất món đã đổi trạng thái. Hãy kiểm tra dữ liệu mới trước khi thao tác.");
        int changed = target.equals("PREPARING")
                ? jdbc.update("UPDATE fulfillment_unit SET status = 'PREPARING', version = version + 1, started_at = clock_timestamp(), started_by = ? WHERE id = ? AND status = 'QUEUED'", actor, id)
                : jdbc.update("UPDATE fulfillment_unit SET status = 'READY', version = version + 1, ready_at = clock_timestamp(), ready_by = ? WHERE id = ? AND status = 'PREPARING'", actor, id);
        if (changed != 1) throw new TableOperationException(HttpStatus.CONFLICT, "UNIT_STATE_CONFLICT", "Suất món vừa được thay đổi. Hãy tải lại.");
        events.publishEvent(new KitchenChanged());
    }
}
