package com.restaurant.order;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler({DataAccessException.class, CannotCreateTransactionException.class})
    public ProblemDetail databaseUnavailable(Exception exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "Chưa đọc được dữ liệu nhà hàng. Vui lòng thử lại.");
        problem.setTitle("Tạm thời không kết nối được dữ liệu");
        return problem;
    }
}
