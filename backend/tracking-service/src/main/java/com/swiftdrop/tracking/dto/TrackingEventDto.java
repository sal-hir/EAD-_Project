package com.swiftdrop.tracking.dto;

import java.time.Instant;

public class TrackingEventDto {
    private String status;
    private String city;
    private String description;
    private Instant timestamp;

    public TrackingEventDto() {}

    public TrackingEventDto(String status, String city, String description, Instant timestamp) {
        this.status = status;
        this.city = city;
        this.description = description;
        this.timestamp = timestamp;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}
