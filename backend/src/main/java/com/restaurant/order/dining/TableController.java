package com.restaurant.order.dining;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tables")
public class TableController {
    private final TableQueryService queries;

    public TableController(TableQueryService queries) {
        this.queries = queries;
    }

    @GetMapping
    public ResponseEntity<TableSnapshot> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(queries.snapshot());
    }
}
