package com.restaurant.order.dining;

import java.time.Instant;
import java.util.List;

public record TableSnapshot(List<TableView> tables, int total, Instant observedAt) { }
