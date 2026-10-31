package com.gazemouse.backend.service;

import com.gazemouse.backend.dto.GameStatsResponse;
import com.gazemouse.backend.entity.ClientProfile;
import com.gazemouse.backend.entity.GameSession;
import com.gazemouse.backend.exception.InvalidSessionException;
import com.gazemouse.backend.repository.GameSessionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GameStatsServiceTest {

    @Mock
    private GameSessionRepository gameSessionRepository;

    @Mock
    private ClientProfileService clientProfileService;

    @InjectMocks
    private GameStatsService gameStatsService;

    private GameSession createSession(ClientProfile profile, String gameId, String status, int score, int duration) {
        GameSession s = new GameSession();
        s.setId(UUID.randomUUID());
        s.setClientProfile(profile);
        s.setGameId(gameId);
        s.setCompletionStatus(status);
        s.setScore(score);
        s.setStartedAt(Instant.now().minusSeconds(duration));
        s.setEndedAt(Instant.now());
        s.setDurationSeconds(duration);

        if ("GAZE_RUNNER".equals(gameId)) {
            s.setCoinsCollected(score / 10);
            s.setDistancePixels(score * 10);
            s.setSpeedPxPerSec(new BigDecimal("50.00"));
        } else if ("GAZE_MATCH".equals(gameId)) {
            s.setGameMode("CHALLENGE");
            s.setMovesMade(10);
            s.setMatchesCount(5);
            s.setIsWin(score >= 500);
        }
        return s;
    }

    @Test
    @DisplayName("Empty statistics returned when new guest has no recorded sessions")
    void getStats_NewGuestWithZeroSessions_ReturnsEmptyStats() {
        UUID installationId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(UUID.randomUUID());

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(gameSessionRepository.findByClientProfileId(profile.getId())).thenReturn(Collections.emptyList());

        GameStatsResponse response = gameStatsService.getStats(installationId, null);

        assertThat(response.totalSessions()).isZero();
        assertThat(response.completedSessions()).isZero();
        assertThat(response.abandonedSessions()).isZero();
        assertThat(response.interruptedSessions()).isZero();
        assertThat(response.totalPlayTimeSeconds()).isZero();
        assertThat(response.highScore()).isZero();
        assertThat(response.averageScore()).isEqualTo(0.0);
        assertThat(response.gazeRunner()).isNull();
        assertThat(response.gaze3dRunner()).isNull();
        assertThat(response.gazeMatch()).isNull();
    }

    @Test
    @DisplayName("Statistics accurately distinguish completed from abandoned/interrupted sessions")
    void getStats_AcrossCompletionStatuses_CalculatesAccurately() {
        UUID installationId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(UUID.randomUUID());

        // Session 1: COMPLETED, score=300, duration=60
        GameSession s1 = createSession(profile, "GAZE_RUNNER", "COMPLETED", 300, 60);
        // Session 2: COMPLETED, score=500, duration=100
        GameSession s2 = createSession(profile, "GAZE_RUNNER", "COMPLETED", 500, 100);
        // Session 3: ABANDONED, score=900 (must be excluded from score/runner stats!), duration=40
        GameSession s3 = createSession(profile, "GAZE_RUNNER", "ABANDONED", 900, 40);
        // Session 4: INTERRUPTED, score=1200 (must be excluded!), duration=20
        GameSession s4 = createSession(profile, "GAZE_RUNNER", "INTERRUPTED", 1200, 20);

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(gameSessionRepository.findByClientProfileId(profile.getId())).thenReturn(List.of(s1, s2, s3, s4));

        GameStatsResponse response = gameStatsService.getStats(installationId, null);

        assertThat(response.totalSessions()).isEqualTo(4);
        assertThat(response.completedSessions()).isEqualTo(2);
        assertThat(response.abandonedSessions()).isEqualTo(1);
        assertThat(response.interruptedSessions()).isEqualTo(1);
        // Total play time includes all sessions: 60 + 100 + 40 + 20 = 220s
        assertThat(response.totalPlayTimeSeconds()).isEqualTo(220L);
        // High score must be 500 (from completed), NOT 900 or 1200
        assertThat(response.highScore()).isEqualTo(500);
        // Average score: (300 + 500) / 2 = 400.0
        assertThat(response.averageScore()).isEqualTo(400.0);
        // Gaze runner stats from completed only: coins = 30 + 50 = 80
        assertThat(response.gazeRunner()).isNotNull();
        assertThat(response.gazeRunner().totalCoinsCollected()).isEqualTo(80);
    }

    @Test
    @DisplayName("Filtering statistics by gameId queries only that game and excludes other games")
    void getStats_FilterByGameId_ReturnsFilteredStats() {
        UUID installationId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(UUID.randomUUID());

        GameSession s1 = createSession(profile, "GAZE_RUNNER", "COMPLETED", 300, 60);

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(gameSessionRepository.findByClientProfileIdAndGameId(profile.getId(), "GAZE_RUNNER"))
            .thenReturn(List.of(s1));

        GameStatsResponse response = gameStatsService.getStats(installationId, "GAZE_RUNNER");

        assertThat(response.gameId()).isEqualTo("GAZE_RUNNER");
        assertThat(response.totalSessions()).isEqualTo(1);
        assertThat(response.gazeRunner()).isNotNull();
        assertThat(response.gaze3dRunner()).isNull();
        assertThat(response.gazeMatch()).isNull();
    }

    @Test
    @DisplayName("Invalid gameId parameter throws InvalidSessionException")
    void getStats_InvalidGameId_ThrowsException() {
        UUID installationId = UUID.randomUUID();

        assertThatThrownBy(() -> gameStatsService.getStats(installationId, "UNKNOWN_GAME"))
            .isInstanceOf(InvalidSessionException.class)
            .hasMessageContaining("Invalid gameId 'UNKNOWN_GAME'");
    }

    @Test
    @DisplayName("Guest isolation: client B receives zero sessions even when client A has sessions")
    void getStats_GuestIsolation_DistinctGuestsAreIsolated() {
        UUID clientA = UUID.randomUUID();
        UUID clientB = UUID.randomUUID();

        ClientProfile profileA = new ClientProfile(clientA, "WEB");
        profileA.setId(UUID.randomUUID());

        ClientProfile profileB = new ClientProfile(clientB, "WEB");
        profileB.setId(UUID.randomUUID());

        GameSession sA = createSession(profileA, "GAZE_RUNNER", "COMPLETED", 500, 60);

        when(clientProfileService.getOrCreateProfile(clientA)).thenReturn(profileA);
        when(clientProfileService.getOrCreateProfile(clientB)).thenReturn(profileB);
        when(gameSessionRepository.findByClientProfileId(profileA.getId())).thenReturn(List.of(sA));
        when(gameSessionRepository.findByClientProfileId(profileB.getId())).thenReturn(Collections.emptyList());

        GameStatsResponse statsA = gameStatsService.getStats(clientA, null);
        GameStatsResponse statsB = gameStatsService.getStats(clientB, null);

        assertThat(statsA.totalSessions()).isEqualTo(1);
        assertThat(statsB.totalSessions()).isZero();
    }
}

