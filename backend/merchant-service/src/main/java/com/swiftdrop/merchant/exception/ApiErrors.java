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
        return ResponseEntity.badRequest().body(new Error(false,400,"Invalid application",fields,Instant.now()));
    }
    @ExceptionHandler({HttpMessageNotReadableException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class}) ResponseEntity<Error> malformed(){return ResponseEntity.badRequest().body(body(400,"Invalid request"));}
    @ExceptionHandler({DataIntegrityViolationException.class,org.springframework.orm.ObjectOptimisticLockingFailureException.class}) ResponseEntity<Error> conflict(){return ResponseEntity.status(409).body(body(409,"Application already exists or changed; reload and retry"));}
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class) ResponseEntity<Error> missing(){return ResponseEntity.status(404).body(body(404,"Endpoint unavailable"));}
    @ExceptionHandler(Exception.class) ResponseEntity<Error> unexpected(){org.slf4j.LoggerFactory.getLogger(getClass()).error("Merchant operation failed; no credentials or request contents logged");return ResponseEntity.internalServerError().body(body(500,"Operation unavailable"));}
}
