package com.swiftdrop.auth.controller;

import com.swiftdrop.auth.dto.AuthDtos.*;
import com.swiftdrop.auth.service.OAuthService;
import com.swiftdrop.auth.service.BrowserSessionService;
import com.swiftdrop.auth.security.SessionCookies;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth")
public class OAuthController {
    private final OAuthService oauth;
    private final ClientRegistrationRepository registrations;
    private final BrowserSessionService sessions;
    private final SessionCookies cookies;
    public OAuthController(OAuthService oauth, ClientRegistrationRepository registrations, BrowserSessionService sessions, SessionCookies cookies) {
        this.oauth = oauth; this.registrations = registrations; this.sessions = sessions; this.cookies = cookies;
    }
    @GetMapping("/providers")
    public ApiResponse<Map<String, Boolean>> providers() { return ApiResponse.ok(Map.of("google", registrations.findByRegistrationId("google") != null)); }
    @PostMapping("/oauth/exchange")
    public ResponseEntity<ApiResponse<LoginResult>> exchange(@Valid @RequestBody ExchangeRequest request, HttpServletRequest http, HttpServletResponse response) {
        LoginResult result = oauth.exchange(request.code(), request.verifier());
        if (cookies.requested(http)) {
            var session = sessions.start(result.user().id(), cookies.read(http));
            cookies.set(response, session); result = session.login();
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(result));
    }
}
