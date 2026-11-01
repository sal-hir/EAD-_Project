package com.swiftdrop.auth.controller;

import com.swiftdrop.auth.dto.AuthDtos.*;
import com.swiftdrop.auth.service.MerchantRoleService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth/internal/merchant-approvals")
public class MerchantRoleController {
    public record Grant(@NotNull UUID userId) {}
    private final MerchantRoleService roles;
    public MerchantRoleController(MerchantRoleService roles){this.roles=roles;}
    @PostMapping("/{application}") public ResponseEntity<ApiResponse<Profile>> grant(Authentication actor,@PathVariable UUID application,
            @RequestHeader(value="X-SwiftDrop-Service-Key",required=false) String key,@Valid @RequestBody Grant request){
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(roles.grant(UUID.fromString(actor.getName()),application,request.userId(),key)));
    }
}
