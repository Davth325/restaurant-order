package com.restaurant.order.menu;

import java.util.List;
import org.springframework.data.repository.Repository;

public interface MenuCategoryRepository extends Repository<MenuCategory, Long> {
    List<MenuCategory> findAllByOrderByDisplayOrderAscIdAsc();
}
