package com.restaurant.order.ordering;

import com.restaurant.order.dining.TableOperationException;
import com.restaurant.order.fulfillment.KitchenChanged;
import com.restaurant.order.fulfillment.ServingService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CancellationService {
    public record GuestCancellation(UUID requestKey, Long unitId) {}
    public record Command(UUID requestKey, Long unitId, Long version, String action, UUID cancellationKey, String reason) {}
    public record Unit(long id, long version, String status, boolean excluded, long sessionId, String tableCode,
            long batchId, String name, int number, long priceVnd) {}
    public record Operation(UUID requestKey, long unitId, long version, String action, UUID cancellationKey,
            String reason, String actor, String fromStatus, String toStatus, Instant occurredAt) {}
    private final JdbcTemplate jdbc;
    private final GuestOrderService orders;
    private final ServingService serving;
    private final ApplicationEventPublisher events;
    public CancellationService(JdbcTemplate jdbc, GuestOrderService orders, ServingService serving, ApplicationEventPublisher events) {
        this.jdbc = jdbc; this.orders = orders; this.serving = serving; this.events = events;
    }
    private static TableOperationException fail(HttpStatus status, String code, String message) { return new TableOperationException(status, code, message); }
    private static String reason(String value) {
        if (value == null || value.strip().isEmpty() || value.strip().length() > 300)
            throw fail(HttpStatus.BAD_REQUEST, "REASON_REQUIRED", "Cần lý do từ 1 đến 300 ký tự.");
        return value.strip();
    }
    private static String digest(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    private void keyLock(UUID key) {
        // Serializes accidental UUID reuse across visits as well as retries on one visit.
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", Object.class, key.toString());
    }
    private long lockUnit(long id) {
        var sessions = jdbc.queryForList("""
                SELECT s.id FROM table_session s JOIN order_batch b ON b.session_id = s.id
                JOIN order_item i ON i.batch_id = b.id JOIN fulfillment_unit u ON u.order_item_id = i.id
                WHERE u.id = ? FOR UPDATE OF s
                """, Long.class, id);
        if (sessions.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "UNIT_NOT_FOUND", "Không tìm thấy suất món.");
        if ("CLOSED".equals(jdbc.queryForObject("SELECT status FROM table_session WHERE id = ?", String.class, sessions.getFirst())))
            throw fail(HttpStatus.CONFLICT, "SESSION_INACTIVE", "Phiên bàn đã kết thúc.");
        return sessions.getFirst();
    }
    private List<Unit> units(Long session) {
        return jdbc.query("""
                SELECT u.*, b.session_id, b.id AS batch_id, t.code, i.item_name, i.unit_price_vnd
                FROM fulfillment_unit u JOIN order_item i ON i.id = u.order_item_id
                JOIN order_batch b ON b.id = i.batch_id JOIN table_session s ON s.id = b.session_id
                JOIN restaurant_table t ON t.id = s.table_id
                WHERE s.status IN ('OPEN','CHECKOUT_PENDING') AND (?::bigint IS NULL OR s.id = ?)
                ORDER BY b.id, i.id, u.unit_number
                """, (rs, row) -> new Unit(rs.getLong("id"), rs.getLong("version"), rs.getString("status"), rs.getBoolean("bill_excluded"),
                rs.getLong("session_id"), rs.getString("code"), rs.getLong("batch_id"), rs.getString("item_name"), rs.getInt("unit_number"),
                rs.getLong("unit_price_vnd")), session, session);
    }
    @Transactional
    public List<Unit> guestUnits(String token, long session) { orders.authorize(token, session); return units(session); }
    @Transactional(readOnly = true)
    public List<Unit> internalUnits(String username) {
        requireManager(username);
        return units(null);
    }

    @Transactional
    public void cancel(String token, long session, GuestCancellation command) {
        // Authorize and lock the visit before reading a portion. Kitchen uses the same lock.
        orders.authorize(token, session);
        if (command == null || command.requestKey() == null || command.unitId() == null)
            throw fail(HttpStatus.BAD_REQUEST, "INVALID_CANCELLATION", "Cần khóa yêu cầu và suất món.");
        var states = jdbc.queryForList("""
                SELECT u.status FROM fulfillment_unit u JOIN order_item i ON i.id = u.order_item_id
                JOIN order_batch b ON b.id = i.batch_id WHERE u.id = ? AND b.session_id = ?
                """, String.class, command.unitId(), session);
        if (states.isEmpty())
            throw fail(HttpStatus.FORBIDDEN, "WRONG_SESSION", "Suất món không thuộc phiên bàn này.");

        String deviceHash = digest(token);
        keyLock(command.requestKey());
        var old = jdbc.queryForList("SELECT unit_id, guest_device_hash FROM guest_cancellation WHERE request_key = ?", command.requestKey());
        if (!old.isEmpty()) {
            var saved = old.getFirst();
            if (((Number)saved.get("unit_id")).longValue() != command.unitId() || !deviceHash.equals(saved.get("guest_device_hash")))
                throw fail(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Khóa hủy đã dùng cho thao tác khác.");
            return;
        }

        String state = states.getFirst();
        if (!state.equals("QUEUED")) {
            String message = state.equals("CANCELLED") ? "Suất này đã được hủy." : "Bếp đã bắt đầu làm suất này. Bạn chỉ có thể hủy suất còn chờ bếp.";
            throw fail(HttpStatus.CONFLICT, "UNIT_STATE_CONFLICT", message);
        }
        Long version = jdbc.queryForObject("""
                UPDATE fulfillment_unit SET status = 'CANCELLED', bill_excluded = true, version = version + 1
                WHERE id = ? RETURNING version - 1
                """, Long.class, command.unitId());
        jdbc.update("INSERT INTO guest_cancellation(request_key, unit_id, guest_device_hash, expected_version) VALUES (?, ?, ?, ?)",
                command.requestKey(), command.unitId(), deviceHash, version);
        events.publishEvent(new KitchenChanged());
    }
    @Transactional
    public GuestCancellation guestReceipt(String token, long session, UUID key) {
        orders.authorize(token, session);
        var rows = jdbc.query("SELECT request_key, unit_id FROM guest_cancellation WHERE request_key = ? AND guest_device_hash = ?",
                (rs, row) -> new GuestCancellation(rs.getObject("request_key", UUID.class), rs.getLong("unit_id")), key, digest(token));
        if (rows.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "OPERATION_NOT_FOUND", "Chưa thấy lượt hủy được lưu.");
        return rows.getFirst();
    }
    private List<Operation> operations(String filter, Object value) {
        return jdbc.query("""
                SELECT o.*, a.username FROM cancellation_operation o JOIN staff_user a ON a.id = o.actor_id
                """ + " WHERE " + filter + " ORDER BY o.occurred_at", (rs, row) -> new Operation(rs.getObject("request_key", UUID.class),
                rs.getLong("unit_id"), rs.getLong("expected_version"), rs.getString("action"), rs.getObject("cancellation_key", UUID.class),
                rs.getString("reason"), rs.getString("username"), rs.getString("from_status"), rs.getString("to_status"), rs.getTimestamp("occurred_at").toInstant()), value);
    }
    @Transactional(readOnly = true)
    public Operation receipt(String username, UUID key) {
        requireManager(username);
        var rows = operations("o.request_key = ?", key);
        if (rows.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "OPERATION_NOT_FOUND", "Chưa thấy thao tác được lưu.");
        if (!username.equals(rows.getFirst().actor())) throw fail(HttpStatus.FORBIDDEN, "NOT_OPERATION_OWNER", "Không có quyền tra thao tác này.");
        return rows.getFirst();
    }
    @Transactional(readOnly = true)
    public List<Operation> history(String username, long id) {
        requireManager(username);
        var history = new ArrayList<>(operations("o.unit_id = ?", id));
        history.addAll(jdbc.query("SELECT request_key, expected_version, occurred_at FROM guest_cancellation WHERE unit_id = ?",
                (rs, row) -> new Operation(rs.getObject("request_key", UUID.class), id, rs.getLong("expected_version"), "GUEST_CANCEL", null, null,
                        "Khách", "QUEUED", "CANCELLED", rs.getTimestamp("occurred_at").toInstant()), id));
        history.sort(Comparator.comparing(Operation::occurredAt));
        return history;
    }
    private ServingService.Actor requireManager(String username) {
        var actor = serving.requireReader(username);
        if (!actor.role().equals("MANAGER")) throw fail(HttpStatus.FORBIDDEN, "MANAGER_REQUIRED", "Chỉ quản lý truy cập điều chỉnh món.");
        return actor;
    }
    @Transactional
    public void decide(String username, Command command) {
        var actor = requireManager(username);
        if (command == null || command.requestKey() == null || command.unitId() == null || command.version() == null || command.version() < 0
                || !List.of("APPROVE","REJECT","CANCEL","EXCLUDE").contains(command.action() == null ? "" : command.action()))
            throw fail(HttpStatus.BAD_REQUEST, "INVALID_CANCELLATION", "Cần khóa, phiên bản và hành động hợp lệ.");
        String why = reason(command.reason());
        lockUnit(command.unitId()); keyLock(command.requestKey());
        var old = operations("o.request_key = ?", command.requestKey());
        if (!old.isEmpty()) {
            var saved = old.getFirst();
            if (saved.unitId() != command.unitId() || saved.version() != command.version() || !saved.actor().equals(username)
                    || !saved.action().equals(command.action()) || !saved.reason().equals(why) || !Objects.equals(saved.cancellationKey(), command.cancellationKey()))
                throw fail(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Khóa thao tác đã dùng cho nội dung khác.");
            return;
        }
        if (!List.of("CANCEL", "EXCLUDE").contains(command.action()) || command.cancellationKey() != null)
            throw fail(HttpStatus.CONFLICT, "APPROVAL_RETIRED", "Luồng duyệt đã kết thúc. Khách tự hủy suất còn chờ bếp.");
        Map<String,Object> unit = jdbc.queryForMap("SELECT * FROM fulfillment_unit WHERE id = ?", command.unitId());
        String from = unit.get("status").toString();
        if (((Number)unit.get("version")).longValue() != command.version() || Boolean.TRUE.equals(unit.get("bill_excluded")))
            throw fail(HttpStatus.CONFLICT, "UNIT_STATE_CONFLICT", "Suất vừa đổi trạng thái. Tải lại trước khi xử lý.");
        boolean served = from.equals("SERVED");
        if (command.action().equals("EXCLUDE") != served)
            throw fail(HttpStatus.FORBIDDEN, "CANCELLATION_PERMISSION", "Suất đã giao chỉ được loại khỏi tạm tính. Suất chưa giao dùng thao tác hủy.");
        String to = served ? from : "CANCELLED";
        jdbc.update("UPDATE fulfillment_unit SET status = ?, bill_excluded = true, version = version + 1 WHERE id = ?", to, command.unitId());
        jdbc.update("""
                INSERT INTO cancellation_operation(request_key, unit_id, actor_id, expected_version, action, cancellation_key, reason, from_status, to_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, command.requestKey(), command.unitId(), actor.id(), command.version(), command.action(), command.cancellationKey(), why, from, to);
        events.publishEvent(new KitchenChanged());
    }
}
