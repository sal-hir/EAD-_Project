package com.swiftdrop.auth.controller;

import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.swiftdrop.auth.dto.InfoResponse;

/**
 * Public system information endpoint.
 *
 * <p>Returns non-sensitive metadata about this service instance.
 * No authentication required — safe for monitoring, load-balancer
 * health dashboards, and Swagger/OpenAPI aggregation UIs.</p>
 */
@RestController
public class InfoController {

    private final @Nullable BuildProperties build;
    private final String applicationName;
    private final String description;
    private final String serviceVersion;

    public InfoController(
            @Nullable BuildProperties build,
            @Value("${spring.application.name:auth-service}") String applicationName,
            @Value("${info.app.description:Authentication and Identity Service}") String description,
            @Value("${info.app.version:${project.version:0.1.0}}") String serviceVersion) {
        this.build = build;
        this.applicationName = applicationName;
        this.description = description;
        this.serviceVersion = serviceVersion;
    }

    @GetMapping("/api/v1/info")
    public ResponseEntity<InfoResponse> info() {
        String version = build != null ? build.getVersion() : serviceVersion;
        InfoResponse body = new InfoResponse(
                applicationName,
                description,
                version,
                "v1",
                "UP",
                Instant.now());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
