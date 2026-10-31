package com.gazemouse.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Stores accessibility preferences for a guest client installation (1:1 with ClientProfile).
 */
@Entity
@Table(name = "accessibility_preferences")
public class AccessibilityPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_profile_id", nullable = false, unique = true)
    private ClientProfile clientProfile;

    @Column(name = "sensitivity", nullable = false, precision = 3, scale = 2)
    private BigDecimal sensitivity = new BigDecimal("1.50");

    @Column(name = "smoothing", nullable = false, precision = 3, scale = 2)
    private BigDecimal smoothing = new BigDecimal("0.30");

    @Column(name = "dead_zone", nullable = false)
    private Integer deadZone = 10;

    @Column(name = "dwell_duration", nullable = false)
    private Integer dwellDuration = 1200;

    @Column(name = "vertical_gestures", nullable = false)
    private Boolean verticalGestures = false;

    @Column(name = "sound_enabled", nullable = false)
    private Boolean soundEnabled = true;

    @Column(name = "theme", nullable = false, length = 10)
    private String theme = "light";

    @Column(name = "reduced_motion", nullable = false)
    private Boolean reducedMotion = false;

    @Column(name = "high_contrast", nullable = false)
    private Boolean highContrast = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public AccessibilityPreference() {
    }

    public AccessibilityPreference(ClientProfile clientProfile) {
        this.clientProfile = clientProfile;
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (sensitivity == null) {
            sensitivity = new BigDecimal("1.50");
        }
        if (smoothing == null) {
            smoothing = new BigDecimal("0.30");
        }
        if (deadZone == null) {
            deadZone = 10;
        }
        if (dwellDuration == null) {
            dwellDuration = 1200;
        }
        if (verticalGestures == null) {
            verticalGestures = false;
        }
        if (soundEnabled == null) {
            soundEnabled = true;
        }
        if (theme == null) {
            theme = "light";
        }
        if (reducedMotion == null) {
            reducedMotion = false;
        }
        if (highContrast == null) {
            highContrast = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
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

    public BigDecimal getSensitivity() {
        return sensitivity;
    }

    public void setSensitivity(BigDecimal sensitivity) {
        this.sensitivity = sensitivity;
    }

    public BigDecimal getSmoothing() {
        return smoothing;
    }

    public void setSmoothing(BigDecimal smoothing) {
        this.smoothing = smoothing;
    }

    public Integer getDeadZone() {
        return deadZone;
    }

    public void setDeadZone(Integer deadZone) {
        this.deadZone = deadZone;
    }

    public Integer getDwellDuration() {
        return dwellDuration;
    }

    public void setDwellDuration(Integer dwellDuration) {
        this.dwellDuration = dwellDuration;
    }

    public Boolean getVerticalGestures() {
        return verticalGestures;
    }

    public void setVerticalGestures(Boolean verticalGestures) {
        this.verticalGestures = verticalGestures;
    }

    public Boolean getSoundEnabled() {
        return soundEnabled;
    }

    public void setSoundEnabled(Boolean soundEnabled) {
        this.soundEnabled = soundEnabled;
    }

    public String getTheme() {
        return theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }

    public Boolean getReducedMotion() {
        return reducedMotion;
    }

    public void setReducedMotion(Boolean reducedMotion) {
        this.reducedMotion = reducedMotion;
    }

    public Boolean getHighContrast() {
        return highContrast;
    }

    public void setHighContrast(Boolean highContrast) {
        this.highContrast = highContrast;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof AccessibilityPreference that)) return false;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "AccessibilityPreference{" +
                "id=" + id +
                ", sensitivity=" + sensitivity +
                ", smoothing=" + smoothing +
                ", deadZone=" + deadZone +
                ", dwellDuration=" + dwellDuration +
                ", verticalGestures=" + verticalGestures +
                ", soundEnabled=" + soundEnabled +
                ", theme='" + theme + '\'' +
                ", reducedMotion=" + reducedMotion +
                ", highContrast=" + highContrast +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}

