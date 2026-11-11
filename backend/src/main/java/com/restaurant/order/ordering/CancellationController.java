package com.restaurant.order.ordering;

import jakarta.servlet.http.HttpServletRequest;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class CancellationController {
    private final CancellationService service;
    public CancellationController(CancellationService service) { this.service = service; }
    private static <T> ResponseEntity<T> ok(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
    @GetMapping("/api/guest/sessions/{id}/cancellations")
    ResponseEntity<List<CancellationService.Unit>> units(@PathVariable long id, HttpServletRequest request) { return ok(service.guestUnits(GuestOrderController.token(request), id)); }
    @PostMapping("/api/guest/sessions/{id}/cancellations/cancel")
    ResponseEntity<Void> cancel(@PathVariable long id, @RequestBody CancellationService.GuestCancellation body, HttpServletRequest request) {
        service.cancel(GuestOrderController.token(request), id, body); return ok(null);
    }
    @GetMapping("/api/guest/sessions/{id}/cancellations/cancel/by-key/{key}")
    ResponseEntity<CancellationService.GuestCancellation> guestReceipt(@PathVariable long id, @PathVariable UUID key, HttpServletRequest request) { return ok(service.guestReceipt(GuestOrderController.token(request), id, key)); }
    @GetMapping("/api/cancellations/units")
    ResponseEntity<List<CancellationService.Unit>> internal(Principal principal) { return ok(service.internalUnits(principal.getName())); }
    @PostMapping("/api/cancellations/actions")
    ResponseEntity<Void> decide(@RequestBody CancellationService.Command body, Principal principal) { service.decide(principal.getName(), body); return ok(null); }
    @GetMapping("/api/cancellations/operations/{key}")
    ResponseEntity<CancellationService.Operation> receipt(@PathVariable UUID key, Principal principal) { return ok(service.receipt(principal.getName(), key)); }
    @GetMapping("/api/cancellations/units/{id}/history")
    ResponseEntity<List<CancellationService.Operation>> history(@PathVariable long id, Principal principal) { return ok(service.history(principal.getName(), id)); }
}
