package com.swiftdrop.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.auth.exception.ApiErrors;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

/** Custom-header CSRF defense, combined with an exact Origin allowlist and CORS. */
public class SessionCsrfFilter extends OncePerRequestFilter {
    private final String frontend;
    private final ObjectMapper mapper;
    public SessionCsrfFilter(String frontend, ObjectMapper mapper) { this.frontend = frontend; this.mapper = mapper; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if ("POST".equals(request.getMethod()) && Set.of("/api/v1/auth/login", "/api/v1/auth/oauth/exchange", "/api/v1/auth/refresh", "/api/v1/auth/logout").contains(path)) {
            String origin = request.getHeader("Origin");
            boolean cookieOperation = path.endsWith("/refresh") || path.endsWith("/logout") || origin != null || request.getHeader(SessionCookies.CSRF_HEADER) != null;
            if (cookieOperation && (!"1".equals(request.getHeader(SessionCookies.CSRF_HEADER)) || (origin != null && !frontend.equals(origin)))) {
                ApiErrors.write(mapper, response, 403, "Invalid session request origin or CSRF header"); return;
            }
        }
        chain.doFilter(request, response);
    }
}
