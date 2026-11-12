package com.swiftdrop.tracking.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swiftdrop.tracking.dto.PublicTrackingResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Service
public class TrackingCacheService {

    private static final Logger log = LoggerFactory.getLogger(TrackingCacheService.class);
    private static final String KEY_PREFIX = "tracking:parcel:";

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.cache.ttl-seconds:60}")
    private long defaultTtlSeconds;

    public TrackingCacheService(RedisTemplate<String, Object> redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public Optional<PublicTrackingResponse> get(String trackingNumber) {
        String key = KEY_PREFIX + trackingNumber.toUpperCase();
        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                log.debug("Cache HIT for tracking number: {}", trackingNumber);
                PublicTrackingResponse response = objectMapper.convertValue(cached, PublicTrackingResponse.class);
                return Optional.ofNullable(response);
            }
            log.debug("Cache MISS for tracking number: {}", trackingNumber);
        } catch (Exception ex) {
            log.warn("Redis read failed for key {}. Falling back to database: {}", key, ex.getMessage());
        }
        return Optional.empty();
    }

    public void put(String trackingNumber, PublicTrackingResponse response) {
        String key = KEY_PREFIX + trackingNumber.toUpperCase();
        try {
            redisTemplate.opsForValue().set(key, response, Duration.ofSeconds(defaultTtlSeconds));
            log.debug("Cached tracking parcel {} with TTL {}s", trackingNumber, defaultTtlSeconds);
        } catch (Exception ex) {
            log.warn("Redis write failed for key {}: {}", key, ex.getMessage());
        }
    }

    public void evict(String trackingNumber) {
        String key = KEY_PREFIX + trackingNumber.toUpperCase();
        try {
            redisTemplate.delete(key);
            log.debug("Evicted tracking cache for key: {}", key);
        } catch (Exception ex) {
            log.warn("Redis eviction failed for key {}: {}", key, ex.getMessage());
        }
    }
}
