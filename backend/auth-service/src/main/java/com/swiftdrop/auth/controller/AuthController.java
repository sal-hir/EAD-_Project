package com.swiftdrop.auth.controller;

import com.swiftdrop.auth.dto.AuthDtos.*;
import com.swiftdrop.auth.service.AuthService;
import com.swiftdrop.auth.service.BrowserSessionService;
import com.swiftdrop.auth.security.SessionCookies;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth;
    private final BrowserSessionService sessions;
    private final SessionCookies cookies;
    public AuthController(AuthService auth, BrowserSessionService sessions, SessionCookies cookies) { this.auth = auth; this.sessions = sessions; this.cookies = cookies; }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Profile> register(@Valid @RequestBody RegisterRequest request) { return ApiResponse.ok(auth.register(request)); }
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResult>> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http, HttpServletResponse response) {
        LoginResult result = auth.login(request);
        if (cookies.requested(http)) {
            var session = sessions.start(result.user().id(), cookies.read(http));
            cookies.set(response, session); result = session.login();
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(result));
    }
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Profile>> me(Authentication principal) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(Profile.from(auth.current(UUID.fromString(principal.getName())))));
    }
    // A real, read-only identity operation to demonstrate staff authorization.
    @GetMapping("/admin/me")
    public ApiResponse<Profile> staff(Authentication principal) { return ApiResponse.ok(Profile.from(auth.current(UUID.fromString(principal.getName())))); }
}
