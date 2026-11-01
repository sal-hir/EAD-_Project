package com.swiftdrop.auth.controller;

import com.swiftdrop.auth.dto.AuthDtos.*;
import com.swiftdrop.auth.dto.IdentityDtos.*;
import com.swiftdrop.auth.service.IdentityService;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/auth")
public class IdentityController {
    private final IdentityService identities;
    public IdentityController(IdentityService identities){this.identities=identities;}
    UUID actor(Authentication a){return UUID.fromString(a.getName());}
    @GetMapping("/admin/users") public ResponseEntity<ApiResponse<UserPage>> list(Authentication a,@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="0") int page){return safe(identities.list(actor(a),search,page));}
    @GetMapping("/admin/users/{id}") public ResponseEntity<ApiResponse<Profile>> get(Authentication a,@PathVariable UUID id){return safe(identities.get(actor(a),id));}
    @GetMapping("/admin/users/{id}/audit") public ResponseEntity<ApiResponse<List<Audit>>> audits(Authentication a,@PathVariable UUID id){return safe(identities.audits(actor(a),id));}
    @PostMapping("/admin/users") public ResponseEntity<ApiResponse<Activation>> provision(Authentication a,@Valid @RequestBody ProvisionRequest request){return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).body(ApiResponse.ok(identities.provision(actor(a),request)));}
    @PostMapping("/admin/users/{id}/activation") public ResponseEntity<ApiResponse<Activation>> reissue(Authentication a,@PathVariable UUID id){return safe(identities.reissue(actor(a),id));}
    @PostMapping("/admin/users/{id}/status") public ResponseEntity<ApiResponse<Profile>> status(Authentication a,@PathVariable UUID id,@Valid @RequestBody StatusRequest request){return safe(identities.status(actor(a),id,request.active()));}
    @PostMapping("/admin/users/{id}/role") public ResponseEntity<ApiResponse<Profile>> role(Authentication a,@PathVariable UUID id,@Valid @RequestBody RoleRequest request){return safe(identities.role(actor(a),id,request.role()));}
    @PostMapping("/activate") public ResponseEntity<Void> activate(@Valid @RequestBody ActivationRequest request){identities.activate(request);return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();}
    private <T> ResponseEntity<ApiResponse<T>> safe(T data){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(data));}
}
