package com.gazemouse.backend.service;

import com.gazemouse.backend.dto.CreateGameSessionRequest;
import com.gazemouse.backend.exception.InvalidSessionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GameSessionValidatorTest {

    private GameSessionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new GameSessionValidator();
    }

    private CreateGameSessionRequest createValidRunnerRequest() {
        Instant start = Instant.parse("2026-10-30T10:00:00Z");
        Instant end = Instant.parse("2026-10-30T10:01:30Z"); // 90 seconds
        return new CreateGameSessionRequest(
            UUID.randomUUID(),
            "GAZE_RUNNER",
            null,
            "COMPLETED",
            350,
            start,
            end,
            90,
            25,
            5400,
            new BigDecimal("60.00"),
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );
    }

    private CreateGameSessionRequest createValid3DRunnerRequest() {
        Instant start = Instant.parse("2026-10-30T10:00:00Z");
        Instant end = Instant.parse("2026-10-30T10:01:30Z");
        return new CreateGameSessionRequest(
            UUID.randomUUID(),
            "GAZE_3D_RUNNER",
            null,
            "COMPLETED",
            420,
            start,
            end,
            90,
            30,
            null,
            null,
            new BigDecimal("250.50"),
            new BigDecimal("12.50"),
            null,
            null,
            null,
            null,
            null
        );
    }

    private CreateGameSessionRequest createValidMatchChallengeRequest() {
        Instant start = Instant.parse("2026-10-30T10:00:00Z");
        Instant end = Instant.parse("2026-10-30T10:02:00Z");
        return new CreateGameSessionRequest(
            UUID.randomUUID(),
            "GAZE_MATCH",
            "CHALLENGE",
            "COMPLETED",
            1000,
            start,
            end,
            120,
            null,
            null,
            null,
            null,
            null,
            18,
            2,
            12,
            1000,
            true
        );
    }

    @Test
    @DisplayName("Valid GAZE_RUNNER session passes validation")
    void validate_ValidRunner_Passes() {
        assertThatCode(() -> validator.validate(createValidRunnerRequest()))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Valid GAZE_3D_RUNNER session passes validation")
    void validate_Valid3DRunner_Passes() {
        assertThatCode(() -> validator.validate(createValid3DRunnerRequest()))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Valid GAZE_MATCH CHALLENGE session passes validation")
    void validate_ValidMatchChallenge_Passes() {
        assertThatCode(() -> validator.validate(createValidMatchChallengeRequest()))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Valid GAZE_MATCH ZEN session passes validation")
    void validate_ValidMatchZen_Passes() {
        Instant start = Instant.parse("2026-10-30T10:00:00Z");
        Instant end = Instant.parse("2026-10-30T10:02:00Z");
        CreateGameSessionRequest zenRequest = new CreateGameSessionRequest(
            UUID.randomUUID(),
            "GAZE_MATCH",
            "ZEN",
            "COMPLETED",
            500,
            start,
            end,
            120,
            null,
            null,
            null,
            null,
            null,
            25,
            null,
            15,
            null,
            null
        );

        assertThatCode(() -> validator.validate(zenRequest))
            .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Invalid gameId throws InvalidSessionException")
    void validate_InvalidGameId_ThrowsException() {
        CreateGameSessionRequest base = createValidRunnerRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), "PAC_MAN", base.gameMode(), base.completionStatus(),
            base.score(), base.startedAt(), base.endedAt(), base.durationSeconds(),
            base.coinsCollected(), base.distancePixels(), base.speedPxPerSec(),
            base.distanceMeters(), base.speedMPerSec(), base.movesMade(),
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("Invalid gameId 'PAC_MAN'");
    }

    @Test
    @DisplayName("Invalid completionStatus throws InvalidSessionException")
    void validate_InvalidCompletionStatus_ThrowsException() {
        CreateGameSessionRequest base = createValidRunnerRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), base.gameId(), base.gameMode(), "PAUSED",
            base.score(), base.startedAt(), base.endedAt(), base.durationSeconds(),
            base.coinsCollected(), base.distancePixels(), base.speedPxPerSec(),
            base.distanceMeters(), base.speedMPerSec(), base.movesMade(),
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("Invalid completionStatus 'PAUSED'");
    }

    @Test
    @DisplayName("GAZE_RUNNER with non-null gameMode throws InvalidSessionException")
    void validate_RunnerWithGameMode_ThrowsException() {
        CreateGameSessionRequest base = createValidRunnerRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), base.gameId(), "CHALLENGE", base.completionStatus(),
            base.score(), base.startedAt(), base.endedAt(), base.durationSeconds(),
            base.coinsCollected(), base.distancePixels(), base.speedPxPerSec(),
            base.distanceMeters(), base.speedMPerSec(), base.movesMade(),
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("gameMode must be null for GAZE_RUNNER");
    }

    @Test
    @DisplayName("GAZE_MATCH with null gameMode throws InvalidSessionException")
    void validate_MatchWithNullGameMode_ThrowsException() {
        CreateGameSessionRequest base = createValidMatchChallengeRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), base.gameId(), null, base.completionStatus(),
            base.score(), base.startedAt(), base.endedAt(), base.durationSeconds(),
            base.coinsCollected(), base.distancePixels(), base.speedPxPerSec(),
            base.distanceMeters(), base.speedMPerSec(), base.movesMade(),
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("gameMode is required for GAZE_MATCH");
    }

    @Test
    @DisplayName("GAZE_MATCH with invalid gameMode throws InvalidSessionException")
    void validate_MatchWithInvalidGameMode_ThrowsException() {
        CreateGameSessionRequest base = createValidMatchChallengeRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), base.gameId(), "SURVIVAL", base.completionStatus(),
            base.score(), base.startedAt(), base.endedAt(), base.durationSeconds(),
            base.coinsCollected(), base.distancePixels(), base.speedPxPerSec(),
            base.distanceMeters(), base.speedMPerSec(), base.movesMade(),
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("gameMode is required for GAZE_MATCH and must be one of");
    }

    @Test
    @DisplayName("GAZE_RUNNER with 3D runner metrics throws InvalidSessionException")
    void validate_RunnerWith3DMetrics_ThrowsException() {
        CreateGameSessionRequest base = createValidRunnerRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), base.gameId(), base.gameMode(), base.completionStatus(),
            base.score(), base.startedAt(), base.endedAt(), base.durationSeconds(),
            base.coinsCollected(), base.distancePixels(), base.speedPxPerSec(),
            new BigDecimal("100.00"), null, base.movesMade(),
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("GAZE_RUNNER cannot accept 3D runner or Gaze Match metrics");
    }

    @Test
    @DisplayName("GAZE_3D_RUNNER missing distanceMeters throws InvalidSessionException")
    void validate_3DRunnerMissingMeters_ThrowsException() {
        CreateGameSessionRequest base = createValid3DRunnerRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), base.gameId(), base.gameMode(), base.completionStatus(),
            base.score(), base.startedAt(), base.endedAt(), base.durationSeconds(),
            base.coinsCollected(), null, null,
            null, base.speedMPerSec(), base.movesMade(),
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("distanceMeters is required for GAZE_3D_RUNNER");
    }

    @Test
    @DisplayName("GAZE_MATCH missing movesMade throws InvalidSessionException")
    void validate_MatchMissingMovesMade_ThrowsException() {
        CreateGameSessionRequest base = createValidMatchChallengeRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), base.gameId(), base.gameMode(), base.completionStatus(),
            base.score(), base.startedAt(), base.endedAt(), base.durationSeconds(),
            null, null, null,
            null, null, null,
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("movesMade is required for GAZE_MATCH");
    }

    @Test
    @DisplayName("endedAt before startedAt throws InvalidSessionException")
    void validate_EndedAtBeforeStartedAt_ThrowsException() {
        Instant start = Instant.parse("2026-10-30T10:00:00Z");
        Instant end = Instant.parse("2026-10-30T09:59:00Z");
        CreateGameSessionRequest base = createValidRunnerRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), base.gameId(), base.gameMode(), base.completionStatus(),
            base.score(), start, end, base.durationSeconds(),
            base.coinsCollected(), base.distancePixels(), base.speedPxPerSec(),
            base.distanceMeters(), base.speedMPerSec(), base.movesMade(),
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("endedAt must not be earlier than startedAt");
    }

    @Test
    @DisplayName("durationSeconds exceeding wall-clock plus tolerance throws InvalidSessionException")
    void validate_DurationExceedsWallClock_ThrowsException() {
        Instant start = Instant.parse("2026-10-30T10:00:00Z");
        Instant end = Instant.parse("2026-10-30T10:01:00Z"); // 60 seconds
        CreateGameSessionRequest base = createValidRunnerRequest();
        CreateGameSessionRequest req = new CreateGameSessionRequest(
            base.id(), base.gameId(), base.gameMode(), base.completionStatus(),
            base.score(), start, end, 100, // 100 > 60 + 15
            base.coinsCollected(), base.distancePixels(), base.speedPxPerSec(),
            base.distanceMeters(), base.speedMPerSec(), base.movesMade(),
            base.movesRemaining(), base.matchesCount(), base.targetScore(), base.isWin()
        );

        assertThatThrownBy(() -> validator.validate(req))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("durationSeconds (100) cannot exceed elapsed wall-clock time");
    }
}

