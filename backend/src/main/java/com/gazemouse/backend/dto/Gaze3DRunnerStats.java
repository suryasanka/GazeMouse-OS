package com.gazemouse.backend.dto;

import java.math.BigDecimal;

/**
 * Aggregated statistics for 3D WebGL Gaze Runner.
 */
public record Gaze3DRunnerStats(
    int totalCoinsCollected,
    BigDecimal maxDistanceMeters,
    BigDecimal maxSpeedMPerSec
) {
}

