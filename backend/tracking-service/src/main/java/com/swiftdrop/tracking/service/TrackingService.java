package com.swiftdrop.tracking.service;

import com.swiftdrop.tracking.dto.PublicTrackingResponse;
import com.swiftdrop.tracking.dto.StatusUpdateEventRequest;
import com.swiftdrop.tracking.dto.TrackingEventDto;
import com.swiftdrop.tracking.entity.TrackingEvent;
import com.swiftdrop.tracking.entity.TrackingParcel;
import com.swiftdrop.tracking.repository.TrackingParcelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class TrackingService {

    private static final Logger log = LoggerFactory.getLogger(TrackingService.class);

    private final TrackingParcelRepository parcelRepository;
    private final TrackingCacheService cacheService;
    private final TrackingRealTimeService realTimeService;

    public TrackingService(TrackingParcelRepository parcelRepository,
                           TrackingCacheService cacheService,
                           TrackingRealTimeService realTimeService) {
        this.parcelRepository = parcelRepository;
        this.cacheService = cacheService;
        this.realTimeService = realTimeService;
    }

    @Transactional(readOnly = true)
    public Optional<PublicTrackingResponse> getPublicTracking(String trackingNumber) {
        String normalized = trackingNumber.trim().toUpperCase();

        // 1. Check Redis Cache
        Optional<PublicTrackingResponse> cached = cacheService.get(normalized);
        if (cached.isPresent()) {
            return cached;
        }

        // 2. Fetch from Database
        return parcelRepository.findByTrackingNumber(normalized).map(parcel -> {
            PublicTrackingResponse response = toPublicResponse(parcel);
            cacheService.put(normalized, response);
            return response;
        });
    }

    @Transactional
    public PublicTrackingResponse recordStatusUpdate(String trackingNumber, StatusUpdateEventRequest request) {
        String normalized = trackingNumber.trim().toUpperCase();

        TrackingParcel parcel = parcelRepository.findByTrackingNumber(normalized)
            .orElseGet(() -> {
                TrackingParcel newParcel = new TrackingParcel();
                newParcel.setTrackingNumber(normalized);
                newParcel.setOriginCity(request.getOriginCity() != null ? request.getOriginCity() : "Colombo");
                newParcel.setDestinationCity(request.getDestinationCity() != null ? request.getDestinationCity() : "Kandy");
                newParcel.setWeightKg(request.getWeightKg() != null ? request.getWeightKg() : 1.0);
                newParcel.setEstimatedDelivery(Instant.now().plusSeconds(86400));
                return newParcel;
            });

        parcel.setStatus(request.getStatus().trim().toUpperCase());
        parcel.setUpdatedAt(Instant.now());

        String eventCity = request.getCity() != null ? request.getCity() : parcel.getOriginCity();
        String desc = request.getDescription() != null ? request.getDescription() : "Status updated to " + parcel.getStatus();
        TrackingEvent event = new TrackingEvent(parcel, parcel.getStatus(), eventCity, desc);
        parcel.addEvent(event);

        TrackingParcel saved = parcelRepository.save(parcel);
        PublicTrackingResponse response = toPublicResponse(saved);

        // Invalidate and refresh cache
        cacheService.evict(normalized);
        cacheService.put(normalized, response);

        // Push real-time event to connected WebSocket/SSE clients
        realTimeService.broadcastUpdate(normalized, response);

        log.info("Recorded status update for {}: status={}", normalized, saved.getStatus());
        return response;
    }

    private PublicTrackingResponse toPublicResponse(TrackingParcel parcel) {
        List<TrackingEventDto> eventDtos = parcel.getEvents().stream()
            .map(e -> new TrackingEventDto(e.getStatus(), e.getCity(), e.getDescription(), e.getTimestamp()))
            .collect(Collectors.toList());

        return new PublicTrackingResponse(
            parcel.getTrackingNumber(),
            parcel.getStatus(),
            parcel.getOriginCity(),
            parcel.getDestinationCity(),
            parcel.getWeightKg(),
            parcel.getEstimatedDelivery(),
            parcel.getUpdatedAt(),
            eventDtos
        );
    }
}
