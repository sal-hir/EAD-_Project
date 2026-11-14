package com.swiftdrop.tracking.controller;

import com.swiftdrop.tracking.dto.PublicTrackingResponse;
import com.swiftdrop.tracking.dto.StatusUpdateEventRequest;
import com.swiftdrop.tracking.service.TrackingRealTimeService;
import com.swiftdrop.tracking.service.TrackingService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;


@RestController
@RequestMapping("/api/v1/tracking")
public class PublicTrackingController {

    private final TrackingService trackingService;
    private final TrackingRealTimeService realTimeService;

    public PublicTrackingController(TrackingService trackingService, TrackingRealTimeService realTimeService) {
        this.trackingService = trackingService;
        this.realTimeService = realTimeService;
    }

    /**
     * Public Tracking REST API
     * Returns sanitized parcel state and chronological event timeline.
     * Cached via Redis for high-throughput public lookups.
     */
    @GetMapping("/{trackingNumber}")
    public ResponseEntity<?> getPublicTracking(@PathVariable String trackingNumber) {
        return trackingService.getPublicTracking(trackingNumber)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.status(404).body(
                (PublicTrackingResponse) null
            ));
    }

    /**
     * Real-time Server-Sent Events (SSE) push stream for live parcel updates.
     */
    @GetMapping(value = "/{trackingNumber}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamTrackingUpdates(@PathVariable String trackingNumber) {
        return realTimeService.subscribe(trackingNumber);
    }

    /**
     * Internal/Webhook status event ingestion endpoint.
     * Invoked when Courier or Dispatcher updates a delivery stage.
     */
    @PostMapping("/{trackingNumber}/events")
    public ResponseEntity<PublicTrackingResponse> recordStatusUpdate(
            @PathVariable String trackingNumber,
            @Valid @RequestBody StatusUpdateEventRequest request) {
        PublicTrackingResponse updated = trackingService.recordStatusUpdate(trackingNumber, request);
        return ResponseEntity.ok(updated);
    }
}
