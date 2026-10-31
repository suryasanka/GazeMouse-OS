package com.gazemouse.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Stores individual game session telemetry.
 * Primary key 'id' is client-generated for idempotency.
 */
@Entity
@Table(name = "game_sessions")
public class GameSession {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_profile_id", nullable = false)
    private ClientProfile clientProfile;

    @Column(name = "game_id", nullable = false, length = 32)
    private String gameId;

    @Column(name = "game_mode", length = 20)
    private String gameMode;

    @Column(name = "completion_status", nullable = false, length = 20)
    private String completionStatus;

    @Column(name = "score", nullable = false)
    private Integer score = 0;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at", nullable = false)
    private Instant endedAt;

    @Column(name = "duration_seconds", nullable = false)
    private Integer durationSeconds = 0;

    // 2D Canvas Runner Metrics
    @Column(name = "coins_collected")
    private Integer coinsCollected;

    @Column(name = "distance_pixels")
    private Integer distancePixels;

    @Column(name = "speed_px_per_sec", precision = 8, scale = 2)
    private BigDecimal speedPxPerSec;

    // 3D WebGL Runner Metrics
    @Column(name = "distance_meters", precision = 10, scale = 2)
    private BigDecimal distanceMeters;

    @Column(name = "speed_m_per_sec", precision = 6, scale = 2)
    private BigDecimal speedMPerSec;

    // Gaze Match Metrics
    @Column(name = "moves_made")
    private Integer movesMade;

    @Column(name = "moves_remaining")
    private Integer movesRemaining;

    @Column(name = "matches_count")
    private Integer matchesCount;

    @Column(name = "target_score")
    private Integer targetScore;

    @Column(name = "is_win")
    private Boolean isWin;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private Instant recordedAt;

    public GameSession() {
    }

    public GameSession(UUID id, ClientProfile clientProfile, String gameId, String completionStatus) {
        this.id = id;
        this.clientProfile = clientProfile;
        this.gameId = gameId;
        this.completionStatus = completionStatus;
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (recordedAt == null) {
            recordedAt = now;
        }
        if (score == null) {
            score = 0;
        }
        if (durationSeconds == null) {
            durationSeconds = 0;
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public ClientProfile getClientProfile() {
        return clientProfile;
    }

    public void setClientProfile(ClientProfile clientProfile) {
        this.clientProfile = clientProfile;
    }

    public String getGameId() {
        return gameId;
    }

    public void setGameId(String gameId) {
        this.gameId = gameId;
    }

    public String getGameMode() {
        return gameMode;
    }

    public void setGameMode(String gameMode) {
        this.gameMode = gameMode;
    }

    public String getCompletionStatus() {
        return completionStatus;
    }

    public void setCompletionStatus(String completionStatus) {
        this.completionStatus = completionStatus;
    }

    public Integer getScore() {
        return score;
    }

    public void setScore(Integer score) {
        this.score = score;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(Instant endedAt) {
        this.endedAt = endedAt;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Integer durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public Integer getCoinsCollected() {
        return coinsCollected;
    }

    public void setCoinsCollected(Integer coinsCollected) {
        this.coinsCollected = coinsCollected;
    }

    public Integer getDistancePixels() {
        return distancePixels;
    }

    public void setDistancePixels(Integer distancePixels) {
        this.distancePixels = distancePixels;
    }

    public BigDecimal getSpeedPxPerSec() {
        return speedPxPerSec;
    }

    public void setSpeedPxPerSec(BigDecimal speedPxPerSec) {
        this.speedPxPerSec = speedPxPerSec;
    }

    public BigDecimal getDistanceMeters() {
        return distanceMeters;
    }

    public void setDistanceMeters(BigDecimal distanceMeters) {
        this.distanceMeters = distanceMeters;
    }

    public BigDecimal getSpeedMPerSec() {
        return speedMPerSec;
    }

    public void setSpeedMPerSec(BigDecimal speedMPerSec) {
        this.speedMPerSec = speedMPerSec;
    }

    public Integer getMovesMade() {
        return movesMade;
    }

    public void setMovesMade(Integer movesMade) {
        this.movesMade = movesMade;
    }

    public Integer getMovesRemaining() {
        return movesRemaining;
    }

    public void setMovesRemaining(Integer movesRemaining) {
        this.movesRemaining = movesRemaining;
    }

    public Integer getMatchesCount() {
        return matchesCount;
    }

    public void setMatchesCount(Integer matchesCount) {
        this.matchesCount = matchesCount;
    }

    public Integer getTargetScore() {
        return targetScore;
    }

    public void setTargetScore(Integer targetScore) {
        this.targetScore = targetScore;
    }

    public Boolean getIsWin() {
        return isWin;
    }

    public void setIsWin(Boolean win) {
        isWin = win;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof GameSession that)) return false;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "GameSession{" +
                "id=" + id +
                ", gameId='" + gameId + '\'' +
                ", gameMode='" + gameMode + '\'' +
                ", completionStatus='" + completionStatus + '\'' +
                ", score=" + score +
                ", startedAt=" + startedAt +
                ", endedAt=" + endedAt +
                ", durationSeconds=" + durationSeconds +
                '}';
    }
}

