package com.restaurant.order.dining;

import org.springframework.http.HttpStatus;

public class TableOperationException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public TableOperationException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
}
