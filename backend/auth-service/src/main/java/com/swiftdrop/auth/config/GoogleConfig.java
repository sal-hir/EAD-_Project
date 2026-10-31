package com.swiftdrop.auth.config;

import com.swiftdrop.auth.service.OAuthService;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.client.web.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.NullSecurityContextRepository;

@Configuration
public class GoogleConfig {
    @Bean ClientRegistrationRepository googleRegistration(
            @Value("${app.google-client-id}") String clientId,
            @Value("${app.google-client-secret}") String clientSecret,
            @Value("${app.google-redirect-uri}") String redirectUri) {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            LoggerFactory.getLogger(GoogleConfig.class).info("Google login disabled: configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
            return registrationId -> null;
        }
        return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("google")
            .clientId(clientId).clientSecret(clientSecret).authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri(redirectUri).scope("openid", "email", "profile")
            .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
            .tokenUri("https://oauth2.googleapis.com/token").jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
            .issuerUri("https://accounts.google.com").userInfoUri("https://openidconnect.googleapis.com/v1/userinfo")
            .userNameAttributeName("sub").clientName("Google").build());
    }
    @Bean @Order(1)
    SecurityFilterChain googleSecurity(HttpSecurity http, ClientRegistrationRepository registrations,
                                      OAuthService oauth, @Value("${app.frontend-url}") String frontend) throws Exception {
        DefaultOAuth2AuthorizationRequestResolver resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations, "/oauth2/authorization");
        OAuth2AuthorizationRequestResolver boundResolver = new OAuth2AuthorizationRequestResolver() {
            private org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest resolveBound(HttpServletRequest request, String id) {
                String challenge = request.getParameter("challenge");
                if (!"google".equals(id) || registrations.findByRegistrationId("google") == null || challenge == null || !challenge.matches("[A-Za-z0-9_-]{43}")) {
                    throw new OAuth2AuthenticationException(new OAuth2Error("invalid_request"));
                }
                request.getSession().setAttribute("browser_challenge", challenge);
                return resolver.resolve(request, id);
            }
            @Override public org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
                if (!request.getRequestURI().startsWith("/oauth2/authorization/")) return null;
                return resolveBound(request, request.getRequestURI().substring("/oauth2/authorization/".length()));
            }
            @Override public org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest resolve(HttpServletRequest request, String id) { return resolveBound(request, id); }
        };
        http.securityMatcher("/oauth2/**", "/login/oauth2/**")
            .authorizeHttpRequests(a -> a.anyRequest().permitAll())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
            .securityContext(s -> s.securityContextRepository(new NullSecurityContextRepository()))
            .requestCache(c -> c.disable())
            .oauth2Login(o -> o.authorizationEndpoint(a -> a.authorizationRequestResolver(boundResolver))
                .successHandler((request, response, authentication) -> {
                    try {
                        OidcUser principal = (OidcUser) authentication.getPrincipal();
                        HttpSession session = request.getSession(false);
                        String challenge = session == null ? null : (String) session.getAttribute("browser_challenge");
                        var user = oauth.googleUser(principal.getSubject(), principal.getEmail(), principal.getEmailVerified(), principal.getFullName());
                        String code = oauth.createCode(user, challenge);
                        invalidate(request);
                        response.setHeader("Cache-Control", "no-store");
                        response.setHeader("Referrer-Policy", "no-referrer");
                        // Fragment is not sent in HTTP requests or Referer headers.
                        response.sendRedirect(frontend + "/auth/callback#code=" + code);
                    } catch (RuntimeException ex) { failure(request, response, frontend); }
                })
                .failureHandler((request, response, exception) -> failure(request, response, frontend)));
        return http.build();
    }
    private static void invalidate(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
    }
    private static void failure(HttpServletRequest request, HttpServletResponse response, String frontend) throws IOException {
        invalidate(request);
        response.sendRedirect(frontend + "/login?error=google_auth_failed");
    }
}
