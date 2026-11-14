package com.swiftdrop.merchant.controller;

import com.swiftdrop.merchant.client.IdentityGateway.Caller;
import com.swiftdrop.merchant.dto.MerchantDtos.Envelope;
import com.swiftdrop.merchant.dto.WebhookDtos.*;
import com.swiftdrop.merchant.exception.ApiFailure;
import com.swiftdrop.merchant.service.*;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/merchants/operations")
public class MerchantOperationsController {
    private final MerchantAccess access;private final OrderService orders;private final WebhookService hooks;
    public MerchantOperationsController(MerchantAccess access,OrderService orders,WebhookService hooks){this.access=access;this.orders=orders;this.hooks=hooks;}
    @GetMapping("/orders") public ResponseEntity<?> orders(@AuthenticationPrincipal Caller caller,@RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="") String status) {
        UUID merchant=access.business(caller);
        if(!status.isEmpty()&&!status.equals("PENDING_BOOKING"))throw new ApiFailure(400,"Unsupported order status");
        return ApplicationController.safe(orders.list(merchant,page,size));
    }
    @GetMapping("/orders/{id}") public ResponseEntity<?> order(@AuthenticationPrincipal Caller caller,@PathVariable UUID id){return ApplicationController.safe(orders.get(access.business(caller),id));}
    @GetMapping("/webhook") public ResponseEntity<?> settings(@AuthenticationPrincipal Caller caller){return ApplicationController.safe(hooks.settings(access.business(caller)));}
    @PutMapping("/webhook") public ResponseEntity<?> save(@AuthenticationPrincipal Caller caller,@Valid @RequestBody Update request){return ApplicationController.safe(hooks.save(access.business(caller),request));}
    @PostMapping("/webhook/rotate") public ResponseEntity<?> rotate(@AuthenticationPrincipal Caller caller){return ApplicationController.safe(hooks.rotate(access.business(caller)));}
    @PostMapping("/webhook/test") public ResponseEntity<?> test(@AuthenticationPrincipal Caller caller){return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(Envelope.ok(Map.of("deliveryId",hooks.test(access.business(caller)))));}
    @GetMapping("/webhook/deliveries") public ResponseEntity<?> logs(@AuthenticationPrincipal Caller caller,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ApplicationController.safe(hooks.logs(access.business(caller),page,size));}
    @GetMapping("/webhook/deliveries/{id}") public ResponseEntity<?> detail(@AuthenticationPrincipal Caller caller,@PathVariable UUID id){return ApplicationController.safe(hooks.detail(access.business(caller),id));}
}
