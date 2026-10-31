package com.gazemouse.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

/**
 * Request payload for creating or updating accessibility preferences.
 */
public record UpdatePreferenceRequest(
    @NotNull(message = "sensitivity is required")
    @DecimalMin(value = "1.00", message = "sensitivity must be at least 1.00")
    @DecimalMax(value = "3.00", message = "sensitivity must be at most 3.00")
    @Digits(integer = 1, fraction = 2, message = "sensitivity must have at most 2 decimal places")
    BigDecimal sensitivity,

    @NotNull(message = "smoothing is required")
    @DecimalMin(value = "0.10", message = "smoothing must be at least 0.10")
    @DecimalMax(value = "0.90", message = "smoothing must be at most 0.90")
    @Digits(integer = 1, fraction = 2, message = "smoothing must have at most 2 decimal places")
    BigDecimal smoothing,

    @NotNull(message = "deadZone is required")
    @Min(value = 5, message = "deadZone must be at least 5")
    @Max(value = 30, message = "deadZone must be at most 30")
    Integer deadZone,

    @NotNull(message = "dwellDuration is required")
    @Min(value = 600, message = "dwellDuration must be at least 600")
    @Max(value = 2500, message = "dwellDuration must be at most 2500")
    Integer dwellDuration,

    @NotNull(message = "verticalGestures is required")
    Boolean verticalGestures,

    @NotNull(message = "soundEnabled is required")
    Boolean soundEnabled,

    @NotNull(message = "theme is required")
    @Pattern(regexp = "^(light|dark)$", message = "theme must be 'light' or 'dark'")
    String theme,

    @NotNull(message = "reducedMotion is required")
    Boolean reducedMotion,

    @NotNull(message = "highContrast is required")
    Boolean highContrast
) {
}

