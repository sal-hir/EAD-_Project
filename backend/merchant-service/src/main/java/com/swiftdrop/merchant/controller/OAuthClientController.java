package com.swiftdrop.merchant.controller;

import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.dto.OAuthDtos.*;
import com.swiftdrop.merchant.dto.MerchantDtos.Envelope;
import com.swiftdrop.merchant.service.OAuthClientService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/merchants")
public class OAuthClientController {
    private final OAuthClientService clients;
    public OAuthClientController(OAuthClientService clients) { this.clients=clients; }
    @GetMapping("/oauth-clients") public ResponseEntity<Envelope<ClientList>> own(@AuthenticationPrincipal Caller caller) {
        return ApplicationController.safe(clients.own(caller));
    }
    @PostMapping("/oauth-clients") public ResponseEntity<Envelope<Created>> create(@AuthenticationPrincipal Caller caller,@Valid @RequestBody Create request) {
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).header("Referrer-Policy","no-referrer")
            .body(Envelope.ok(clients.create(caller,request.label(),request.scopes())));
    }
    @PostMapping("/oauth-clients/{id}/rotate") public ResponseEntity<Envelope<Created>> rotate(@AuthenticationPrincipal Caller caller,@PathVariable UUID id) {
        return ApplicationController.safe(clients.rotate(caller,id));
    }
    @PostMapping("/oauth-clients/{id}/revoke") public ResponseEntity<Envelope<Summary>> revoke(@AuthenticationPrincipal Caller caller,@PathVariable UUID id) {
        return ApplicationController.safe(clients.revokeOwn(caller,id));
    }
    @GetMapping("/admin/applications/{merchantId}/oauth-clients") public ResponseEntity<Envelope<ClientList>> admin(@AuthenticationPrincipal Caller caller,@PathVariable UUID merchantId) {
        return ApplicationController.safe(clients.adminList(caller,merchantId));
    }
    @PostMapping("/admin/applications/{merchantId}/oauth-clients/{id}/revoke") public ResponseEntity<Envelope<Summary>> revokeAdmin(
            @AuthenticationPrincipal Caller caller,@PathVariable UUID merchantId,@PathVariable UUID id) {
        return ApplicationController.safe(clients.revokeAdmin(caller,merchantId,id));
    }
}
