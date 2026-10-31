package com.gazemouse.backend.dto;

import com.gazemouse.backend.entity.AccessibilityPreference;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Response payload representing accessibility preferences for a guest profile.
 */
public record AccessibilityPreferenceResponse(
    BigDecimal sensitivity,
    BigDecimal smoothing,
    Integer deadZone,
    Integer dwellDuration,
    Boolean verticalGestures,
    Boolean soundEnabled,
    String theme,
    Boolean reducedMotion,
    Boolean highContrast,
    Instant updatedAt
) {
    public static AccessibilityPreferenceResponse fromEntity(AccessibilityPreference entity) {
        return new AccessibilityPreferenceResponse(
            entity.getSensitivity(),
            entity.getSmoothing(),
            entity.getDeadZone(),
            entity.getDwellDuration(),
            entity.getVerticalGestures(),
            entity.getSoundEnabled(),
            entity.getTheme(),
            entity.getReducedMotion(),
            entity.getHighContrast(),
            entity.getUpdatedAt()
        );
    }
}

