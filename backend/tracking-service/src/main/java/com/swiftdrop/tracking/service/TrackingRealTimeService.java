package com.swiftdrop.tracking.service;

import com.swiftdrop.tracking.dto.PublicTrackingResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class TrackingRealTimeService {

    private static final Logger log = LoggerFactory.getLogger(TrackingRealTimeService.class);
    private static final Long SSE_TIMEOUT = 30 * 60 * 1000L; // 30 minutes

    // Map: trackingNumber -> List of active SseEmitters
    private final Map<String, List<SseEmitter>> subscriptions = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String trackingNumber) {
        String key = trackingNumber.toUpperCase();
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        subscriptions.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>()).add(emitter);
        log.info("Client subscribed to real-time tracking stream for {}", key);

        emitter.onCompletion(() -> removeEmitter(key, emitter));
        emitter.onTimeout(() -> removeEmitter(key, emitter));
        emitter.onError((e) -> removeEmitter(key, emitter));

        // Send initial connection heartbeat
        try {
            emitter.send(SseEmitter.event()
                .name("connected")
                .data(Map.of("trackingNumber", key, "message", "Connected to SwiftDrop Real-time Stream")));
        } catch (IOException e) {
            removeEmitter(key, emitter);
        }

        return emitter;
    }

    public void broadcastUpdate(String trackingNumber, PublicTrackingResponse update) {
        String key = trackingNumber.toUpperCase();
        List<SseEmitter> emitters = subscriptions.get(key);
        if (emitters == null || emitters.isEmpty()) {
            log.debug("No active real-time subscribers for parcel {}", key);
            return;
        }

        log.info("Broadcasting real-time update for {} to {} subscribers", key, emitters.size());
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name("status_update")
                    .data(update));
            } catch (IOException ex) {
                removeEmitter(key, emitter);
            }
        }
    }

    private void removeEmitter(String key, SseEmitter emitter) {
        List<SseEmitter> list = subscriptions.get(key);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) {
                subscriptions.remove(key);
            }
        }
    }
}
