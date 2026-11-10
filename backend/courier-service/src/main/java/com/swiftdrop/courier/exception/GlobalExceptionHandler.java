package com.swiftdrop.courier.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiFailure.class)
    public ResponseEntity<Map<String, Object>> handleApiFailure(ApiFailure ex) {
        return ResponseEntity.status(ex.status()).body(Map.of(
            "success", false,
            "status", ex.status(),
            "message", ex.getMessage()
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(err -> err.getField() + " " + err.getDefaultMessage())
            .orElse("Validation failed");
        return ResponseEntity.status(400).body(Map.of(
            "success", false,
            "status", 400,
            "message", msg
        ));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxSize(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(400).body(Map.of(
            "success", false,
            "status", 400,
            "message", "File size exceeds the 10MB limit"
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        return ResponseEntity.status(500).body(Map.of(
            "success", false,
            "status", 500,
            "message", "An unexpected error occurred: " + ex.getMessage()
        ));
    }
}

