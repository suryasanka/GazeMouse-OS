package com.gazemouse.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Represents an anonymous guest client installation profile.
 */
@Entity
@Table(name = "client_profiles")
public class ClientProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "installation_id", nullable = false, unique = true)
    private UUID installationId;

    @Column(name = "client_platform", nullable = false, length = 32)
    private String clientPlatform = "WEB";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToOne(mappedBy = "clientProfile", fetch = FetchType.LAZY)
    private AccessibilityPreference accessibilityPreference;

    public ClientProfile() {
    }

    public ClientProfile(UUID installationId) {
        this.installationId = installationId;
        this.clientPlatform = "WEB";
    }

    public ClientProfile(UUID installationId, String clientPlatform) {
        this.installationId = installationId;
        this.clientPlatform = clientPlatform != null ? clientPlatform : "WEB";
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
        if (clientPlatform == null) {
            clientPlatform = "WEB";
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

    public UUID getInstallationId() {
        return installationId;
    }

    public void setInstallationId(UUID installationId) {
        this.installationId = installationId;
    }

    public String getClientPlatform() {
        return clientPlatform;
    }

    public void setClientPlatform(String clientPlatform) {
        this.clientPlatform = clientPlatform;
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

    public AccessibilityPreference getAccessibilityPreference() {
        return accessibilityPreference;
    }

    public void setAccessibilityPreference(AccessibilityPreference accessibilityPreference) {
        this.accessibilityPreference = accessibilityPreference;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ClientProfile that)) return false;
        return Objects.equals(installationId, that.installationId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(installationId);
    }

    @Override
    public String toString() {
        return "ClientProfile{" +
                "id=" + id +
                ", installationId=" + installationId +
                ", clientPlatform='" + clientPlatform + '\'' +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}

