package com.restaurant.order.dining;

import java.util.List;
import org.springframework.data.repository.Repository;

public interface RestaurantTableRepository extends Repository<RestaurantTable, Long> {
    List<RestaurantTable> findAllByOrderByCodeAsc();
}
