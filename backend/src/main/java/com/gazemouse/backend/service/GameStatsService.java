package com.gazemouse.backend.service;

import com.gazemouse.backend.dto.GameStatsResponse;
import com.gazemouse.backend.dto.Gaze3DRunnerStats;
import com.gazemouse.backend.dto.GazeMatchStats;
import com.gazemouse.backend.dto.GazeRunnerStats;
import com.gazemouse.backend.entity.ClientProfile;
import com.gazemouse.backend.entity.GameSession;
import com.gazemouse.backend.exception.InvalidSessionException;
import com.gazemouse.backend.repository.GameSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Service calculating guest game session statistics.
 */
@Service
public class GameStatsService {

    private static final Logger log = LoggerFactory.getLogger(GameStatsService.class);

    private final GameSessionRepository gameSessionRepository;
    private final ClientProfileService clientProfileService;

    public GameStatsService(GameSessionRepository gameSessionRepository,
                            ClientProfileService clientProfileService) {
        this.gameSessionRepository = gameSessionRepository;
        this.clientProfileService = clientProfileService;
    }

    /**
     * Retrieves aggregated game session statistics for a guest installation.
     * Incomplete sessions (ABANDONED, INTERRUPTED) are excluded from score and completed-game metrics.
     *
     * @param installationId guest client installation UUID
     * @param gameId optional game filter identifier
     * @return calculated statistics response
     */
    @Transactional(readOnly = true)
    public GameStatsResponse getStats(UUID installationId, String gameId) {
        if (gameId != null && !gameId.isBlank()) {
            if (!GameSessionValidator.ALLOWED_GAMES.contains(gameId)) {
                throw new InvalidSessionException(
                    "Invalid gameId '" + gameId + "'. Allowed values are: " + GameSessionValidator.ALLOWED_GAMES
                );
            }
        } else {
            gameId = null;
        }

        ClientProfile profile = clientProfileService.getOrCreateProfile(installationId);

        List<GameSession> sessions = (gameId != null)
            ? gameSessionRepository.findByClientProfileIdAndGameId(profile.getId(), gameId)
            : gameSessionRepository.findByClientProfileId(profile.getId());

        if (sessions.isEmpty()) {
            log.debug("No sessions found for profile {} and gameId {}", profile.getId(), gameId);
            return GameStatsResponse.empty(gameId);
        }

        int totalSessions = sessions.size();
        int completedCount = 0;
        int abandonedCount = 0;
        int interruptedCount = 0;
        long totalPlayTime = 0;

        for (GameSession s : sessions) {
            totalPlayTime += (s.getDurationSeconds() != null ? s.getDurationSeconds() : 0);
            if ("COMPLETED".equalsIgnoreCase(s.getCompletionStatus())) {
                completedCount++;
            } else if ("ABANDONED".equalsIgnoreCase(s.getCompletionStatus())) {
                abandonedCount++;
            } else if ("INTERRUPTED".equalsIgnoreCase(s.getCompletionStatus())) {
                interruptedCount++;
            }
        }

        List<GameSession> completed = sessions.stream()
            .filter(s -> "COMPLETED".equalsIgnoreCase(s.getCompletionStatus()))
            .toList();

        int highScore = completed.stream()
            .mapToInt(s -> s.getScore() != null ? s.getScore() : 0)
            .max()
            .orElse(0);

        double averageScore = completed.isEmpty()
            ? 0.0
            : Math.round(completed.stream()
                .mapToInt(s -> s.getScore() != null ? s.getScore() : 0)
                .average()
                .orElse(0.0) * 100.0) / 100.0;

        GazeRunnerStats gazeRunner = computeGazeRunnerStats(sessions, completed, gameId);
        Gaze3DRunnerStats gaze3dRunner = computeGaze3DRunnerStats(sessions, completed, gameId);
        GazeMatchStats gazeMatch = computeGazeMatchStats(sessions, completed, gameId);

        return new GameStatsResponse(
            gameId,
            totalSessions,
            completedCount,
            abandonedCount,
            interruptedCount,
            totalPlayTime,
            highScore,
            averageScore,
            gazeRunner,
            gaze3dRunner,
            gazeMatch
        );
    }

    private GazeRunnerStats computeGazeRunnerStats(List<GameSession> all, List<GameSession> completed, String gameFilter) {
        if (gameFilter != null && !"GAZE_RUNNER".equals(gameFilter)) {
            return null;
        }

        boolean hasPlayed = all.stream().anyMatch(s -> "GAZE_RUNNER".equals(s.getGameId()));
        if (!hasPlayed && gameFilter == null) {
            return null;
        }

        List<GameSession> runnerCompleted = completed.stream()
            .filter(s -> "GAZE_RUNNER".equals(s.getGameId()))
            .toList();

        int totalCoins = runnerCompleted.stream()
            .mapToInt(s -> s.getCoinsCollected() != null ? s.getCoinsCollected() : 0)
            .sum();

        int maxDist = runnerCompleted.stream()
            .mapToInt(s -> s.getDistancePixels() != null ? s.getDistancePixels() : 0)
            .max()
            .orElse(0);

        BigDecimal maxSpeed = runnerCompleted.stream()
            .map(GameSession::getSpeedPxPerSec)
            .filter(Objects::nonNull)
            .max(BigDecimal::compareTo)
            .orElse(BigDecimal.ZERO);

        return new GazeRunnerStats(totalCoins, maxDist, maxSpeed);
    }

    private Gaze3DRunnerStats computeGaze3DRunnerStats(List<GameSession> all, List<GameSession> completed, String gameFilter) {
        if (gameFilter != null && !"GAZE_3D_RUNNER".equals(gameFilter)) {
            return null;
        }

        boolean hasPlayed = all.stream().anyMatch(s -> "GAZE_3D_RUNNER".equals(s.getGameId()));
        if (!hasPlayed && gameFilter == null) {
            return null;
        }

        List<GameSession> runner3dCompleted = completed.stream()
            .filter(s -> "GAZE_3D_RUNNER".equals(s.getGameId()))
            .toList();

        int totalCoins = runner3dCompleted.stream()
            .mapToInt(s -> s.getCoinsCollected() != null ? s.getCoinsCollected() : 0)
            .sum();

        BigDecimal maxDist = runner3dCompleted.stream()
            .map(GameSession::getDistanceMeters)
            .filter(Objects::nonNull)
            .max(BigDecimal::compareTo)
            .orElse(BigDecimal.ZERO);

        BigDecimal maxSpeed = runner3dCompleted.stream()
            .map(GameSession::getSpeedMPerSec)
            .filter(Objects::nonNull)
            .max(BigDecimal::compareTo)
            .orElse(BigDecimal.ZERO);

        return new Gaze3DRunnerStats(totalCoins, maxDist, maxSpeed);
    }

    private GazeMatchStats computeGazeMatchStats(List<GameSession> all, List<GameSession> completed, String gameFilter) {
        if (gameFilter != null && !"GAZE_MATCH".equals(gameFilter)) {
            return null;
        }

        boolean hasPlayed = all.stream().anyMatch(s -> "GAZE_MATCH".equals(s.getGameId()));
        if (!hasPlayed && gameFilter == null) {
            return null;
        }

        List<GameSession> matchCompleted = completed.stream()
            .filter(s -> "GAZE_MATCH".equals(s.getGameId()))
            .toList();

        int totalMatches = matchCompleted.stream()
            .mapToInt(s -> s.getMatchesCount() != null ? s.getMatchesCount() : 0)
            .sum();

        int totalMoves = matchCompleted.stream()
            .mapToInt(s -> s.getMovesMade() != null ? s.getMovesMade() : 0)
            .sum();

        int gamesWon = (int) matchCompleted.stream()
            .filter(s -> Boolean.TRUE.equals(s.getIsWin()))
            .count();

        double winRate = matchCompleted.isEmpty()
            ? 0.0
            : Math.round(((double) gamesWon / matchCompleted.size()) * 100.0) / 100.0;

        return new GazeMatchStats(totalMatches, totalMoves, gamesWon, winRate);
    }
}

