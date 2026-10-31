package com.swiftdrop.auth.exception;

import jakarta.servlet.http.HttpServletResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;

@RestControllerAdvice
public class ApiErrors {
    public record ErrorBody(boolean success, int status, String message, Map<String, String> errors, Instant timestamp) {}
    public static ErrorBody body(int status, String message, Map<String, String> errors) {
        return new ErrorBody(false, status, message, errors, Instant.now());
    }
    public static void write(ObjectMapper mapper, HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status); response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), body(status, message, Map.of()));
    }
    private ResponseEntity<ErrorBody> response(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(body(status.value(), message, Map.of()));
    }
    @ExceptionHandler(ApiException.class) ResponseEntity<ErrorBody> api(ApiException e) { return response(e.getStatus(), e.getMessage()); }
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<ErrorBody> validation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new java.util.LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        return ResponseEntity.badRequest().body(body(400, "Invalid request", fields));
    }
    @ExceptionHandler(HttpMessageNotReadableException.class) ResponseEntity<ErrorBody> malformed() { return response(HttpStatus.BAD_REQUEST, "Invalid request body"); }
    @ExceptionHandler(AuthenticationException.class) ResponseEntity<ErrorBody> credentials() { return response(HttpStatus.UNAUTHORIZED, "Invalid credentials or account unavailable"); }
    @ExceptionHandler(AccessDeniedException.class) ResponseEntity<ErrorBody> forbidden() { return response(HttpStatus.FORBIDDEN, "Access denied"); }
    @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<ErrorBody> conflict() { return response(HttpStatus.CONFLICT, "Account already exists or identity is unavailable"); }
    @ExceptionHandler(NoResourceFoundException.class) ResponseEntity<ErrorBody> missing() { return response(HttpStatus.NOT_FOUND, "Endpoint unavailable"); }
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class) ResponseEntity<ErrorBody> method() { return response(HttpStatus.METHOD_NOT_ALLOWED, "HTTP method unavailable"); }
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class) ResponseEntity<ErrorBody> mediaType() { return response(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Use application/json"); }
    @ExceptionHandler(Exception.class) ResponseEntity<ErrorBody> unexpected(Exception e) {
        LoggerFactory.getLogger(ApiErrors.class).error("Unexpected request failure", e);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected server error");
    }
}
