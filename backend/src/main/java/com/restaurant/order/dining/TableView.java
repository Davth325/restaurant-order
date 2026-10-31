package com.restaurant.order.dining;

public record TableView(long id, String code, String displayName, String area, int seats, String status,
        TableSessionView currentSession) { }
