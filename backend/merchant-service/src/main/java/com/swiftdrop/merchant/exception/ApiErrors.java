package com.swiftdrop.merchant.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.ConstraintViolationException;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

    public record Error(boolean success, int status, String message, Map<String, String> errors, String traceId, Instant timestamp) {}
    public static Error body(int status, String message) { return new Error(false, status, message, Map.of(), UUID.randomUUID().toString(), Instant.now()); }
    public static void write(ObjectMapper mapper, HttpServletResponse response, int status, String message) throws IOException { response.setStatus(status); response.setContentType("application/json"); mapper.writeValue(response.getOutputStream(), body(status, message)); }
    @ExceptionHandler(ApiFailure.class) ResponseEntity<Error> domain(ApiFailure failure) { return ResponseEntity.status(failure.status()).body(body(failure.status(), failure.getMessage())); }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<Error> validation(MethodArgumentNotValidException failure) {
        Map<String, String> fields = new LinkedHashMap<>(); failure.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new Error(false, 400, "Invalid application", fields, UUID.randomUUID().toString(), Instant.now()));
    }
    @ExceptionHandler(ConstraintViolationException.class) ResponseEntity<Error> constraintViolation(ConstraintViolationException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getConstraintViolations().forEach(v -> {
            String path = v.getPropertyPath().toString();
            String field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
            fields.putIfAbsent(field, v.getMessage());
        });
        return ResponseEntity.badRequest().body(new Error(false, 400, "Invalid request parameter", fields, UUID.randomUUID().toString(), Instant.now()));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class}) ResponseEntity<Error> malformed() { return ResponseEntity.badRequest().body(body(400, "Invalid request")); }
    @ExceptionHandler({DataIntegrityViolationException.class, org.springframework.orm.ObjectOptimisticLockingFailureException.class}) ResponseEntity<Error> conflict() { return ResponseEntity.status(409).body(body(409, "Application already exists or changed; reload and retry")); }
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class) ResponseEntity<Error> missing() { return ResponseEntity.status(404).body(body(404, "Endpoint unavailable")); }
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class) ResponseEntity<Error> method() { return ResponseEntity.status(405).body(body(405, "HTTP method unavailable")); }
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class) ResponseEntity<Error> mediaType() { return ResponseEntity.status(415).body(body(415, "Use application/json")); }
    @ExceptionHandler(Exception.class) ResponseEntity<Error> unexpected(Exception e) {
        Error body = body(500, "Operation unavailable");
        log.error("Merchant operation failed [traceId={}]", body.traceId(), e);
        return ResponseEntity.internalServerError().body(body);
    }
}
