package com.swiftdrop.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.swiftdrop.auth.entity.User;
import com.swiftdrop.auth.exception.ApiErrors;
import com.swiftdrop.auth.repository.UserRepository;
import com.swiftdrop.auth.repository.RefreshSessionRepository;
import com.swiftdrop.auth.security.SessionCsrfFilter;
import com.swiftdrop.auth.service.AuthService;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.*;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.web.cors.*;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean UserDetailsService userDetailsService(UserRepository users) {
        return email -> {
            User user = users.findByEmail(AuthService.normalize(email)).orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
            return org.springframework.security.core.userdetails.User.withUsername(user.getEmail())
                .password(user.getPasswordHash() == null ? "{unusable}" : user.getPasswordHash())
                .roles(user.getRole().name()).disabled(!user.isActive() || user.getPasswordHash() == null).build();
        };
    }
    @Bean AuthenticationManager authenticationManager(UserDetailsService details, PasswordEncoder passwords) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(details);
        provider.setPasswordEncoder(passwords);
        return new ProviderManager(provider);
    }
    @Bean SecretKeySpec jwtKey(@Value("${app.jwt-secret}") String secret) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) throw new IllegalArgumentException("JWT_SECRET must contain at least 32 bytes");
        return new SecretKeySpec(bytes, "HmacSHA256");
    }
    @Bean JwtEncoder jwtEncoder(SecretKeySpec key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }
    @Bean JwtDecoder jwtDecoder(SecretKeySpec key, @Value("${app.jwt-issuer}") String issuer) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> audience = token -> token.getAudience().contains("swiftdrop-api")
            ? OAuth2TokenValidatorResult.success()
            : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Invalid audience", null));
        OAuth2TokenValidator<Jwt> required = token -> token.getExpiresAt() != null && token.getIssuedAt() != null
            ? OAuth2TokenValidatorResult.success()
            : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Missing token timestamps", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(new JwtTimestampValidator(Duration.ZERO),
            new JwtIssuerValidator(issuer), audience, required));
        return decoder;
    }
    @Bean CorsConfigurationSource corsConfigurationSource(@Value("${app.frontend-url}") String frontend) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(frontend));
        config.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-SwiftDrop-CSRF"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config); return source;
    }
    @Bean @Order(2)
    SecurityFilterChain apiSecurity(HttpSecurity http, UserRepository users, RefreshSessionRepository sessions,
            ObjectMapper mapper, @Value("${app.frontend-url}") String frontend) throws Exception {
        http.cors(c -> {}).csrf(c -> c.disable())
            .addFilterBefore(new SessionCsrfFilter(frontend, mapper), BearerTokenAuthenticationFilter.class)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(c -> c.disable()).formLogin(c -> c.disable()).httpBasic(c -> c.disable()).logout(c -> c.disable())
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/oauth/exchange", "/api/v1/auth/providers", "/api/v1/auth/refresh", "/api/v1/auth/logout").permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers("/api/v1/auth/admin/**").hasAnyRole("ADMIN", "DISPATCHER")
                .anyRequest().authenticated())
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> ApiErrors.write(mapper, res, 401, "Authentication required"))
                .accessDeniedHandler((req, res, ex) -> ApiErrors.write(mapper, res, 403, "Access denied")))
            .oauth2ResourceServer(o -> o
                .authenticationEntryPoint((req, res, ex) -> ApiErrors.write(mapper, res, 401, "Invalid or expired access token"))
                .accessDeniedHandler((req, res, ex) -> ApiErrors.write(mapper, res, 403, "Access denied"))
                .jwt(j -> j.jwtAuthenticationConverter(token -> {
                    User user;
                    try { user = users.findById(UUID.fromString(token.getSubject())).filter(User::isActive).orElseThrow(); }
                    catch (IllegalArgumentException | NoSuchElementException ex) { throw new BadCredentialsException("Account unavailable"); }
                    if (token.hasClaim("sid")) {
                        try {
                            var session = sessions.findById(UUID.fromString(token.getClaimAsString("sid")))
                                .filter(s -> s.isActive() && s.getUserId().equals(user.getId())).orElseThrow();
                        } catch (IllegalArgumentException | NoSuchElementException ex) { throw new BadCredentialsException("Session revoked"); }
                    }
                    return new JwtAuthenticationToken(token, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())), user.getId().toString());
                })));
        return http.build();
    }
}
