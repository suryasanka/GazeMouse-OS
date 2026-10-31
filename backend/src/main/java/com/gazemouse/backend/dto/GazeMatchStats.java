package com.gazemouse.backend.dto;

/**
 * Aggregated statistics for Gaze Match.
 */
public record GazeMatchStats(
    int totalMatches,
    int totalMoves,
    int gamesWon,
    double winRate
) {
}

