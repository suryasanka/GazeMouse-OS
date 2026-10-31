package com.gazemouse.backend.service;

import com.gazemouse.backend.dto.AccessibilityPreferenceResponse;
import com.gazemouse.backend.dto.UpdatePreferenceRequest;
import com.gazemouse.backend.entity.AccessibilityPreference;
import com.gazemouse.backend.entity.ClientProfile;
import com.gazemouse.backend.repository.AccessibilityPreferenceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Service managing guest accessibility preferences.
 */
@Service
public class PreferenceService {

    private static final Logger log = LoggerFactory.getLogger(PreferenceService.class);

    private final AccessibilityPreferenceRepository preferenceRepository;
    private final ClientProfileService clientProfileService;

    public PreferenceService(AccessibilityPreferenceRepository preferenceRepository,
                             ClientProfileService clientProfileService) {
        this.preferenceRepository = preferenceRepository;
        this.clientProfileService = clientProfileService;
    }

    /**
     * Retrieves accessibility preferences for a guest installation.
     * If no preferences exist yet, provisions the approved defaults.
     *
     * @param installationId the guest installation UUID
     * @return the accessibility preferences response
     */
    @Transactional
    public AccessibilityPreferenceResponse getPreferences(UUID installationId) {
        ClientProfile profile = clientProfileService.getOrCreateProfile(installationId);

        AccessibilityPreference preference = preferenceRepository.findByClientProfileId(profile.getId())
            .orElseGet(() -> {
                log.info("Creating default accessibility preferences for client profile: {}", profile.getId());
                AccessibilityPreference defaultPref = new AccessibilityPreference(profile);
                return preferenceRepository.save(defaultPref);
            });

        return AccessibilityPreferenceResponse.fromEntity(preference);
    }

    /**
     * Updates accessibility preferences for a guest installation.
     *
     * @param installationId the guest installation UUID
     * @param request the validated preference update request
     * @return the updated accessibility preferences response
     */
    @Transactional
    public AccessibilityPreferenceResponse updatePreferences(UUID installationId, UpdatePreferenceRequest request) {
        ClientProfile profile = clientProfileService.getOrCreateProfile(installationId);

        AccessibilityPreference preference = preferenceRepository.findByClientProfileId(profile.getId())
            .orElseGet(() -> new AccessibilityPreference(profile));

        preference.setSensitivity(request.sensitivity());
        preference.setSmoothing(request.smoothing());
        preference.setDeadZone(request.deadZone());
        preference.setDwellDuration(request.dwellDuration());
        preference.setVerticalGestures(request.verticalGestures());
        preference.setSoundEnabled(request.soundEnabled());
        preference.setTheme(request.theme());
        preference.setReducedMotion(request.reducedMotion());
        preference.setHighContrast(request.highContrast());
        preference.setUpdatedAt(Instant.now());

        AccessibilityPreference saved = preferenceRepository.save(preference);
        log.info("Updated accessibility preferences for client profile: {}", profile.getId());

        return AccessibilityPreferenceResponse.fromEntity(saved);
    }
}

