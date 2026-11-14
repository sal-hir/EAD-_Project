package com.swiftdrop.merchant.controller;

import com.swiftdrop.merchant.dto.OrderDtos.*;
import com.swiftdrop.merchant.dto.MerchantDtos.Envelope;
import com.swiftdrop.merchant.service.OrderService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import java.util.List;
import com.swiftdrop.merchant.exception.ApiFailure;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/merchant/orders")
public class OrderController {
    private final OrderService orders;
    public OrderController(OrderService orders) { this.orders=orders; }
    @PostMapping(consumes=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Envelope<Order>> create(@AuthenticationPrincipal UUID merchant,
            @RequestHeader(value="Idempotency-Key",required=false) List<String> keys,@Valid @RequestBody Create request) {
        if(keys==null || keys.size()!=1) throw new ApiFailure(400,"Exactly one Idempotency-Key header is required");
        var result=orders.create(merchant,keys.getFirst(),request);
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
            false,order.createdAt(),List.of(new TrackingEvent("PENDING_BOOKING",order.createdAt(),"Order accepted; booking pending")),
            "Order accepted; parcel creation and tracking await Member 2 booking integration"));
    }
}
