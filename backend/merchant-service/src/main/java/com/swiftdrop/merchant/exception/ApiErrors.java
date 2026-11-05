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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

    /** Standard error response body returned by every API error. */
    public record Error(boolean success, int status, String message, Map<String, String> errors, String traceId, Instant timestamp) {}
    public static Error body(int status, String message) { return body(status, message, Map.of()); }
    public static Error body(int status, String message, Map<String, String> errors) { return new Error(false, status, message, errors, UUID.randomUUID().toString(), Instant.now()); }
    /** Writes a JSON error body directly to the servlet response (for use in filters). */
    public static void write(ObjectMapper mapper, HttpServletResponse response, int status, String message) throws IOException { response.setStatus(status); response.setContentType("application/json"); mapper.writeValue(response.getOutputStream(), body(status, message)); }
    private ResponseEntity<Error> response(HttpStatus status, String message) { return ResponseEntity.status(status).body(body(status.value(), message)); }

    // ── Domain / business errors ─────────────────────────────────────────
    @ExceptionHandler(ApiFailure.class) ResponseEntity<Error> domain(ApiFailure failure) { return ResponseEntity.status(failure.status()).body(body(failure.status(), failure.getMessage())); }

    // ── 400 Bad Request ──────────────────────────────────────────────────
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<Error> validation(MethodArgumentNotValidException failure) {
        Map<String, String> fields = new LinkedHashMap<>(); failure.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        return ResponseEntity.badRequest().body(body(400, "Invalid application", fields));
    }
    @ExceptionHandler(ConstraintViolationException.class) ResponseEntity<Error> constraintViolation(ConstraintViolationException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getConstraintViolations().forEach(v -> {
            String path = v.getPropertyPath().toString();
            String field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
            fields.putIfAbsent(field, v.getMessage());
        });
        return ResponseEntity.badRequest().body(body(400, "Invalid request parameter", fields));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class}) ResponseEntity<Error> malformed() { return response(HttpStatus.BAD_REQUEST, "Invalid request"); }
    @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class) ResponseEntity<Error> missingParam() { return response(HttpStatus.BAD_REQUEST, "Invalid request parameter"); }
    @ExceptionHandler(MissingRequestHeaderException.class) ResponseEntity<Error> missingHeader(MissingRequestHeaderException e) { return response(HttpStatus.BAD_REQUEST, "Missing required header: " + e.getHeaderName()); }

    // ── 403 Forbidden ────────────────────────────────────────────────────
    @ExceptionHandler(AccessDeniedException.class) ResponseEntity<Error> forbidden() { return response(HttpStatus.FORBIDDEN, "Access denied"); }

    // ── 404 Not Found ────────────────────────────────────────────────────
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class) ResponseEntity<Error> missing() { return response(HttpStatus.NOT_FOUND, "Endpoint unavailable"); }

    // ── 405 Method Not Allowed ───────────────────────────────────────────
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class) ResponseEntity<Error> method() { return response(HttpStatus.METHOD_NOT_ALLOWED, "HTTP method unavailable"); }

    // ── 406 Not Acceptable ───────────────────────────────────────────────
    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class) ResponseEntity<Error> notAcceptable() { return response(HttpStatus.NOT_ACCEPTABLE, "Requested media type is not supported"); }

    // ── 409 Conflict ─────────────────────────────────────────────────────
    @ExceptionHandler({DataIntegrityViolationException.class, org.springframework.orm.ObjectOptimisticLockingFailureException.class}) ResponseEntity<Error> conflict() { return response(HttpStatus.CONFLICT, "Application already exists or changed; reload and retry"); }

    // ── 415 Unsupported Media Type ───────────────────────────────────────
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class) ResponseEntity<Error> mediaType() { return response(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Use application/json"); }

    // ── 500 Internal Server Error (catch-all) ────────────────────────────
    @ExceptionHandler(Exception.class) ResponseEntity<Error> unexpected(Exception e) {
        Error body = body(500, "Operation unavailable");
        log.error("Merchant operation failed [traceId={}]", body.traceId(), e);
        return ResponseEntity.internalServerError().body(body);
    }
}
