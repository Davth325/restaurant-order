package com.restaurant.order.ordering;

import com.restaurant.order.dining.TableOperationException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.security.Principal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class GuestOrderController {
    private final GuestOrderService service;
    private final boolean secure;
    public GuestOrderController(GuestOrderService service, @Value("${server.servlet.session.cookie.secure:false}") boolean secure) {
        this.service = service; this.secure = secure;
    }
    private static <T> ResponseEntity<T> ok(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
    @PostMapping("/api/staff/sessions/{id}/pairing")
    ResponseEntity<GuestOrderService.Pairing> pairing(@PathVariable long id, Principal principal) {
        return ok(service.createPairing(id, principal.getName()));
    }
    public record Redeem(String code) {}
    @PostMapping("/api/guest/pairing")
    ResponseEntity<GuestOrderService.GuestSession> redeem(@RequestBody Redeem request, Principal principal, HttpServletResponse response) {
        // Never hand a browser with staff authority to a guest, even if its guest cookie is separate.
        if (principal != null) throw new TableOperationException(HttpStatus.CONFLICT, "SEPARATE_BROWSER_REQUIRED",
                "Trình duyệt này đang đăng nhập nội bộ. Hãy mở cửa sổ khách riêng hoặc đăng xuất trước khi gắn tablet.");
        var binding = service.bind(request.code());
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from("GUEST_DEVICE", binding.token()).httpOnly(true)
                .secure(secure).sameSite("Strict").path("/api/guest").maxAge(Duration.ofHours(12)).build().toString());
        return ok(binding.session());
    }
    public static String token(HttpServletRequest request) {
        if (request.getCookies() != null) for (var cookie : request.getCookies())
            if (cookie.getName().equals("GUEST_DEVICE")) return cookie.getValue();
        return null;
    }
    @GetMapping("/api/guest/session")
    ResponseEntity<GuestOrderService.GuestSession> session(HttpServletRequest request) { return ok(service.session(token(request))); }
    @GetMapping("/api/guest/sessions/{id}/orders")
    ResponseEntity<List<GuestOrderService.Batch>> orders(@PathVariable long id, HttpServletRequest request) { return ok(service.orders(token(request), id)); }
    @GetMapping("/api/guest/sessions/{id}/orders/by-key/{key}")
    ResponseEntity<GuestOrderService.Batch> byKey(@PathVariable long id, @PathVariable UUID key, HttpServletRequest request) { return ok(service.byKey(token(request), id, key)); }
    @PostMapping("/api/guest/sessions/{id}/orders")
    ResponseEntity<GuestOrderService.Batch> submit(@PathVariable long id, @RequestBody GuestOrderService.Submit body, HttpServletRequest request) {
        return ok(service.submit(token(request), id, body));
    }
    @GetMapping("/api/staff/sessions/{id}")
    ResponseEntity<GuestOrderService.GuestSession> staffSession(@PathVariable long id, Principal principal) { return ok(service.staffSession(principal.getName(), id)); }
    @GetMapping("/api/staff/sessions/{id}/orders")
    ResponseEntity<List<GuestOrderService.Batch>> staffOrders(@PathVariable long id, Principal principal) { return ok(service.staffOrders(principal.getName(), id)); }
    @GetMapping("/api/staff/sessions/{id}/orders/by-key/{key}")
    ResponseEntity<GuestOrderService.Batch> staffByKey(@PathVariable long id, @PathVariable UUID key, Principal principal) { return ok(service.staffByKey(principal.getName(), id, key)); }
    @PostMapping("/api/staff/sessions/{id}/orders")
    ResponseEntity<GuestOrderService.Batch> staffSubmit(@PathVariable long id, @RequestBody GuestOrderService.Submit body, Principal principal) { return ok(service.staffSubmit(principal.getName(), id, body)); }
}
