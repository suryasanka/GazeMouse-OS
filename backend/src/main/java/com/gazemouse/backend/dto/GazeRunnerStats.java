package com.gazemouse.backend.dto;

import java.math.BigDecimal;

/**
 * Aggregated statistics for 2D Canvas Gaze Runner.
 */
public record GazeRunnerStats(
    int totalCoinsCollected,
    int maxDistancePixels,
    BigDecimal maxSpeedPxPerSec
) {
}

