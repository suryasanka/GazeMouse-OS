package com.gazemouse.backend.controller;

import com.gazemouse.backend.dto.AccessibilityPreferenceResponse;
import com.gazemouse.backend.dto.UpdatePreferenceRequest;
import com.gazemouse.backend.service.ClientProfileService;
import com.gazemouse.backend.service.PreferenceService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST Controller for managing guest accessibility preferences.
 */
@RestController
@RequestMapping("/api/v1/preferences")
public class PreferenceController {

    private final PreferenceService preferenceService;
    private final ClientProfileService clientProfileService;

    public PreferenceController(PreferenceService preferenceService, ClientProfileService clientProfileService) {
        this.preferenceService = preferenceService;
        this.clientProfileService = clientProfileService;
    }

    /**
     * Retrieves accessibility preferences for the guest installation identified by X-Installation-Id.
     */
    @GetMapping
    public ResponseEntity<AccessibilityPreferenceResponse> getPreferences(
            @RequestHeader(value = "X-Installation-Id", required = false) String installationIdHeader) {
        UUID installationId = clientProfileService.parseAndValidateInstallationId(installationIdHeader);
        AccessibilityPreferenceResponse response = preferenceService.getPreferences(installationId);
        return ResponseEntity.ok(response);
    }

    /**
     * Updates accessibility preferences for the guest installation identified by X-Installation-Id.
     */
    @PutMapping
    public ResponseEntity<AccessibilityPreferenceResponse> updatePreferences(
            @RequestHeader(value = "X-Installation-Id", required = false) String installationIdHeader,
            @Valid @RequestBody UpdatePreferenceRequest request) {
        UUID installationId = clientProfileService.parseAndValidateInstallationId(installationIdHeader);
        AccessibilityPreferenceResponse response = preferenceService.updatePreferences(installationId, request);
        return ResponseEntity.ok(response);
    }
}

