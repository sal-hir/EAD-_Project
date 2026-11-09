package com.swiftdrop.tracking.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "tracking_events", schema = "tracking")
public class TrackingEvent {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parcel_id", nullable = false)
    @JsonIgnore
    private TrackingParcel parcel;

    @Column(nullable = false, length = 50)
    private String status;

    @Column(length = 100)
    private String city;

    @Column(length = 255)
    private String description;

    @Column(nullable = false)
    private Instant timestamp;

    public TrackingEvent() {}

    public TrackingEvent(TrackingParcel parcel, String status, String city, String description) {
        this.parcel = parcel;
        this.status = status;
        this.city = city;
        this.description = description;
        this.timestamp = Instant.now();
    }

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (timestamp == null) {
            timestamp = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public TrackingParcel getParcel() { return parcel; }
    public void setParcel(TrackingParcel parcel) { this.parcel = parcel; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
