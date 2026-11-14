package com.swiftdrop.courier.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "parcels", schema = "courier")
public class CourierParcel {
    @Id
    private UUID id;

    @Column(name = "tracking_number", nullable = false, unique = true)
    private String trackingNumber;

    @Column(name = "courier_id")
    private UUID courierId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeliveryStatus status = DeliveryStatus.PENDING_PICKUP;

    @Column(name = "pickup_address")
    private String pickupAddress;

    @Column(name = "pickup_city")
    private String pickupCity;

    @Column(name = "dropoff_address")
    private String dropoffAddress;

    @Column(name = "dropoff_city")
    private String dropoffCity;

    @Column(name = "recipient_name")
    private String recipientName;

    @Column(name = "recipient_phone")
    private String recipientPhone;

    @Column(name = "recipient_email")
    private String recipientEmail;

    @Column(name = "weight_kg")
    private Double weightKg;

    private String size;
    private String note;

    @Column(name = "proof_image_url")
    private String proofImageUrl;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTrackingNumber() { return trackingNumber; }
    public void setTrackingNumber(String trackingNumber) { this.trackingNumber = trackingNumber; }
    public UUID getCourierId() { return courierId; }
    public void setCourierId(UUID courierId) { this.courierId = courierId; }
    public DeliveryStatus getStatus() { return status; }
    public void setStatus(DeliveryStatus status) { this.status = status; }
    public String getPickupAddress() { return pickupAddress; }
    public void setPickupAddress(String pickupAddress) { this.pickupAddress = pickupAddress; }
    public String getPickupCity() { return pickupCity; }
    public void setPickupCity(String pickupCity) { this.pickupCity = pickupCity; }
    public String getDropoffAddress() { return dropoffAddress; }
    public void setDropoffAddress(String dropoffAddress) { this.dropoffAddress = dropoffAddress; }
    public String getDropoffCity() { return dropoffCity; }
    public void setDropoffCity(String dropoffCity) { this.dropoffCity = dropoffCity; }
    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }
    public String getRecipientPhone() { return recipientPhone; }
    public void setRecipientPhone(String recipientPhone) { this.recipientPhone = recipientPhone; }
    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }
    public Double getWeightKg() { return weightKg; }
    public void setWeightKg(Double weightKg) { this.weightKg = weightKg; }
    public String getSize() { return size; }
    public void setSize(String size) { this.size = size; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getProofImageUrl() { return proofImageUrl; }
    public void setProofImageUrl(String proofImageUrl) { this.proofImageUrl = proofImageUrl; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(OffsetDateTime deliveredAt) { this.deliveredAt = deliveredAt; }
}

