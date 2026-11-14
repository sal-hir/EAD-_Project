package com.swiftdrop.merchant.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiErrors {
    public record Error(boolean success,int status,String message,Map<String,String> errors,Instant timestamp){}
    public static Error body(int status,String message){return new Error(false,status,message,Map.of(),Instant.now());}
    public static void write(ObjectMapper mapper,HttpServletResponse response,int status,String message)throws IOException{response.setStatus(status);response.setContentType("application/json");mapper.writeValue(response.getOutputStream(),body(status,message));}
    @ExceptionHandler(ApiFailure.class) ResponseEntity<Error> domain(ApiFailure failure){return ResponseEntity.status(failure.status()).body(body(failure.status(),failure.getMessage()));}
    @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<Error> validation(MethodArgumentNotValidException failure){
        Map<String,String> fields=new LinkedHashMap<>();failure.getBindingResult().getFieldErrors().forEach(f->fields.putIfAbsent(f.getField(),f.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new Error(false,400,"Invalid request",fields,Instant.now()));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class}) ResponseEntity<Error> malformed(){return ResponseEntity.badRequest().body(body(400,"Invalid request"));}
    @ExceptionHandler({DataIntegrityViolationException.class,org.springframework.orm.ObjectOptimisticLockingFailureException.class}) ResponseEntity<Error> conflict(){return ResponseEntity.status(409).body(body(409,"Application already exists or changed; reload and retry"));}
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class) ResponseEntity<Error> missing(){return ResponseEntity.status(404).body(body(404,"Endpoint unavailable"));}
    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    ResponseEntity<Error> method(org.springframework.web.HttpRequestMethodNotSupportedException failure) {
        return ResponseEntity.status(405).allow(failure.getSupportedHttpMethods()==null?new HttpMethod[0]:failure.getSupportedHttpMethods().toArray(HttpMethod[]::new))
            .body(body(405,"HTTP method not supported"));
    }
    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    ResponseEntity<Error> mediaType(){return ResponseEntity.status(415).body(body(415,"Content-Type must be application/json"));}
    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotAcceptableException.class)
    ResponseEntity<Error> accept(){return ResponseEntity.status(406).body(body(406,"Requested response format unavailable"));}
    @ExceptionHandler({org.springframework.dao.DataAccessResourceFailureException.class,org.springframework.dao.QueryTimeoutException.class,
        org.springframework.transaction.CannotCreateTransactionException.class})
    ResponseEntity<Error> unavailable(){return ResponseEntity.status(503).body(body(503,"Storage temporarily unavailable"));}
    @ExceptionHandler(Exception.class) ResponseEntity<Error> unexpected(){org.slf4j.LoggerFactory.getLogger(getClass()).error("Merchant operation failed; no credentials or request contents logged");return ResponseEntity.internalServerError().body(body(500,"Operation unavailable"));}
}
