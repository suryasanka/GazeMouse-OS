package com.gazemouse.backend.service;

import com.gazemouse.backend.dto.AccessibilityPreferenceResponse;
import com.gazemouse.backend.dto.UpdatePreferenceRequest;
import com.gazemouse.backend.entity.AccessibilityPreference;
import com.gazemouse.backend.entity.ClientProfile;
import com.gazemouse.backend.repository.AccessibilityPreferenceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PreferenceServiceTest {

    @Mock
    private AccessibilityPreferenceRepository preferenceRepository;

    @Mock
    private ClientProfileService clientProfileService;

    @InjectMocks
    private PreferenceService preferenceService;

    @Test
    @DisplayName("getPreferences returns mapped response when preferences already exist")
    void getPreferences_ExistingPreferences_ReturnsMappedResponse() {
        UUID installationId = UUID.randomUUID();
        UUID profileId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(profileId);

        AccessibilityPreference existing = new AccessibilityPreference(profile);
        existing.setSensitivity(new BigDecimal("2.50"));
        existing.setSmoothing(new BigDecimal("0.40"));
        existing.setDeadZone(15);
        existing.setDwellDuration(1000);
        existing.setVerticalGestures(true);
        existing.setSoundEnabled(false);
        existing.setTheme("dark");
        existing.setReducedMotion(true);
        existing.setHighContrast(true);
        existing.setUpdatedAt(Instant.parse("2026-10-30T12:00:00Z"));

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(preferenceRepository.findByClientProfileId(profileId)).thenReturn(Optional.of(existing));

        AccessibilityPreferenceResponse response = preferenceService.getPreferences(installationId);

        assertThat(response.sensitivity()).isEqualByComparingTo("2.50");
        assertThat(response.smoothing()).isEqualByComparingTo("0.40");
        assertThat(response.deadZone()).isEqualTo(15);
        assertThat(response.dwellDuration()).isEqualTo(1000);
        assertThat(response.verticalGestures()).isTrue();
        assertThat(response.soundEnabled()).isFalse();
        assertThat(response.theme()).isEqualTo("dark");
        assertThat(response.reducedMotion()).isTrue();
        assertThat(response.highContrast()).isTrue();
        assertThat(response.updatedAt()).isEqualTo(Instant.parse("2026-10-30T12:00:00Z"));

        verify(preferenceRepository, never()).save(any(AccessibilityPreference.class));
    }

    @Test
    @DisplayName("getPreferences creates and saves approved defaults when none exist")
    void getPreferences_NoExistingPreferences_CreatesApprovedDefaults() {
        UUID installationId = UUID.randomUUID();
        UUID profileId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(profileId);

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(preferenceRepository.findByClientProfileId(profileId)).thenReturn(Optional.empty());
        when(preferenceRepository.save(any(AccessibilityPreference.class))).thenAnswer(invocation -> {
            AccessibilityPreference pref = invocation.getArgument(0);
            pref.setUpdatedAt(Instant.now());
            return pref;
        });

        AccessibilityPreferenceResponse response = preferenceService.getPreferences(installationId);

        ArgumentCaptor<AccessibilityPreference> captor = ArgumentCaptor.forClass(AccessibilityPreference.class);
        verify(preferenceRepository).save(captor.capture());
        AccessibilityPreference saved = captor.getValue();

        assertThat(saved.getSensitivity()).isEqualByComparingTo("1.50");
        assertThat(saved.getSmoothing()).isEqualByComparingTo("0.30");
        assertThat(saved.getDeadZone()).isEqualTo(10);
        assertThat(saved.getDwellDuration()).isEqualTo(1200);
        assertThat(saved.getVerticalGestures()).isFalse();
        assertThat(saved.getSoundEnabled()).isTrue();
        assertThat(saved.getTheme()).isEqualTo("light");
        assertThat(saved.getReducedMotion()).isFalse();
        assertThat(saved.getHighContrast()).isFalse();

        assertThat(response.sensitivity()).isEqualByComparingTo("1.50");
        assertThat(response.theme()).isEqualTo("light");
    }

    @Test
    @DisplayName("updatePreferences updates all 9 fields and saves when preferences already exist")
    void updatePreferences_ExistingPreferences_UpdatesAllFieldsAndSaves() {
        UUID installationId = UUID.randomUUID();
        UUID profileId = UUID.randomUUID();
        ClientProfile profile = new ClientProfile(installationId, "WEB");
        profile.setId(profileId);

        AccessibilityPreference existing = new AccessibilityPreference(profile);

        UpdatePreferenceRequest request = new UpdatePreferenceRequest(
            new BigDecimal("2.75"),
            new BigDecimal("0.55"),
            20,
            1800,
            true,
            false,
            "dark",
            true,
            true
        );

        when(clientProfileService.getOrCreateProfile(installationId)).thenReturn(profile);
        when(preferenceRepository.findByClientProfileId(profileId)).thenReturn(Optional.of(existing));
        when(preferenceRepository.save(any(AccessibilityPreference.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AccessibilityPreferenceResponse response = preferenceService.updatePreferences(installationId, request);

        assertThat(response.sensitivity()).isEqualByComparingTo("2.75");
        assertThat(response.smoothing()).isEqualByComparingTo("0.55");
        assertThat(response.deadZone()).isEqualTo(20);
        assertThat(response.dwellDuration()).isEqualTo(1800);
        assertThat(response.verticalGestures()).isTrue();
        assertThat(response.soundEnabled()).isFalse();
        assertThat(response.theme()).isEqualTo("dark");
        assertThat(response.reducedMotion()).isTrue();
        assertThat(response.highContrast()).isTrue();
        assertThat(response.updatedAt()).isNotNull();

        verify(preferenceRepository).save(existing);
    }

    @Test
    @DisplayName("preference isolation: distinct installation IDs resolve to distinct profile IDs")
    void preferenceIsolation_DistinctInstallationIds_RetrieveDistinctPreferences() {
        UUID installationIdA = UUID.randomUUID();
        UUID profileIdA = UUID.randomUUID();
        ClientProfile profileA = new ClientProfile(installationIdA, "WEB");
        profileA.setId(profileIdA);

        UUID installationIdB = UUID.randomUUID();
        UUID profileIdB = UUID.randomUUID();
        ClientProfile profileB = new ClientProfile(installationIdB, "WEB");
        profileB.setId(profileIdB);

        AccessibilityPreference prefA = new AccessibilityPreference(profileA);
        prefA.setTheme("light");
        AccessibilityPreference prefB = new AccessibilityPreference(profileB);
        prefB.setTheme("dark");

        when(clientProfileService.getOrCreateProfile(installationIdA)).thenReturn(profileA);
        when(clientProfileService.getOrCreateProfile(installationIdB)).thenReturn(profileB);
        when(preferenceRepository.findByClientProfileId(profileIdA)).thenReturn(Optional.of(prefA));
        when(preferenceRepository.findByClientProfileId(profileIdB)).thenReturn(Optional.of(prefB));

        AccessibilityPreferenceResponse respA = preferenceService.getPreferences(installationIdA);
        AccessibilityPreferenceResponse respB = preferenceService.getPreferences(installationIdB);

        assertThat(respA.theme()).isEqualTo("light");
        assertThat(respB.theme()).isEqualTo("dark");
    }
}

