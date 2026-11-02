package com.restaurant.order.fulfillment;

import com.restaurant.order.dining.TableOperationException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ServingService {
    public record Actor(long id, String role) {}
    public record Command(UUID requestKey, Long version, String action, String reason) {}
    public record Unit(long id, long itemId, int number, String status, long version, long batchId,
            long batchNumber, long sessionId, String tableCode, String name, int quantity, String note,
            Instant readyAt, String pickedUpBy, String pickedUpName, Instant pickedUpAt, Instant servedAt) {}
    public record Snapshot(List<Unit> units, Instant observedAt) {}
    public record Operation(UUID requestKey, long unitId, String actor, String actorName, String action,
            long version, String fromStatus, String toStatus, String reason, Instant occurredAt) {}
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher events;
    public ServingService(JdbcTemplate jdbc, ApplicationEventPublisher events) { this.jdbc = jdbc; this.events = events; }
    private static TableOperationException fail(HttpStatus status, String code, String message) {
        return new TableOperationException(status, code, message);
    }
    public Actor requireReader(String username) {
        var actors = jdbc.query("SELECT id, role FROM staff_user WHERE username = ? AND enabled AND role IN ('STAFF', 'MANAGER')",
                (rs, row) -> new Actor(rs.getLong(1), rs.getString(2)), username);
        if (actors.isEmpty()) throw fail(HttpStatus.FORBIDDEN, "SERVING_REQUIRED", "Tài khoản không còn quyền phục vụ. Vui lòng đăng nhập lại.");
        return actors.getFirst();
    }
    @Transactional(readOnly = true)
    public Snapshot snapshot(String username) {
        var actor = requireReader(username);
        var units = jdbc.query("""
                WITH batches AS (SELECT b.*, row_number() OVER (PARTITION BY session_id ORDER BY id) AS batch_number FROM order_batch b)
                SELECT u.*, b.id AS batch_id, b.batch_number, s.id AS session_id, t.code, i.item_name, i.quantity, i.note,
                       p.username AS pickup_username, p.display_name AS pickup_name
                FROM fulfillment_unit u JOIN order_item i ON i.id = u.order_item_id
                JOIN batches b ON b.id = i.batch_id JOIN table_session s ON s.id = b.session_id
                JOIN restaurant_table t ON t.id = s.table_id LEFT JOIN staff_user p ON p.id = u.picked_up_by
                WHERE s.status IN ('OPEN', 'CHECKOUT_PENDING') AND u.status IN ('READY', 'PICKED_UP', 'SERVED')
                  AND (? OR u.status = 'READY' OR (u.status = 'PICKED_UP' AND u.picked_up_by = ?))
                ORDER BY u.ready_at, b.id, i.id, u.unit_number
                """, (rs, row) -> new Unit(rs.getLong("id"), rs.getLong("order_item_id"), rs.getInt("unit_number"),
                rs.getString("status"), rs.getLong("version"), rs.getLong("batch_id"), rs.getLong("batch_number"),
                rs.getLong("session_id"), rs.getString("code"), rs.getString("item_name"), rs.getInt("quantity"), rs.getString("note"),
                rs.getTimestamp("ready_at").toInstant(), rs.getString("pickup_username"), rs.getString("pickup_name"),
                rs.getTimestamp("picked_up_at") == null ? null : rs.getTimestamp("picked_up_at").toInstant(),
                rs.getTimestamp("served_at") == null ? null : rs.getTimestamp("served_at").toInstant()), actor.role().equals("MANAGER"), actor.id());
        return new Snapshot(units, Instant.now());
    }
    private List<Operation> operations(String filter, Object value) {
        return jdbc.query("""
                SELECT o.*, a.username, a.display_name FROM serving_operation o JOIN staff_user a ON a.id = o.actor_id
                """ + " WHERE " + filter + " ORDER BY o.occurred_at, o.request_key", (rs, row) -> new Operation(
                rs.getObject("request_key", UUID.class), rs.getLong("unit_id"), rs.getString("username"), rs.getString("display_name"),
                rs.getString("action"), rs.getLong("expected_version"), rs.getString("from_status"), rs.getString("to_status"),
                rs.getString("reason"), rs.getTimestamp("occurred_at").toInstant()), value);
    }
    @Transactional(readOnly = true)
    public List<Operation> history(String username, long unit) {
        if (!requireReader(username).role().equals("MANAGER"))
            throw fail(HttpStatus.FORBIDDEN, "MANAGER_REQUIRED", "Chỉ quản lý được xem lịch sử phục vụ.");
        return operations("o.unit_id = ?", unit);
    }
    @Transactional(readOnly = true)
    public Operation operation(String username, UUID key) {
        requireReader(username);
        var rows = operations("o.request_key = ?", key);
        if (rows.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "OPERATION_NOT_FOUND", "Chưa thấy thao tác này được lưu.");
        if (!rows.getFirst().actor().equals(username)) throw fail(HttpStatus.FORBIDDEN, "NOT_OPERATION_OWNER", "Không có quyền tra khóa thao tác của người khác.");
        return rows.getFirst();
    }
    @Transactional
    public void transition(String username, long unit, Command command) {
        var actor = requireReader(username);
        if (command == null || command.requestKey() == null || command.version() == null || command.version() < 0
                || !List.of("PICK_UP", "RETURN", "SERVE").contains(command.action() == null ? "" : command.action()))
            throw fail(HttpStatus.BAD_REQUEST, "INVALID_SERVING_COMMAND", "Thao tác cần khóa gửi, phiên bản và hành động hợp lệ.");
        String reason = command.reason() == null ? "" : command.reason().strip();
        if (reason.length() > 300 || (command.action().equals("RETURN") ? reason.isEmpty() : !reason.isEmpty()))
            throw fail(HttpStatus.BAD_REQUEST, "RETURN_REASON_REQUIRED", "Trả lại cần lý do từ 1 đến 300 ký tự; thao tác khác không nhận lý do.");
        var sessions = jdbc.queryForList("""
                SELECT s.id FROM table_session s JOIN order_batch b ON b.session_id = s.id
                JOIN order_item i ON i.batch_id = b.id JOIN fulfillment_unit u ON u.order_item_id = i.id
                WHERE u.id = ? FOR UPDATE OF s
                """, Long.class, unit);
        if (sessions.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Không tìm thấy suất món.");
        if ("CLOSED".equals(jdbc.queryForObject("SELECT status FROM table_session WHERE id = ?", String.class, sessions.getFirst())))
            throw fail(HttpStatus.CONFLICT, "SESSION_INACTIVE", "Phiên bàn đã kết thúc. Hãy tải lại.");
        var previous = operations("o.request_key = ?", command.requestKey());
        if (!previous.isEmpty()) {
            var saved = previous.getFirst();
            if (saved.unitId() != unit || !saved.actor().equals(username) || saved.version() != command.version()
                    || !saved.action().equals(command.action()) || !saved.reason().equals(reason))
                throw fail(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Khóa thao tác đã được dùng với nội dung khác.");
            return;
        }
        var current = jdbc.queryForMap("SELECT status, version, picked_up_by FROM fulfillment_unit WHERE id = ?", unit);
        String from = current.get("status").toString();
        String expected = command.action().equals("PICK_UP") ? "READY" : "PICKED_UP";
        if (!from.equals(expected) || ((Number) current.get("version")).longValue() != command.version())
            throw fail(HttpStatus.CONFLICT, "UNIT_STATE_CONFLICT", "Suất món đã được nhận hoặc đổi trạng thái. Hãy kiểm tra dữ liệu mới.");
        boolean owner = current.get("picked_up_by") != null && ((Number) current.get("picked_up_by")).longValue() == actor.id();
        if (command.action().equals("PICK_UP") && !actor.role().equals("STAFF")
                || command.action().equals("SERVE") && (!actor.role().equals("STAFF") || !owner)
                || command.action().equals("RETURN") && !owner && !actor.role().equals("MANAGER"))
            throw fail(HttpStatus.FORBIDDEN, "NOT_PICKUP_OWNER", "Chỉ nhân viên đã nhận được xác nhận giao/trả lại; quản lý được trả lại khi có lý do.");
        String to = switch (command.action()) { case "PICK_UP" -> "PICKED_UP"; case "SERVE" -> "SERVED"; default -> "READY"; };
        String changes = switch (command.action()) {
            case "PICK_UP" -> "picked_up_by = ?, picked_up_at = clock_timestamp()";
            case "SERVE" -> "served_by = ?, served_at = clock_timestamp()";
            default -> "picked_up_by = NULL, picked_up_at = NULL";
        };
        String sql = "UPDATE fulfillment_unit SET status = ?, version = version + 1, " + changes + " WHERE id = ? AND version = ? AND status = ?";
        int changed = command.action().equals("RETURN") ? jdbc.update(sql, to, unit, command.version(), from)
                : jdbc.update(sql, to, actor.id(), unit, command.version(), from);
        if (changed != 1) throw fail(HttpStatus.CONFLICT, "UNIT_STATE_CONFLICT", "Suất món vừa đổi. Hãy tải lại.");
        jdbc.update("""
                INSERT INTO serving_operation(request_key, unit_id, actor_id, action, expected_version, from_status, to_status, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, command.requestKey(), unit, actor.id(), command.action(), command.version(), from, to, reason);
        events.publishEvent(new KitchenChanged());
    }
}
