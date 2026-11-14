package com.swiftdrop.merchant.client;

import com.swiftdrop.merchant.dto.OrderDtos.Create;
import java.util.UUID;

/** Proposed Member 2 boundary. No production bean or automatic submission until agreed. */
public interface BookingGateway {
    record Request(UUID orderId, UUID merchantId, Create order) {}
    record Booking(UUID orderId, UUID parcelId, String trackingNumber, String status) {}
    Booking create(Request request);
}
