package com.swiftdrop.auth.security;

import com.swiftdrop.auth.service.BrowserSessionService.SessionResult;
import jakarta.servlet.http.*;
import java.time.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;

@Component
public class SessionCookies {
    public static final String NAME = "swiftdrop_refresh";
    public static final String CSRF_HEADER = "X-SwiftDrop-CSRF";
    private final boolean secure;
    public SessionCookies(@Value("${server.servlet.session.cookie.secure:false}") boolean secure) { this.secure = secure; }
    public boolean requested(HttpServletRequest request) { return "1".equals(request.getHeader(CSRF_HEADER)); }
    public String read(HttpServletRequest request) {
        if (request.getCookies() != null) for (Cookie cookie : request.getCookies())
            if (NAME.equals(cookie.getName())) return cookie.getValue();
        return null;
    }
    private void write(HttpServletResponse response, String value, Duration age) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(NAME, value).httpOnly(true)
            .secure(secure).sameSite("Lax").path("/api/v1/auth").maxAge(age).build().toString());
    }
    public void set(HttpServletResponse response, SessionResult result) {
        write(response, result.refreshToken(), Duration.between(Instant.now(), result.expiresAt()));
    }
    public void clear(HttpServletResponse response) { write(response, "", Duration.ZERO); }
}
