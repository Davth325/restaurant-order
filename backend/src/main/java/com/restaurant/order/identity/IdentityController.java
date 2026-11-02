package com.restaurant.order.identity;

import java.security.Principal;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class IdentityController {
    private final JdbcTemplate jdbc;

    public IdentityController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record StaffView(String username, String displayName, String role) { }
    public record CsrfView(String token, String headerName) { }

    @GetMapping("/api/auth/csrf")
    public ResponseEntity<CsrfView> csrf(CsrfToken csrf) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new CsrfView(csrf.getToken(), csrf.getHeaderName()));
    }

    @GetMapping("/api/auth/me")
    public ResponseEntity<StaffView> me(Principal principal) {
        var staff = jdbc.queryForObject("SELECT username, display_name, role FROM staff_user WHERE username = ?",
                (row, index) -> new StaffView(row.getString("username"), row.getString("display_name"), row.getString("role")),
                principal.getName());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(staff);
    }

    @GetMapping("/api/kitchen/workspace")
    public ResponseEntity<Map<String, String>> kitchen() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(Map.of("message", "Khu vực bếp: xem hàng đợi, bắt đầu làm và hoàn thành từng suất."));
    }
}
