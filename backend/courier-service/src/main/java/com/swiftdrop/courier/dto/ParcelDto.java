package com.swiftdrop.courier.dto;

import com.swiftdrop.courier.entity.CourierParcel;
import com.swiftdrop.courier.entity.DeliveryStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ParcelDto(
    UUID id,
    String trackingNumber,
    UUID courierId,
    DeliveryStatus status,
    String pickupAddress,
    String pickupCity,
    String dropoffAddress,
    String dropoffCity,
    String recipientName,
    String recipientPhone,
    String recipientEmail,
    Double weightKg,
    String size,
    String note,
    String proofImageUrl,
    String failureReason,
    OffsetDateTime createdAt,
    OffsetDateTime deliveredAt
) {
    public static ParcelDto fromEntity(CourierParcel p) {
        return new ParcelDto(
            p.getId(),
            p.getTrackingNumber(),
            p.getCourierId(),
            p.getStatus(),
            p.getPickupAddress(),
            p.getPickupCity(),
            p.getDropoffAddress(),
            p.getDropoffCity(),
            p.getRecipientName(),
            p.getRecipientPhone(),
            p.getRecipientEmail(),
            p.getWeightKg(),
            p.getSize(),
            p.getNote(),
            p.getProofImageUrl(),
            p.getFailureReason(),
            p.getCreatedAt(),
            p.getDeliveredAt()
        );
    }
}

