package com.gazemouse.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.gazemouse.backend.entity.GameSession;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * API response representing a recorded game session.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GameSessionResponse(
    UUID id,
    String gameId,
    String gameMode,
    String completionStatus,
    Integer score,
    Instant startedAt,
    Instant endedAt,
    Integer durationSeconds,

    // 2D Canvas Runner Metrics
    Integer coinsCollected,
    Integer distancePixels,
    BigDecimal speedPxPerSec,

    // 3D WebGL Runner Metrics
    BigDecimal distanceMeters,
    BigDecimal speedMPerSec,

    // Gaze Match Metrics
    Integer movesMade,
    Integer movesRemaining,
    Integer matchesCount,
    Integer targetScore,
    Boolean isWin,

    Instant createdAt,
    Instant recordedAt
) {
    public static GameSessionResponse fromEntity(GameSession entity) {
        return new GameSessionResponse(
            entity.getId(),
            entity.getGameId(),
            entity.getGameMode(),
            entity.getCompletionStatus(),
            entity.getScore(),
            entity.getStartedAt(),
            entity.getEndedAt(),
            entity.getDurationSeconds(),
            entity.getCoinsCollected(),
            entity.getDistancePixels(),
            entity.getSpeedPxPerSec(),
            entity.getDistanceMeters(),
            entity.getSpeedMPerSec(),
            entity.getMovesMade(),
            entity.getMovesRemaining(),
            entity.getMatchesCount(),
            entity.getTargetScore(),
            entity.getIsWin(),
            entity.getCreatedAt(),
            entity.getRecordedAt()
        );
    }
}

