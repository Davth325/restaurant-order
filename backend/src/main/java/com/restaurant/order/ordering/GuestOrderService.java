package com.restaurant.order.ordering;

import com.restaurant.order.dining.TableOperationException;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GuestOrderService {
    public record GuestSession(long id, String tableCode, String tableName, String status) {}
    public record Pairing(String code, Instant expiresAt, GuestSession session) {}
    public record Binding(String token, GuestSession session) {}
    public record Line(Long menuItemId, Integer quantity, Long expectedPriceVnd, List<Long> optionIds, String note) {}
    public record Submit(UUID requestKey, List<Line> items) {}
    public record Item(long id, long menuItemId, String name, long unitPriceVnd, int quantity, String note, String status) {}
    public record Batch(long id, UUID requestKey, Instant createdAt, long totalVnd, List<Item> items) {}
    private static final long MAX_MONEY = 9007199254740991L;
    private static final SecureRandom RANDOM = new SecureRandom();
    private final JdbcTemplate jdbc;

    public GuestOrderService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static TableOperationException fail(HttpStatus status, String code, String message) {
        return new TableOperationException(status, code, message);
    }
    private static String secret() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private static String hash(byte[] value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value)); }
        catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    private static String hash(String value) { return hash(value.getBytes(StandardCharsets.UTF_8)); }

    // All writes for a visit serialize on the same row (including future checkout/close).
    private GuestSession lockSession(long id) {
        var sessions = jdbc.query("""
                SELECT s.id, t.code, t.display_name, s.status FROM table_session s
                JOIN restaurant_table t ON t.id = s.table_id WHERE s.id = ? FOR UPDATE OF s
                """, (rs, row) -> new GuestSession(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)), id);
        if (sessions.isEmpty() || sessions.getFirst().status().equals("CLOSED"))
            throw fail(HttpStatus.FORBIDDEN, "SESSION_INACTIVE", "Phiên bàn đã kết thúc hoặc không còn hiệu lực. Vui lòng gọi nhân viên.");
        return sessions.getFirst();
    }
    private static void requireOpen(GuestSession session) {
        if (!session.status().equals("OPEN"))
            throw fail(HttpStatus.CONFLICT, "SESSION_NOT_OPEN", "Phiên đang chờ thanh toán, không thể gọi thêm món.");
    }

    @Transactional
    public Pairing createPairing(long sessionId, String username) {
        var session = lockSession(sessionId);
        requireOpen(session);
        var staff = jdbc.queryForList("SELECT id FROM staff_user WHERE username = ? AND role = 'STAFF' AND enabled", Long.class, username);
        if (staff.isEmpty()) throw fail(HttpStatus.FORBIDDEN, "STAFF_REQUIRED", "Chỉ nhân viên mới được gắn tablet.");
        String code = secret();
        jdbc.update("UPDATE guest_pairing SET consumed_at = CURRENT_TIMESTAMP WHERE session_id = ? AND consumed_at IS NULL", sessionId);
        Instant expiry = jdbc.queryForObject("""
                INSERT INTO guest_pairing(code_hash, session_id, created_by, expires_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP + INTERVAL '5 minutes') RETURNING expires_at
                """, (rs, row) -> rs.getTimestamp(1).toInstant(), hash(code), sessionId, staff.getFirst());
        return new Pairing(code, expiry, session);
    }

    @Transactional
    public Binding bind(String code) {
        if (code == null || !code.matches("[A-Za-z0-9_-]{32}"))
            throw fail(HttpStatus.BAD_REQUEST, "PAIRING_INVALID", "Mã ghép không đúng, đã dùng hoặc hết hạn. Nhờ nhân viên tạo mã mới.");
        String digest = hash(code);
        var ids = jdbc.queryForList("SELECT session_id FROM guest_pairing WHERE code_hash = ?", Long.class, digest);
        if (ids.isEmpty()) throw fail(HttpStatus.BAD_REQUEST, "PAIRING_INVALID", "Mã ghép không đúng, đã dùng hoặc hết hạn. Nhờ nhân viên tạo mã mới.");
        var session = lockSession(ids.getFirst());
        requireOpen(session);
        int consumed = jdbc.update("""
                UPDATE guest_pairing SET consumed_at = CURRENT_TIMESTAMP
                WHERE code_hash = ? AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP
                """, digest);
        if (consumed != 1) throw fail(HttpStatus.BAD_REQUEST, "PAIRING_INVALID", "Mã ghép không đúng, đã dùng hoặc hết hạn. Nhờ nhân viên tạo mã mới.");
        String token = secret();
        jdbc.update("INSERT INTO guest_device(token_hash, session_id, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '12 hours')",
                hash(token), session.id());
        return new Binding(token, session);
    }

    private GuestSession authorize(String token, Long requestedSession) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{32}"))
            throw fail(HttpStatus.UNAUTHORIZED, "GUEST_REQUIRED", "Tablet chưa được gắn hoặc quyền đã hết hạn. Vui lòng gọi nhân viên.");
        var ids = jdbc.queryForList("SELECT session_id FROM guest_device WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP", Long.class, hash(token));
        if (ids.isEmpty()) throw fail(HttpStatus.UNAUTHORIZED, "GUEST_REQUIRED", "Tablet chưa được gắn hoặc quyền đã hết hạn. Vui lòng gọi nhân viên.");
        if (requestedSession != null && !ids.getFirst().equals(requestedSession))
            throw fail(HttpStatus.FORBIDDEN, "WRONG_SESSION", "Tablet không có quyền truy cập phiên bàn này.");
        return lockSession(ids.getFirst());
    }
    @Transactional
    public GuestSession session(String token) { return authorize(token, null); }

    @Transactional
    public List<Batch> orders(String token, long sessionId) {
        authorize(token, sessionId);
        return jdbc.queryForList("SELECT id FROM order_batch WHERE session_id = ? ORDER BY id", Long.class, sessionId)
                .stream().map(this::batch).toList();
    }
    @Transactional
    public Batch byKey(String token, long sessionId, UUID key) {
        authorize(token, sessionId);
        var ids = jdbc.queryForList("SELECT id FROM order_batch WHERE session_id = ? AND request_key = ?", Long.class, sessionId, key);
        if (ids.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Chưa thấy đợt gọi này. Có thể thử gửi lại bằng cùng khóa.");
        return batch(ids.getFirst());
    }
    private Batch batch(long id) {
        var items = jdbc.query("SELECT * FROM order_item WHERE batch_id = ? ORDER BY id", (rs, row) -> new Item(
                rs.getLong("id"), rs.getLong("menu_item_id"), rs.getString("item_name"), rs.getLong("unit_price_vnd"),
                rs.getInt("quantity"), rs.getString("note"), rs.getString("status")), id);
        return jdbc.queryForObject("SELECT * FROM order_batch WHERE id = ?", (rs, row) -> new Batch(id,
                rs.getObject("request_key", UUID.class), rs.getTimestamp("created_at").toInstant(), rs.getLong("total_vnd"), items), id);
    }
    private String validateAndHash(Submit request) {
        if (request == null || request.requestKey() == null || request.items() == null || request.items().isEmpty() || request.items().size() > 30)
            throw fail(HttpStatus.BAD_REQUEST, "INVALID_ORDER", "Một đợt cần từ 1 đến 30 dòng món và khóa gửi hợp lệ.");
        try {
            var bytes = new ByteArrayOutputStream();
            var out = new DataOutputStream(bytes);
            for (var line : request.items()) {
                if (line == null || line.menuItemId() == null || line.menuItemId() <= 0 || line.quantity() == null
                        || line.quantity() < 1 || line.quantity() > 20 || line.expectedPriceVnd() == null
                        || line.expectedPriceVnd() < 0 || line.expectedPriceVnd() > MAX_MONEY
                        || line.note() == null || line.note().length() > 300 || line.optionIds() == null || !line.optionIds().isEmpty())
                    throw fail(HttpStatus.BAD_REQUEST, "INVALID_ORDER", "Kiểm tra số lượng (1–20), giá, ghi chú (tối đa 300 ký tự). Menu hiện chưa có tùy chọn; không nhận tùy chọn lạ.");
                out.writeLong(line.menuItemId()); out.writeInt(line.quantity()); out.writeLong(line.expectedPriceVnd()); out.writeUTF(line.note());
            }
            return hash(bytes.toByteArray());
        } catch (java.io.IOException exception) { throw new IllegalStateException(exception); }
    }

    @Transactional
    public Batch submit(String token, long sessionId, Submit request) {
        var session = authorize(token, sessionId);
        String fingerprint = validateAndHash(request);
        var previous = jdbc.queryForList("SELECT id FROM order_batch WHERE session_id = ? AND request_key = ?", Long.class, sessionId, request.requestKey());
        if (!previous.isEmpty()) {
            String savedHash = jdbc.queryForObject("SELECT request_hash FROM order_batch WHERE id = ?", String.class, previous.getFirst());
            if (!fingerprint.equals(savedHash)) throw fail(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Khóa gửi đã được dùng cho nội dung khác. Hãy kiểm tra các món đã gọi.");
            return batch(previous.getFirst());
        }
        requireOpen(session);
        // Lock catalog rows in stable order, so accepted names/prices/availability stay valid until commit.
        var catalog = new java.util.HashMap<Long, CatalogItem>();
        request.items().stream().map(Line::menuItemId).distinct().sorted().forEach(id -> {
            var found = jdbc.query("SELECT id, name, price_vnd, available FROM menu_item WHERE id = ? FOR SHARE",
                    (rs, row) -> new CatalogItem(rs.getLong(1), rs.getString(2), rs.getLong(3), rs.getBoolean(4)), id);
            if (found.isEmpty()) throw fail(HttpStatus.CONFLICT, "ITEM_UNAVAILABLE", "Món không còn trong thực đơn. Vui lòng tải lại và sửa giỏ.");
            catalog.put(id, found.getFirst());
        });
        long total = 0;
        for (var line : request.items()) {
            var item = catalog.get(line.menuItemId());
            if (!item.available()) throw fail(HttpStatus.CONFLICT, "ITEM_UNAVAILABLE", item.name() + " đã hết món. Đợt gọi chưa được gửi; vui lòng sửa giỏ.");
            if (item.price() != line.expectedPriceVnd()) throw fail(HttpStatus.CONFLICT, "PRICE_CHANGED",
                    item.name() + " có giá hiện tại " + item.price() + " ₫. Đợt gọi chưa được gửi; tải lại giá và xem lại trước khi xác nhận.");
            if (item.price() > (MAX_MONEY - total) / line.quantity())
                throw fail(HttpStatus.BAD_REQUEST, "TOTAL_TOO_LARGE", "Tạm tính vượt giới hạn hỗ trợ.");
            total += item.price() * line.quantity();
        }
        Long id = jdbc.queryForObject("INSERT INTO order_batch(session_id, request_key, request_hash, total_vnd) VALUES (?, ?, ?, ?) RETURNING id",
                Long.class, sessionId, request.requestKey(), fingerprint, total);
        for (var line : request.items()) {
            var item = catalog.get(line.menuItemId());
            jdbc.update("INSERT INTO order_item(batch_id, menu_item_id, item_name, unit_price_vnd, quantity, note) VALUES (?, ?, ?, ?, ?, ?)",
                    id, item.id(), item.name(), item.price(), line.quantity(), line.note());
        }
        return batch(id);
    }
    private record CatalogItem(long id, String name, long price, boolean available) {}
}
