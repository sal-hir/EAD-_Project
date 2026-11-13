package com.swiftdrop.auth.dto;

import java.time.Instant;

/**
 * Response DTO for {@code GET /api/v1/info}.
 *
 * <p>Contains non-sensitive, publicly visible metadata about this service.
 * All fields are intentionally simple strings or an {@link Instant} so that
 * they serialise cleanly to JSON without exposing internal configuration.</p>
 *
 * @param applicationName short identifier for this service (e.g. {@code "auth-service"})
 * @param description     human-readable purpose of the service
 * @param version         artifact version from build metadata or pom fallback
 * @param apiVersion      API version prefix in use (always {@code "v1"})
 * @param status          coarse health indicator — always {@code "UP"} when
 *                        the application is running and able to serve requests
 * @param timestamp       server wall-clock time at the moment of the response
 */
public record InfoResponse(
        String applicationName,
        String description,
        String version,
        String apiVersion,
        String status,
        Instant timestamp) {
}
