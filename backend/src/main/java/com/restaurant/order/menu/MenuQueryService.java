package com.restaurant.order.menu;

import java.time.Instant;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MenuQueryService {
    private final MenuCategoryRepository categories;
    private final MenuItemRepository items;

    public MenuQueryService(MenuCategoryRepository categories, MenuItemRepository items) {
        this.categories = categories;
        this.items = items;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public MenuSnapshot snapshot() {
        var orderedCategories = categories.findAllByOrderByDisplayOrderAscIdAsc();
        var orderedItems = items.findAllByOrderByDisplayOrderAscIdAsc();
        var byCategory = orderedItems.stream().collect(Collectors.groupingBy(MenuItem::categoryId));
        var result = orderedCategories.stream().map(category -> new MenuSnapshot.Category(
                category.id(), category.name(), byCategory.getOrDefault(category.id(), java.util.List.of())
                        .stream().map(MenuItem::toView).toList())).toList();
        return new MenuSnapshot(result, orderedItems.size(), Instant.now());
    }
}
