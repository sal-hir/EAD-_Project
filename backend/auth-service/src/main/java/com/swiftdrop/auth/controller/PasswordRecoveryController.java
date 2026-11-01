package com.swiftdrop.auth.controller;

import com.swiftdrop.auth.dto.AuthDtos.ApiResponse;
import com.swiftdrop.auth.service.PasswordRecoveryService;
import com.swiftdrop.auth.security.SessionCookies;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth/password")
public class PasswordRecoveryController {
    public record Forgot(@NotBlank @Email @Size(max=254) String email){@Override public String toString(){return "Forgot[redacted]";}}
    public record Reset(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String token,
        @NotBlank @Size(min=8,max=72) @Pattern(regexp="[\\x20-\\x7E]+") String newPassword){@Override public String toString(){return "Reset[redacted]";}}
    private final PasswordRecoveryService recovery;
    private final SessionCookies cookies;
    public PasswordRecoveryController(PasswordRecoveryService recovery,SessionCookies cookies){this.recovery=recovery;this.cookies=cookies;}
    @PostMapping("/forgot") public ResponseEntity<ApiResponse<Map<String,String>>> forgot(@Valid @RequestBody Forgot request,HttpServletRequest http){
        recovery.forgot(request.email(),http.getRemoteAddr());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(Map.of("message",PasswordRecoveryService.MESSAGE)));
    }
    @PostMapping("/reset") public ResponseEntity<Void> reset(@Valid @RequestBody Reset request,HttpServletResponse response){
        recovery.reset(request.token(),request.newPassword());cookies.clear(response);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
