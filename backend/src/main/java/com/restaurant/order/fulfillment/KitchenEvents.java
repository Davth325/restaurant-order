package com.restaurant.order.fulfillment;

import jakarta.servlet.http.HttpSession;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
@EnableScheduling
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class KitchenEvents {
    private record Subscriber(HttpSession session, String username, boolean serving) {}
    private final ConcurrentHashMap<SseEmitter, Subscriber> subscribers = new ConcurrentHashMap<>();
    private final KitchenService service;
    private final ServingService serving;
    public KitchenEvents(KitchenService service, ServingService serving) { this.service = service; this.serving = serving; }

    public SseEmitter subscribe(HttpSession session, String username) {
        return subscribe(session, username, false);
    }
    public SseEmitter subscribeServing(HttpSession session, String username) {
        return subscribe(session, username, true);
    }
    private SseEmitter subscribe(HttpSession session, String username, boolean isServing) {
        if (isServing) serving.requireReader(username); else service.requireKitchen(username);
        var emitter = new SseEmitter(60000L);
        subscribers.put(emitter, new Subscriber(session, username, isServing));
        emitter.onCompletion(() -> subscribers.remove(emitter));
        emitter.onTimeout(() -> { subscribers.remove(emitter); emitter.complete(); });
        emitter.onError(error -> subscribers.remove(emitter));
        send(emitter, subscribers.get(emitter), "connected");
        return emitter;
    }
    private void send(SseEmitter emitter, Subscriber subscriber, String name) {
        try {
            Object value = subscriber.session().getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
            if (!(value instanceof SecurityContext context) || context.getAuthentication() == null
                    || !subscriber.username().equals(context.getAuthentication().getName())) throw new IllegalStateException("Session ended");
            if (subscriber.serving()) serving.requireReader(subscriber.username()); else service.requireKitchen(subscriber.username());
            emitter.send(SseEmitter.event().name(name).data("reload"));
        } catch (Exception exception) {
            subscribers.remove(emitter);
            emitter.complete();
        }
    }
    // No order payload or credential is held in memory or sent before commit.
    @TransactionalEventListener
    public void changed(KitchenChanged event) { subscribers.forEach((emitter, subscriber) -> send(emitter, subscriber, "changed")); }
    @Scheduled(fixedDelay = 10000)
    public void heartbeat() { subscribers.forEach((emitter, subscriber) -> send(emitter, subscriber, "heartbeat")); }
}
