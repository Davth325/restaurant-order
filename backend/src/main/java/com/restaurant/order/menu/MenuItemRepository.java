package com.restaurant.order.menu;

import java.util.List;
import org.springframework.data.repository.Repository;

public interface MenuItemRepository extends Repository<MenuItem, Long> {
    List<MenuItem> findAllByOrderByDisplayOrderAscIdAsc();
}
