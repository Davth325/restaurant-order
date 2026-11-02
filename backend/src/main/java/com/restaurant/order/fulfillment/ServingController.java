package com.restaurant.order.fulfillment;

import jakarta.servlet.http.HttpSession;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication(type = org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication.Type.SERVLET)
@RequestMapping("/api/serving")
public class ServingController {
    private final ServingService service;
    private final KitchenEvents events;
    public ServingController(ServingService service, KitchenEvents events) { this.service = service; this.events = events; }
    @GetMapping("/orders")
    public ResponseEntity<ServingService.Snapshot> orders(Principal user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.snapshot(user.getName()));
    }
    @PostMapping("/units/{id}/actions")
    public ResponseEntity<Void> action(Principal user, @PathVariable long id, @RequestBody ServingService.Command body) {
        service.transition(user.getName(), id, body);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
    @GetMapping("/units/{id}/history")
    public ResponseEntity<List<ServingService.Operation>> history(Principal user, @PathVariable long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.history(user.getName(), id));
    }
    @GetMapping("/operations/{key}")
    public ResponseEntity<ServingService.Operation> operation(Principal user, @PathVariable UUID key) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.operation(user.getName(), key));
    }
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> events(Principal user, HttpSession session) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Accel-Buffering", "no")
                .body(events.subscribeServing(session, user.getName()));
    }
}
