package com.restaurant.order.dining;

import java.time.Instant;

public record TableSessionView(long id, String status, Instant openedAt, OpenedBy openedBy) {
    public record OpenedBy(long id, String username, String displayName) { }
}
