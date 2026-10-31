package com.restaurant.order.dining;

import java.net.URI;
import java.security.Principal;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tables")
public class TableController {
    private final TableQueryService queries;
    private final TableSessionService sessions;

    public TableController(TableQueryService queries, TableSessionService sessions) {
        this.queries = queries;
        this.sessions = sessions;
    }

    @GetMapping
    public ResponseEntity<TableSnapshot> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(queries.snapshot());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TableView> table(@PathVariable long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(queries.table(id));
    }

    @PostMapping("/{id}/sessions")
    public ResponseEntity<TableView> open(@PathVariable long id, Principal principal) {
        return ResponseEntity.created(URI.create("/api/tables/" + id)).cacheControl(CacheControl.noStore())
                .body(sessions.open(id, principal.getName()));
    }
}
