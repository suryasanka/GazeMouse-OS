package com.gazemouse.backend.service;

import com.gazemouse.backend.dto.CreateGameSessionRequest;
import com.gazemouse.backend.exception.InvalidSessionException;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Set;

/**
 * Validates game session recording requests against database schema constraints
 * and domain business rules.
 */
@Component
public class GameSessionValidator {

    public static final Set<String> ALLOWED_GAMES = Set.of("GAZE_RUNNER", "GAZE_MATCH", "GAZE_3D_RUNNER");
    public static final Set<String> ALLOWED_STATUSES = Set.of("COMPLETED", "ABANDONED", "INTERRUPTED");
    public static final Set<String> ALLOWED_MATCH_MODES = Set.of("CHALLENGE", "ZEN");

    private static final int DURATION_TOLERANCE_SECONDS = 15;

    public void validate(CreateGameSessionRequest request) {
        if (request == null) {
            throw new InvalidSessionException("Session request payload cannot be null.");
        }

        if (request.id() == null) {
            throw new InvalidSessionException("Session ID is required.");
        }

        validateGameId(request.gameId());
        validateCompletionStatus(request.completionStatus());
        validateTimestampsAndDuration(request);
        validateScore(request.score());
        validateGameMode(request.gameId(), request.gameMode());
        validateGameSpecificMetrics(request);
    }

    private void validateGameId(String gameId) {
        if (gameId == null || !ALLOWED_GAMES.contains(gameId)) {
            throw new InvalidSessionException(
                "Invalid gameId '" + gameId + "'. Allowed values are: " + ALLOWED_GAMES
            );
        }
    }

    private void validateCompletionStatus(String completionStatus) {
        if (completionStatus == null || !ALLOWED_STATUSES.contains(completionStatus)) {
            throw new InvalidSessionException(
                "Invalid completionStatus '" + completionStatus + "'. Allowed values are: " + ALLOWED_STATUSES
            );
        }
    }

    private void validateTimestampsAndDuration(CreateGameSessionRequest request) {
        if (request.startedAt() == null || request.endedAt() == null) {
            throw new InvalidSessionException("startedAt and endedAt timestamps are required.");
        }

        if (request.endedAt().isBefore(request.startedAt())) {
            throw new InvalidSessionException("endedAt must not be earlier than startedAt.");
        }

        if (request.durationSeconds() == null || request.durationSeconds() < 0 || request.durationSeconds() > 86400) {
            throw new InvalidSessionException("durationSeconds must be between 0 and 86400.");
        }

        long wallClockSeconds = Duration.between(request.startedAt(), request.endedAt()).getSeconds();
        if (request.durationSeconds() > (wallClockSeconds + DURATION_TOLERANCE_SECONDS)) {
            throw new InvalidSessionException(
                "durationSeconds (" + request.durationSeconds() + ") cannot exceed elapsed wall-clock time ("
                + wallClockSeconds + "s) plus tolerance (" + DURATION_TOLERANCE_SECONDS + "s)."
            );
        }
    }

    private void validateScore(Integer score) {
        if (score == null || score < 0) {
            throw new InvalidSessionException("score must be a non-negative integer.");
        }
    }

    private void validateGameMode(String gameId, String gameMode) {
        if ("GAZE_MATCH".equals(gameId)) {
            if (gameMode == null || !ALLOWED_MATCH_MODES.contains(gameMode)) {
                throw new InvalidSessionException(
                    "gameMode is required for GAZE_MATCH and must be one of: " + ALLOWED_MATCH_MODES
                );
            }
        } else {
            if (gameMode != null) {
                throw new InvalidSessionException("gameMode must be null for " + gameId + ".");
            }
        }
    }

    private void validateGameSpecificMetrics(CreateGameSessionRequest request) {
        String gameId = request.gameId();

        if ("GAZE_RUNNER".equals(gameId)) {
            if (request.coinsCollected() == null) {
                throw new InvalidSessionException("coinsCollected is required for GAZE_RUNNER.");
            }
            if (request.distancePixels() == null) {
                throw new InvalidSessionException("distancePixels is required for GAZE_RUNNER.");
            }
            if (request.speedPxPerSec() == null) {
                throw new InvalidSessionException("speedPxPerSec is required for GAZE_RUNNER.");
            }
            if (request.distanceMeters() != null || request.speedMPerSec() != null ||
                request.movesMade() != null || request.movesRemaining() != null ||
                request.matchesCount() != null || request.targetScore() != null ||
                request.isWin() != null) {
                throw new InvalidSessionException("GAZE_RUNNER cannot accept 3D runner or Gaze Match metrics.");
            }
        } else if ("GAZE_3D_RUNNER".equals(gameId)) {
            if (request.coinsCollected() == null) {
                throw new InvalidSessionException("coinsCollected is required for GAZE_3D_RUNNER.");
            }
            if (request.distanceMeters() == null) {
                throw new InvalidSessionException("distanceMeters is required for GAZE_3D_RUNNER.");
            }
            if (request.speedMPerSec() == null) {
                throw new InvalidSessionException("speedMPerSec is required for GAZE_3D_RUNNER.");
            }
            if (request.distancePixels() != null || request.speedPxPerSec() != null ||
                request.movesMade() != null || request.movesRemaining() != null ||
                request.matchesCount() != null || request.targetScore() != null ||
                request.isWin() != null) {
                throw new InvalidSessionException("GAZE_3D_RUNNER cannot accept 2D runner or Gaze Match metrics.");
            }
        } else if ("GAZE_MATCH".equals(gameId)) {
            if (request.movesMade() == null) {
                throw new InvalidSessionException("movesMade is required for GAZE_MATCH.");
            }
            if (request.matchesCount() == null) {
                throw new InvalidSessionException("matchesCount is required for GAZE_MATCH.");
            }
            if (request.coinsCollected() != null || request.distancePixels() != null ||
                request.speedPxPerSec() != null || request.distanceMeters() != null ||
                request.speedMPerSec() != null) {
                throw new InvalidSessionException("GAZE_MATCH cannot accept runner metrics.");
            }
        }
    }
}

