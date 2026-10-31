package com.gazemouse.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Payload for recording an individual game session telemetry record.
 */
public record CreateGameSessionRequest(
    @NotNull(message = "id is required")
    UUID id,

    @NotNull(message = "gameId is required")
    String gameId,

    String gameMode,

    @NotNull(message = "completionStatus is required")
    String completionStatus,

    @NotNull(message = "score is required")
    @Min(value = 0, message = "score must be at least 0")
    Integer score,

    @NotNull(message = "startedAt is required")
    Instant startedAt,

    @NotNull(message = "endedAt is required")
    Instant endedAt,

    @NotNull(message = "durationSeconds is required")
    @Min(value = 0, message = "durationSeconds must be at least 0")
    @Max(value = 86400, message = "durationSeconds must be at most 86400")
    Integer durationSeconds,

    // 2D Canvas Runner Metrics
    @Min(value = 0, message = "coinsCollected must be at least 0")
    Integer coinsCollected,

    @Min(value = 0, message = "distancePixels must be at least 0")
    Integer distancePixels,

    @DecimalMin(value = "0.00", message = "speedPxPerSec must be at least 0.00")
    @Digits(integer = 8, fraction = 2, message = "speedPxPerSec must have at most 2 decimal places")
    BigDecimal speedPxPerSec,

    // 3D WebGL Runner Metrics
    @DecimalMin(value = "0.00", message = "distanceMeters must be at least 0.00")
    @Digits(integer = 10, fraction = 2, message = "distanceMeters must have at most 2 decimal places")
    BigDecimal distanceMeters,

    @DecimalMin(value = "0.00", message = "speedMPerSec must be at least 0.00")
    @Digits(integer = 6, fraction = 2, message = "speedMPerSec must have at most 2 decimal places")
    BigDecimal speedMPerSec,

    // Gaze Match Metrics
    @Min(value = 0, message = "movesMade must be at least 0")
    Integer movesMade,

    @Min(value = 0, message = "movesRemaining must be at least 0")
    Integer movesRemaining,

    @Min(value = 0, message = "matchesCount must be at least 0")
    Integer matchesCount,

    @Min(value = 0, message = "targetScore must be at least 0")
    Integer targetScore,

    Boolean isWin
) {
}

