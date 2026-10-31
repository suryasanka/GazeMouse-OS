package com.gazemouse.backend.service;

import com.gazemouse.backend.dto.CreateGameSessionRequest;
import com.gazemouse.backend.entity.ClientProfile;
import com.gazemouse.backend.entity.GameSession;
import com.gazemouse.backend.exception.SessionConflictException;
import com.gazemouse.backend.repository.GameSessionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GameSessionServiceTest {

    @Mock
    private GameSessionRepository gameSessionRepository;

    @Mock
    private ClientProfileService clientProfileService;

    @Mock
    private GameSessionValidator gameSessionValidator;

    @InjectMocks
    private GameSessionService gameSessionService;

    private CreateGameSessionRequest createRunnerRequest(UUID sessionId) {
        return new CreateGameSessionRequest(
            sessionId,
            "GAZE_RUNNER",
            null,
            "COMPLETED",
            300,
            Instant.parse("2026-10-30T11:00:00Z"),
            Instant.parse("2026-10-30T11:01:00Z"),
            60,
            15,
            3600,
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

    private GameSession createRunnerEntity(UUID sessionId, ClientProfile profile) {
        GameSession session = new GameSession();
        session.setId(sessionId);
        session.setClientProfile(profile);
        session.setGameId("GAZE_RUNNER");
        session.setGameMode(null);
        session.setCompletionStatus("COMPLETED");
        session.setScore(300);
        session.setStartedAt(Instant.parse("2026-10-30T11:00:00Z"));
        session.setEndedAt(Instant.parse("2026-10-30T11:01:00Z"));
        session.setDurationSeconds(60);
        session.setCoinsCollected(15);
        session.setDistancePixels(3600);
        session.setSpeedPxPerSec(new BigDecimal("60.00"));
        session.setCreatedAt(Instant.parse("2026-10-30T11:01:01Z"));
        session.setRecordedAt(Instant.parse("2026-10-30T11:01:01Z"));
        return session;
    }

    @Test
    @DisplayName("First submission creates and saves new session with isCreated=true")
    void recordSession_FirstSubmission_CreatesSession() {
        UUID installationId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(UUID.randomUUID());

        CreateGameSessionRequest request = createRunnerRequest(sessionId);
        GameSession savedEntity = createRunnerEntity(sessionId, profile);

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(gameSessionRepository.findById(sessionId)).thenReturn(Optional.empty());
        when(gameSessionRepository.save(any(GameSession.class))).thenReturn(savedEntity);

        GameSessionService.SessionRecordResult result = gameSessionService.recordSession(installationId, request);

        assertThat(result.isCreated()).isTrue();
        assertThat(result.response().id()).isEqualTo(sessionId);
        assertThat(result.response().score()).isEqualTo(300);
        verify(gameSessionRepository).save(any(GameSession.class));
    }

    @Test
    @DisplayName("Identical duplicate submission returns existing session with isCreated=false")
    void recordSession_IdenticalDuplicate_ReturnsExistingWithoutSaving() {
        UUID installationId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(UUID.randomUUID());

        CreateGameSessionRequest request = createRunnerRequest(sessionId);
        GameSession existing = createRunnerEntity(sessionId, profile);

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(gameSessionRepository.findById(sessionId)).thenReturn(Optional.of(existing));

        GameSessionService.SessionRecordResult result = gameSessionService.recordSession(installationId, request);

        assertThat(result.isCreated()).isFalse();
        assertThat(result.response().id()).isEqualTo(sessionId);
        verify(gameSessionRepository, never()).save(any(GameSession.class));
    }

    @Test
    @DisplayName("Conflicting duplicate submission with different score throws SessionConflictException")
    void recordSession_ConflictingPayload_ThrowsSessionConflictException() {
        UUID installationId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(UUID.randomUUID());

        CreateGameSessionRequest request = createRunnerRequest(sessionId);
        GameSession existing = createRunnerEntity(sessionId, profile);
        existing.setScore(999); // different score!

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(gameSessionRepository.findById(sessionId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> gameSessionService.recordSession(installationId, request))
            .isInstanceOf(SessionConflictException.class)
            .hasMessageContaining("already exists with a different payload");
    }

    @Test
    @DisplayName("Session ID registered by another installation throws SessionConflictException")
    void recordSession_BelongsToAnotherInstallation_ThrowsSessionConflictException() {
        UUID installationId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        ClientProfile myProfile = new ClientProfile(installationId, "WEB");
        myProfile.setId(UUID.randomUUID());

        ClientProfile otherProfile = new ClientProfile(UUID.randomUUID(), "WEB");
        otherProfile.setId(UUID.randomUUID());

        CreateGameSessionRequest request = createRunnerRequest(sessionId);
        GameSession existing = createRunnerEntity(sessionId, otherProfile);

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(myProfile);
        when(gameSessionRepository.findById(sessionId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> gameSessionService.recordSession(installationId, request))
            .isInstanceOf(SessionConflictException.class)
            .hasMessageContaining("conflicts with an existing session from another installation");
    }

    @Test
    @DisplayName("Concurrent insert recovering identical session succeeds with isCreated=false")
    void recordSession_ConcurrentInsert_RecoversIdenticalSession() {
        UUID installationId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(UUID.randomUUID());

        CreateGameSessionRequest request = createRunnerRequest(sessionId);
        GameSession concurrentEntity = createRunnerEntity(sessionId, profile);

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(gameSessionRepository.findById(sessionId))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(concurrentEntity));
        when(gameSessionRepository.save(any(GameSession.class)))
            .thenThrow(new DataIntegrityViolationException("duplicate key value"));

        GameSessionService.SessionRecordResult result = gameSessionService.recordSession(installationId, request);

        assertThat(result.isCreated()).isFalse();
        assertThat(result.response().id()).isEqualTo(sessionId);
    }
}

