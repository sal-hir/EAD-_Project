package com.swiftdrop.auth.controller;

import com.swiftdrop.auth.dto.AuthDtos.*;
import com.swiftdrop.auth.exception.ApiException;
import com.swiftdrop.auth.security.SessionCookies;
import com.swiftdrop.auth.service.BrowserSessionService;
import jakarta.servlet.http.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth")
public class SessionController {
    private final BrowserSessionService sessions;
    private final SessionCookies cookies;
    public SessionController(BrowserSessionService sessions, SessionCookies cookies) { this.sessions = sessions; this.cookies = cookies; }
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResult>> refresh(HttpServletRequest request, HttpServletResponse response) {
        try {
            var result = sessions.rotate(cookies.read(request));
            cookies.set(response, result);
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(result.login()));
        } catch (ApiException ex) { cookies.clear(response); throw ex; }
    }
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        sessions.revoke(cookies.read(request)); cookies.clear(response);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
