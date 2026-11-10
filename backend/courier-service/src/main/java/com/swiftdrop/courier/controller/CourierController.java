package com.swiftdrop.courier.controller;

import com.swiftdrop.courier.client.IdentityGateway;
import com.swiftdrop.courier.dto.*;
import com.swiftdrop.courier.entity.DeliveryStatus;
import com.swiftdrop.courier.service.CourierService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class CourierController {
    private final CourierService courierService;

    public CourierController(CourierService courierService) {
        this.courierService = courierService;
    }

    @GetMapping("/couriers/my-deliveries")
    public ResponseEntity<Map<String, Object>> getMyDeliveries(
            @AuthenticationPrincipal IdentityGateway.Caller caller,
            @RequestParam(required = false) DeliveryStatus status) {
        CourierDeliveriesResponse response = courierService.getMyDeliveries(caller, status);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", response
        ));
    }

    @PatchMapping("/couriers/availability")
    public ResponseEntity<Map<String, Object>> toggleAvailability(
            @AuthenticationPrincipal IdentityGateway.Caller caller,
            @RequestBody AvailabilityRequest request) {
        CourierProfileDto profile = courierService.setAvailability(caller, request.isAvailable());
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", profile
        ));
    }

    @PatchMapping({"/couriers/parcels/{id}/status", "/parcels/{id}/status"})
    public ResponseEntity<Map<String, Object>> updateStatus(
            @AuthenticationPrincipal IdentityGateway.Caller caller,
            @PathVariable UUID id,
            @Valid @RequestBody StatusUpdateRequest request) {
        ParcelDto updated = courierService.updateParcelStatus(caller, id, request);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "data", updated
        ));
    }
}

