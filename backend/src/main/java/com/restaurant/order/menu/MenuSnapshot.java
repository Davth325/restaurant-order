package com.restaurant.order.menu;

import java.time.Instant;
import java.util.List;

public record MenuSnapshot(List<Category> categories, int total, Instant observedAt) {
    public record Category(long id, String name, List<Item> items) { }
    public record Item(long id, String name, long priceVnd, String imagePath, boolean available) { }
}
