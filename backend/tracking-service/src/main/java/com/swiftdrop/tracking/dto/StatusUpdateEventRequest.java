package com.swiftdrop.tracking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class StatusUpdateEventRequest {

    @NotBlank(message = "Status is required")
    @Size(max = 50, message = "Status cannot exceed 50 characters")
    private String status;

    @Size(max = 100, message = "City cannot exceed 100 characters")
    private String city;

    @Size(max = 255, message = "Description cannot exceed 255 characters")
    private String description;

    private String originCity;
    private String destinationCity;
    private Double weightKg;

    public StatusUpdateEventRequest() {}

    public StatusUpdateEventRequest(String status, String city, String description) {
        this.status = status;
        this.city = city;
        this.description = description;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getOriginCity() { return originCity; }
    public void setOriginCity(String originCity) { this.originCity = originCity; }

    public String getDestinationCity() { return destinationCity; }
    public void setDestinationCity(String destinationCity) { this.destinationCity = destinationCity; }

    public Double getWeightKg() { return weightKg; }
    public void setWeightKg(Double weightKg) { this.weightKg = weightKg; }
}
