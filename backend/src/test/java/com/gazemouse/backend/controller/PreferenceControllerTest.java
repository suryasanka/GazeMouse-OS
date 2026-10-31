package com.gazemouse.backend.controller;

import com.gazemouse.backend.dto.AccessibilityPreferenceResponse;
import com.gazemouse.backend.dto.UpdatePreferenceRequest;
import com.gazemouse.backend.exception.GlobalExceptionHandler;
import com.gazemouse.backend.exception.InvalidInstallationIdException;
import com.gazemouse.backend.service.ClientProfileService;
import com.gazemouse.backend.service.PreferenceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PreferenceControllerTest {

    private MockMvc mockMvc;

    @Mock
    private PreferenceService preferenceService;

    @Mock
    private ClientProfileService clientProfileService;

    @InjectMocks
    private PreferenceController preferenceController;

    private static final String PREFERENCES_URL = "/api/v1/preferences";
    private static final String HEADER_INSTALLATION_ID = "X-Installation-Id";

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(preferenceController)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    @Test
    @DisplayName("GET /api/v1/preferences returns 200 OK with preferences when header is valid")
    void getPreferences_ValidHeader_ReturnsOk() throws Exception {
        UUID installationId = UUID.randomUUID();
        AccessibilityPreferenceResponse expectedResponse = new AccessibilityPreferenceResponse(
            new BigDecimal("1.50"),
            new BigDecimal("0.30"),
            10,
            1200,
            false,
            true,
            "light",
            false,
            false,
            Instant.parse("2026-10-30T12:00:00Z")
        );

        when(clientProfileService.parseAndValidateInstallationId(installationId.toString()))
            .thenReturn(installationId);
        when(preferenceService.getPreferences(installationId))
            .thenReturn(expectedResponse);

        mockMvc.perform(get(PREFERENCES_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.sensitivity", is(1.50)))
            .andExpect(jsonPath("$.smoothing", is(0.30)))
            .andExpect(jsonPath("$.deadZone", is(10)))
            .andExpect(jsonPath("$.dwellDuration", is(1200)))
            .andExpect(jsonPath("$.verticalGestures", is(false)))
            .andExpect(jsonPath("$.soundEnabled", is(true)))
            .andExpect(jsonPath("$.theme", is("light")))
            .andExpect(jsonPath("$.reducedMotion", is(false)))
            .andExpect(jsonPath("$.highContrast", is(false)))
            .andExpect(jsonPath("$.updatedAt", is("2026-10-30T12:00:00Z")));
    }

    @Test
    @DisplayName("GET /api/v1/preferences returns 400 Bad Request RFC 7807 when header is missing")
    void getPreferences_MissingHeader_Returns400() throws Exception {
        when(clientProfileService.parseAndValidateInstallationId(null))
            .thenThrow(new InvalidInstallationIdException("Header 'X-Installation-Id' is required."));

        mockMvc.perform(get(PREFERENCES_URL)
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type", is("urn:gazemouse:error:invalid-installation-id")))
            .andExpect(jsonPath("$.title", is("Invalid Installation ID")))
            .andExpect(jsonPath("$.status", is(400)))
            .andExpect(jsonPath("$.detail", is("Header 'X-Installation-Id' is required.")))
            .andExpect(jsonPath("$.instance", is(PREFERENCES_URL)))
            .andExpect(jsonPath("$.timestamp", notNullValue()));
    }

    @Test
    @DisplayName("GET /api/v1/preferences returns 400 Bad Request RFC 7807 when header is malformed")
    void getPreferences_MalformedHeader_Returns400() throws Exception {
        String malformedHeader = "not-a-valid-uuid";
        when(clientProfileService.parseAndValidateInstallationId(malformedHeader))
            .thenThrow(new InvalidInstallationIdException("Header 'X-Installation-Id' must be a valid UUID string."));

        mockMvc.perform(get(PREFERENCES_URL)
                .header(HEADER_INSTALLATION_ID, malformedHeader)
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type", is("urn:gazemouse:error:invalid-installation-id")))
            .andExpect(jsonPath("$.title", is("Invalid Installation ID")))
            .andExpect(jsonPath("$.status", is(400)))
            .andExpect(jsonPath("$.detail", is("Header 'X-Installation-Id' must be a valid UUID string.")));
    }

    @Test
    @DisplayName("PUT /api/v1/preferences returns 200 OK with updated preferences when request is valid")
    void updatePreferences_ValidRequest_ReturnsOk() throws Exception {
        UUID installationId = UUID.randomUUID();
        AccessibilityPreferenceResponse updatedResponse = new AccessibilityPreferenceResponse(
            new BigDecimal("2.25"),
            new BigDecimal("0.45"),
            15,
            1500,
            true,
            false,
            "dark",
            true,
            true,
            Instant.parse("2026-10-30T14:30:00Z")
        );

        when(clientProfileService.parseAndValidateInstallationId(installationId.toString()))
            .thenReturn(installationId);
        when(preferenceService.updatePreferences(eq(installationId), any(UpdatePreferenceRequest.class)))
            .thenReturn(updatedResponse);

        String requestJson = """
            {
              "sensitivity": 2.25,
              "smoothing": 0.45,
              "deadZone": 15,
              "dwellDuration": 1500,
              "verticalGestures": true,
              "soundEnabled": false,
              "theme": "dark",
              "reducedMotion": true,
              "highContrast": true
            }
            """;

        mockMvc.perform(put(PREFERENCES_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson)
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sensitivity", is(2.25)))
            .andExpect(jsonPath("$.smoothing", is(0.45)))
            .andExpect(jsonPath("$.deadZone", is(15)))
            .andExpect(jsonPath("$.dwellDuration", is(1500)))
            .andExpect(jsonPath("$.verticalGestures", is(true)))
            .andExpect(jsonPath("$.soundEnabled", is(false)))
            .andExpect(jsonPath("$.theme", is("dark")))
            .andExpect(jsonPath("$.reducedMotion", is(true)))
            .andExpect(jsonPath("$.highContrast", is(true)))
            .andExpect(jsonPath("$.updatedAt", is("2026-10-30T14:30:00Z")));
    }

    @Test
    @DisplayName("PUT /api/v1/preferences returns 400 Bad Request when sensitivity is out of bounds")
    void updatePreferences_InvalidSensitivity_Returns400Validation() throws Exception {
        UUID installationId = UUID.randomUUID();

        String requestJson = """
            {
              "sensitivity": 0.50,
              "smoothing": 0.45,
              "deadZone": 15,
              "dwellDuration": 1500,
              "verticalGestures": true,
              "soundEnabled": false,
              "theme": "dark",
              "reducedMotion": true,
              "highContrast": true
            }
            """;

        mockMvc.perform(put(PREFERENCES_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson)
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type", is("urn:gazemouse:error:validation")))
            .andExpect(jsonPath("$.title", is("Validation Failed")))
            .andExpect(jsonPath("$.status", is(400)))
            .andExpect(jsonPath("$.errors.sensitivity", notNullValue()));
    }

    @Test
    @DisplayName("PUT /api/v1/preferences returns 400 Bad Request when theme is not 'light' or 'dark'")
    void updatePreferences_InvalidTheme_Returns400Validation() throws Exception {
        UUID installationId = UUID.randomUUID();

        String requestJson = """
            {
              "sensitivity": 1.50,
              "smoothing": 0.30,
              "deadZone": 10,
              "dwellDuration": 1200,
              "verticalGestures": false,
              "soundEnabled": true,
              "theme": "high-contrast-neon",
              "reducedMotion": false,
              "highContrast": false
            }
            """;

        mockMvc.perform(put(PREFERENCES_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson)
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type", is("urn:gazemouse:error:validation")))
            .andExpect(jsonPath("$.errors.theme", is("theme must be 'light' or 'dark'")));
    }

    @Test
    @DisplayName("PUT /api/v1/preferences returns 400 Bad Request when JSON body is malformed")
    void updatePreferences_MalformedJson_Returns400() throws Exception {
        UUID installationId = UUID.randomUUID();

        String malformedJson = "{ \"sensitivity\": 1.50, \"smoothing\": ";

        mockMvc.perform(put(PREFERENCES_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(malformedJson)
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type", is("urn:gazemouse:error:malformed-request")))
            .andExpect(jsonPath("$.title", is("Malformed Request Body")))
            .andExpect(jsonPath("$.status", is(400)));
    }
}

