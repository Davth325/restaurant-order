package com.restaurant.order;

import com.restaurant.order.dining.TableOperationException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(TableOperationException.class)
    public ProblemDetail tableOperation(TableOperationException exception) {
        var problem = ProblemDetail.forStatusAndDetail(exception.status(), exception.getMessage());
        problem.setTitle("Chưa thể thực hiện thao tác bàn");
        problem.setProperty("code", exception.code());
        return problem;
    }

    @ExceptionHandler({DataAccessException.class, CannotCreateTransactionException.class})
    public ProblemDetail databaseUnavailable(Exception exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "Chưa đọc được dữ liệu nhà hàng. Vui lòng thử lại.");
        problem.setTitle("Tạm thời không kết nối được dữ liệu");
        return problem;
    }
}
