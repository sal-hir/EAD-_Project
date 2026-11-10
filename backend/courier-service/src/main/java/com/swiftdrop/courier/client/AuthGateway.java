package com.swiftdrop.courier.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.swiftdrop.courier.exception.ApiFailure;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;

@Component
public class AuthGateway implements IdentityGateway {
    private final RestClient client;

    public AuthGateway(@Value("${app.auth-url}") String url) {
        URI uri = URI.create(url);
        if (!"https".equals(uri.getScheme()) && !("http".equals(uri.getScheme()) && Set.of("localhost", "127.0.0.1", "[::1]").contains(uri.getHost()))) {
            if (uri.getHost() == null || !uri.getHost().contains("auth-service")) {
                throw new IllegalArgumentException("Auth Service communication requires HTTPS or local network");
            }
        }
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(8));
        this.client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    @Override
    public Caller validate(String token) {
        try {
            JsonNode body = client.get()
                .uri("/api/v1/auth/me")
                .headers(h -> h.setBearerAuth(token))
                .retrieve()
                .body(JsonNode.class);

            JsonNode profile = body == null ? null : body.path("data");
            if (profile == null || !body.path("success").asBoolean() || !profile.path("active").asBoolean(true)) {
                throw new ApiFailure(401, "Identity unavailable or account deactivated");
            }

            return new Caller(
                UUID.fromString(profile.path("id").asText()),
                profile.path("role").asText(),
                profile.path("email").asText(null),
                profile.path("name").asText(null),
                profile.path("phone").asText(null)
            );
        } catch (RestClientResponseException e) {
            throw new ApiFailure(e.getStatusCode().value() == 401 ? 401 : 503, "Authentication failed");
        } catch (RestClientException | IllegalArgumentException e) {
            throw new ApiFailure(503, "Authentication service unreachable");
        }
    }
}
