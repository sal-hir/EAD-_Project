package com.swiftdrop.tracking.dto;

import java.time.Instant;
import java.util.List;

public class PublicTrackingResponse {
    private String trackingNumber;
    private String status;
    private String originCity;
    private String destinationCity;
    private Double weightKg;
    private Instant estimatedDelivery;
    private Instant updatedAt;
    private List<TrackingEventDto> events;

    public PublicTrackingResponse() {}

    public PublicTrackingResponse(String trackingNumber, String status, String originCity,
                                  String destinationCity, Double weightKg, Instant estimatedDelivery,
                                  Instant updatedAt, List<TrackingEventDto> events) {
        this.trackingNumber = trackingNumber;
        this.status = status;
        this.originCity = originCity;
        this.destinationCity = destinationCity;
        this.weightKg = weightKg;
        this.estimatedDelivery = estimatedDelivery;
        this.updatedAt = updatedAt;
        this.events = events;
    }

    public String getTrackingNumber() { return trackingNumber; }
    public void setTrackingNumber(String trackingNumber) { this.trackingNumber = trackingNumber; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getOriginCity() { return originCity; }
    public void setOriginCity(String originCity) { this.originCity = originCity; }

    public String getDestinationCity() { return destinationCity; }
    public void setDestinationCity(String destinationCity) { this.destinationCity = destinationCity; }

    public Double getWeightKg() { return weightKg; }
    public void setWeightKg(Double weightKg) { this.weightKg = weightKg; }

    public Instant getEstimatedDelivery() { return estimatedDelivery; }
    public void setEstimatedDelivery(Instant estimatedDelivery) { this.estimatedDelivery = estimatedDelivery; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public List<TrackingEventDto> getEvents() { return events; }
    public void setEvents(List<TrackingEventDto> events) { this.events = events; }
}
