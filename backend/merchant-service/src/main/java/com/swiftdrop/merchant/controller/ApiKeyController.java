package com.swiftdrop.merchant.controller;

import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.dto.ApiKeyDtos.*;
import com.swiftdrop.merchant.dto.MerchantDtos.Envelope;
import com.swiftdrop.merchant.service.ApiKeyService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ApiKeyController {
    private final ApiKeyService keys;
    public ApiKeyController(ApiKeyService keys) { this.keys = keys; }
    @GetMapping("/merchants/api-keys")
    public ResponseEntity<Envelope<KeyList>> own(@AuthenticationPrincipal Caller caller) {
        return ApplicationController.safe(keys.own(caller));
    }
    @PostMapping("/merchants/api-keys")
    public ResponseEntity<Envelope<Created>> create(@AuthenticationPrincipal Caller caller, @Valid @RequestBody Create request) {
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).header("Referrer-Policy", "no-referrer")
            .body(Envelope.ok(keys.create(caller, request.label())));
    }
    @PostMapping("/merchants/api-keys/{id}/revoke")
    public ResponseEntity<Envelope<Summary>> revoke(@AuthenticationPrincipal Caller caller, @PathVariable UUID id) {
        return ApplicationController.safe(keys.revokeOwn(caller, id));
    }
    @GetMapping("/merchants/admin/applications/{merchantId}/api-keys")
    public ResponseEntity<Envelope<KeyList>> adminList(@AuthenticationPrincipal Caller caller, @PathVariable UUID merchantId) {
        return ApplicationController.safe(keys.adminList(caller, merchantId));
    }
    @PostMapping("/merchants/admin/applications/{merchantId}/api-keys/{id}/revoke")
    public ResponseEntity<Envelope<Summary>> adminRevoke(@AuthenticationPrincipal Caller caller,
            @PathVariable UUID merchantId, @PathVariable UUID id) {
        return ApplicationController.safe(keys.revokeAdmin(caller, merchantId, id));
    }
    @GetMapping("/merchant-api/identity")
    public ResponseEntity<Envelope<Identity>> identity(@AuthenticationPrincipal Identity identity) {
        return ApplicationController.safe(identity);
    }
}
