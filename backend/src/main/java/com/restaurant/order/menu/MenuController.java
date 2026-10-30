package com.restaurant.order.menu;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/menu")
public class MenuController {
    private final MenuQueryService queries;

    public MenuController(MenuQueryService queries) {
        this.queries = queries;
    }

    @GetMapping
    public ResponseEntity<MenuSnapshot> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(queries.snapshot());
    }
}
