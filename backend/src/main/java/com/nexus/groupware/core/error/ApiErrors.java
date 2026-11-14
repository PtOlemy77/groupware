package com.nexus.groupware.core.error;

import jakarta.persistence.OptimisticLockException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {
  public record ErrorResponse(String message) {}

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<ErrorResponse> status(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode().value())
        .body(new ErrorResponse(e.getReason() == null ? "요청을 처리할 수 없습니다." : e.getReason()));
  }

  @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
  ResponseEntity<ErrorResponse> invalid(Exception e) {
    return ResponseEntity.badRequest()
        .body(
            new ErrorResponse(
                e instanceof IllegalArgumentException ? e.getMessage() : "요청 형식이 올바르지 않습니다."));
  }

  @ExceptionHandler({
    OptimisticLockingFailureException.class,
    OptimisticLockException.class
  })
  ResponseEntity<ErrorResponse> conflict(Exception e) {
    return ResponseEntity.status(409)
        .body(new ErrorResponse("다른 사용자가 먼저 수정했습니다. 새로고침 후 변경 내용을 확인하세요."));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<ErrorResponse> constraint(Exception e) {
    return ResponseEntity.status(409)
        .body(new ErrorResponse("중복된 계정·번호 또는 연결된 데이터가 있습니다. 입력값을 확인하세요."));
  }
}
