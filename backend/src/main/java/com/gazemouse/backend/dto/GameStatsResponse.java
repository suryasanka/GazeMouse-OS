package com.gazemouse.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Aggregated statistics for guest game sessions.
 */
public record GameStatsResponse(
    String gameId,
    int totalSessions,
    int completedSessions,
    int abandonedSessions,
    int interruptedSessions,
    long totalPlayTimeSeconds,
    int highScore,
    double averageScore,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    GazeRunnerStats gazeRunner,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    Gaze3DRunnerStats gaze3dRunner,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    GazeMatchStats gazeMatch
) {
    /**
     * Factory for an empty statistics response when no sessions exist.
     */
    public static GameStatsResponse empty(String gameId) {
        return new GameStatsResponse(
            gameId,
            0,
            0,
            0,
            0,
            0L,
            0,
            0.0,
            null,
            null,
            null
        );
    }
}
