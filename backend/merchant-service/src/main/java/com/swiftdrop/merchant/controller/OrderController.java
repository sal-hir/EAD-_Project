package com.swiftdrop.merchant.controller;

import com.swiftdrop.merchant.dto.OrderDtos.*;
import com.swiftdrop.merchant.dto.MerchantDtos.Envelope;
import com.swiftdrop.merchant.service.OrderService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/merchant/orders")
public class OrderController {
    private final OrderService orders;
    public OrderController(OrderService orders) { this.orders=orders; }
    @PostMapping
    public ResponseEntity<Envelope<Order>> create(@AuthenticationPrincipal UUID merchant,
            @RequestHeader(value="Idempotency-Key",required=false) String key,@Valid @RequestBody Create request) {
        var result=orders.create(merchant,key,request);
        return ResponseEntity.status(result.replay()?200:202).cacheControl(CacheControl.noStore())
            .location(URI.create("/api/v1/merchant/orders/"+result.order().id()))
            .header("Idempotency-Replayed",Boolean.toString(result.replay())).body(Envelope.ok(result.order()));
    }
    @GetMapping
    public ResponseEntity<Envelope<Page>> list(@AuthenticationPrincipal UUID merchant,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ApplicationController.safe(orders.list(merchant,page,size));
    }
    @GetMapping("/{id}")
    public ResponseEntity<Envelope<Order>> get(@AuthenticationPrincipal UUID merchant,@PathVariable UUID id) {
        return ApplicationController.safe(orders.get(merchant,id));
    }
    @GetMapping("/{id}/tracking")
    public ResponseEntity<Envelope<Tracking>> tracking(@AuthenticationPrincipal UUID merchant,@PathVariable UUID id) {
        var order=orders.get(merchant,id);
        return ApplicationController.safe(new Tracking(order.id(),order.merchantOrderId(),order.status(),null,null,
            "Order accepted; parcel creation and tracking await Member 2 booking integration"));
    }
}
