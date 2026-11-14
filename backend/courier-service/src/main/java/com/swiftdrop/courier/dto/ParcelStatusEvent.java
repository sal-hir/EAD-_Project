package com.swiftdrop.courier.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ParcelStatusEvent(
    String event,
    UUID parcelId,
    String trackingNumber,
    UUID courierId,
    String courierName,
    String previousStatus,
    String newStatus,
    String recipientName,
    String recipientEmail,
    String recipientPhone,
    String pickupCity,
    String dropoffCity,
    Double weightKg,
    String note,
    String failureReason,
    String proofImageUrl,
    OffsetDateTime timestamp
) {}

