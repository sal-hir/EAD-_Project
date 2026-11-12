package com.swiftdrop.courier.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.courier.client.IdentityGateway;
import com.swiftdrop.courier.exception.ApiErrors;
import com.swiftdrop.courier.exception.ApiFailure;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class IdentityFilter extends OncePerRequestFilter {
    private final IdentityGateway identities;
    private final ObjectMapper mapper;

    public IdentityFilter(IdentityGateway identities, ObjectMapper mapper) {
        this.identities = identities;
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (path.startsWith("/actuator/health") || path.startsWith("/uploads/") || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ") || header.length() > 8192) {
            ApiErrors.write(mapper, response, 401, "Authentication required");
            return;
        }

        try {
            var caller = identities.validate(header.substring(7));
            var auth = UsernamePasswordAuthenticationToken.authenticated(
                caller,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + caller.role()))
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
        } catch (ApiFailure failure) {
            ApiErrors.write(mapper, response, failure.status(), failure.getMessage());
            return;
        }

        chain.doFilter(request, response);
    }
}

