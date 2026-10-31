package com.gazemouse.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Health check endpoint for cloud hosting probes (e.g., Render, Railway, AWS ECS).
 * Provides an unauthenticated GET /health returning {"status": "UP"} with HTTP 200 OK
 * without querying the database or exposing internal system configuration.
 */
@RestController
public class HealthController {

    private static final Map<String, String> HEALTH_STATUS = Map.of("status", "UP");

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(HEALTH_STATUS);
    }
}

