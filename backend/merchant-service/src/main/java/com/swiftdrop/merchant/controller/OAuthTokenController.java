package com.swiftdrop.merchant.controller;

import com.swiftdrop.merchant.dto.OAuthDtos.Token;
import com.swiftdrop.merchant.exception.OAuthFailure;
import com.swiftdrop.merchant.service.OAuthClientService;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.dao.DataAccessException;
import org.springframework.http.*;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/oauth/token")
public class OAuthTokenController {
    private final OAuthClientService clients;
    public OAuthTokenController(OAuthClientService clients) { this.clients=clients; }
    @PostMapping(consumes=MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Token> token(@RequestBody MultiValueMap<String,String> form,HttpServletRequest request) {
        if (request.getQueryString()!=null || request.getHeader("X-API-Key")!=null ||
                !Set.of("grant_type","scope").containsAll(form.keySet()) || form.values().stream().anyMatch(v->v.size()!=1))
            throw new OAuthFailure(400,"invalid_request");
        var headers=Collections.list(request.getHeaders("Authorization"));
        if (headers.size()!=1 || headers.getFirst().length()>1024 || !headers.getFirst().regionMatches(true,0,"Basic ",0,6))
            throw new OAuthFailure(401,"invalid_client");
        String clientId,secret;
        try {
            String decoded=new String(Base64.getDecoder().decode(headers.getFirst().substring(6)),StandardCharsets.UTF_8);
            int split=decoded.indexOf(':'); if (split<=0) throw new IllegalArgumentException();
            clientId=URLDecoder.decode(decoded.substring(0,split),StandardCharsets.UTF_8);
            secret=URLDecoder.decode(decoded.substring(split+1),StandardCharsets.UTF_8);
        } catch (IllegalArgumentException invalid) { throw new OAuthFailure(401,"invalid_client"); }
        if (!form.containsKey("grant_type")) throw new OAuthFailure(400,"invalid_request");
        if (!"client_credentials".equals(form.getFirst("grant_type"))) throw new OAuthFailure(400,"unsupported_grant_type");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Pragma","no-cache")
            .body(clients.issue(clientId,secret,form.getFirst("scope")));
    }
    @ExceptionHandler(OAuthFailure.class) public ResponseEntity<Map<String,String>> failure(OAuthFailure failure) {
        var response=ResponseEntity.status(failure.status()).cacheControl(CacheControl.noStore()).header("Pragma","no-cache");
        if (failure.status()==401) response.header("WWW-Authenticate","Basic realm=\"merchant-token\"");
        if (failure.status()==503) response.header("Retry-After","60");
        return response.body(Map.of("error",failure.error()));
    }
    @ExceptionHandler(DataAccessException.class) public ResponseEntity<Map<String,String>> unavailable() {
        return failure(new OAuthFailure(503,"temporarily_unavailable"));
    }
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String,String>> malformed() { return failure(new OAuthFailure(400,"invalid_request")); }
}
