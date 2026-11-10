package com.swiftdrop.courier.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "parcel_status_history", schema = "courier")
public class ParcelStatusHistory {
    @Id
    private UUID id;

    @Column(name = "parcel_id", nullable = false)
    private UUID parcelId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeliveryStatus status;

    private String note;

    @Column(name = "proof_image_url")
    private String proofImageUrl;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(nullable = false)
    private OffsetDateTime timestamp;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        if (timestamp == null) timestamp = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getParcelId() { return parcelId; }
    public void setParcelId(UUID parcelId) { this.parcelId = parcelId; }
    public DeliveryStatus getStatus() { return status; }
    public void setStatus(DeliveryStatus status) { this.status = status; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getProofImageUrl() { return proofImageUrl; }
    public void setProofImageUrl(String proofImageUrl) { this.proofImageUrl = proofImageUrl; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
    public OffsetDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(OffsetDateTime timestamp) { this.timestamp = timestamp; }
}

