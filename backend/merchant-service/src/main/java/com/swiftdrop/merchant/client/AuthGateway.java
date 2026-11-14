package com.swiftdrop.merchant.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.swiftdrop.merchant.exception.ApiFailure;
import java.net.*;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;

@Component
public class AuthGateway implements IdentityGateway {
    private final RestClient client;private final String key;
    public AuthGateway(String url,String key){this(url,key,false);}
    @Autowired
    public AuthGateway(@Value("${app.auth-url}") String url,@Value("${app.service-token:}") String key,
            @Value("${app.auth-allow-docker-http:false}") boolean allowDockerHttp){
        URI uri=URI.create(url);
        boolean localHost=uri.getHost()!=null&&Set.of("localhost","127.0.0.1","[::1]").contains(uri.getHost());
        boolean dockerHost=allowDockerHttp&&"auth-service".equals(uri.getHost());
        if(!"https".equals(uri.getScheme())&&!("http".equals(uri.getScheme())&&(localHost||dockerHost)))
            throw new IllegalArgumentException("Auth Service communication requires HTTPS outside localhost");
        var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build());
        factory.setReadTimeout(Duration.ofSeconds(8));client=RestClient.builder().baseUrl(url).requestFactory(factory).build();this.key=key;
    }
    @Override public Caller validate(String token){
        try{
            JsonNode body=client.get().uri("/api/v1/auth/me").headers(h->h.setBearerAuth(token)).retrieve().body(JsonNode.class);
            JsonNode profile=body==null?null:body.path("data");
            if(profile==null||!body.path("success").asBoolean()||!profile.path("active").asBoolean())throw new ApiFailure(401,"Identity unavailable");
            return new Caller(UUID.fromString(profile.path("id").asText()),profile.path("role").asText());
        }catch(RestClientResponseException e){throw new ApiFailure(e.getStatusCode().value()==401?401:503,"Authentication unavailable");}
        catch(RestClientException|IllegalArgumentException e){throw new ApiFailure(503,"Authentication unavailable");}
    }
    @Override public void grantMerchant(String token,UUID application,UUID applicant){
        if(key.length()<32)throw new ApiFailure(503,"Merchant integration is not configured");
        try{
            JsonNode body=client.post().uri("/api/v1/auth/internal/merchant-approvals/{id}",application)
                .headers(h->{h.setBearerAuth(token);h.set("X-SwiftDrop-Service-Key",key);})
                .body(Map.of("userId",applicant)).retrieve().body(JsonNode.class);
            if(body==null||!body.path("success").asBoolean()||!applicant.toString().equals(body.path("data").path("id").asText())||!"MERCHANT".equals(body.path("data").path("role").asText()))throw new ApiFailure(503,"Role synchronization unavailable");
        }catch(RestClientException e){throw new ApiFailure(503,"Role synchronization unavailable");}
    }
}
