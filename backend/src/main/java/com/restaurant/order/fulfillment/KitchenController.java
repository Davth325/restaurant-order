package com.restaurant.order.fulfillment;

import jakarta.servlet.http.HttpSession;
import java.security.Principal;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@RequestMapping("/api/kitchen")
public class KitchenController {
    private final KitchenService service;
    private final KitchenEvents events;
    public KitchenController(KitchenService service, KitchenEvents events) { this.service = service; this.events = events; }
    public record Transition(String status) {}
    @GetMapping("/orders")
    public ResponseEntity<KitchenService.Snapshot> orders(Principal user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.snapshot(user.getName()));
    }
    @PostMapping("/units/{id}/status")
    public ResponseEntity<Void> status(Principal user, @PathVariable long id, @RequestBody Transition body) {
        service.transition(user.getName(), id, body.status());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> events(Principal user, HttpSession session) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Accel-Buffering", "no")
                .body(events.subscribe(session, user.getName()));
    }
}
