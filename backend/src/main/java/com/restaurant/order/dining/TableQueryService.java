package com.restaurant.order.dining;

import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TableQueryService {
    private final RestaurantTableRepository tables;

    public TableQueryService(RestaurantTableRepository tables) {
        this.tables = tables;
    }

    @Transactional(readOnly = true)
    public TableSnapshot snapshot() {
        var result = tables.findAllByOrderByCodeAsc().stream().map(RestaurantTable::toView).toList();
        return new TableSnapshot(result, result.size(), Instant.now());
    }
}
