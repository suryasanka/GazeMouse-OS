package com.gazemouse.backend.controller;

import com.gazemouse.backend.dto.CreateGameSessionRequest;
import com.gazemouse.backend.dto.GameSessionResponse;
import com.gazemouse.backend.exception.GlobalExceptionHandler;
import com.gazemouse.backend.exception.InvalidInstallationIdException;
import com.gazemouse.backend.exception.SessionConflictException;
import com.gazemouse.backend.service.ClientProfileService;
import com.gazemouse.backend.service.GameSessionService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class GameSessionControllerTest {

    private MockMvc mockMvc;

    @Mock
    private GameSessionService gameSessionService;

    @Mock
    private ClientProfileService clientProfileService;

    @InjectMocks
    private GameSessionController gameSessionController;

    private static final String SESSIONS_URL = "/api/v1/sessions";
    private static final String HEADER_INSTALLATION_ID = "X-Installation-Id";

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(gameSessionController)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    private String validRunnerPayload(UUID sessionId) {
        return """
            {
              "id": "%s",
              "gameId": "GAZE_RUNNER",
              "completionStatus": "COMPLETED",
              "score": 450,
              "startedAt": "2026-10-30T10:00:00Z",
              "endedAt": "2026-10-30T10:01:30Z",
              "durationSeconds": 90,
              "coinsCollected": 25,
              "distancePixels": 5400,
              "speedPxPerSec": 60.00
            }
            """.formatted(sessionId);
    }

    @Test
    @DisplayName("POST /api/v1/sessions returns 201 Created on first valid session submission")
    void recordSession_FirstSubmission_Returns201Created() throws Exception {
        UUID installationId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();

        GameSessionResponse sessionResponse = new GameSessionResponse(
            sessionId, "GAZE_RUNNER", null, "COMPLETED", 450,
            Instant.parse("2026-10-30T10:00:00Z"), Instant.parse("2026-10-30T10:01:30Z"), 90,
            25, 5400, new BigDecimal("60.00"), null, null, null, null, null, null, null,
            Instant.now(), Instant.now()
        );

        when(clientProfileService.parseAndValidateInstallationId(installationId.toString()))
            .thenReturn(installationId);
        when(gameSessionService.recordSession(eq(installationId), any(CreateGameSessionRequest.class)))
            .thenReturn(new GameSessionService.SessionRecordResult(sessionResponse, true));

        mockMvc.perform(post(SESSIONS_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRunnerPayload(sessionId))
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id", is(sessionId.toString())))
            .andExpect(jsonPath("$.gameId", is("GAZE_RUNNER")))
            .andExpect(jsonPath("$.score", is(450)))
            .andExpect(jsonPath("$.durationSeconds", is(90)));
    }

    @Test
    @DisplayName("POST /api/v1/sessions returns 200 OK on identical duplicate submission")
    void recordSession_IdenticalReplay_Returns200Ok() throws Exception {
        UUID installationId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();

        GameSessionResponse existingResponse = new GameSessionResponse(
            sessionId, "GAZE_RUNNER", null, "COMPLETED", 450,
            Instant.parse("2026-10-30T10:00:00Z"), Instant.parse("2026-10-30T10:01:30Z"), 90,
            25, 5400, new BigDecimal("60.00"), null, null, null, null, null, null, null,
            Instant.now(), Instant.now()
        );

        when(clientProfileService.parseAndValidateInstallationId(installationId.toString()))
            .thenReturn(installationId);
        when(gameSessionService.recordSession(eq(installationId), any(CreateGameSessionRequest.class)))
            .thenReturn(new GameSessionService.SessionRecordResult(existingResponse, false));

        mockMvc.perform(post(SESSIONS_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRunnerPayload(sessionId))
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id", is(sessionId.toString())))
            .andExpect(jsonPath("$.score", is(450)));
    }

    @Test
    @DisplayName("POST /api/v1/sessions returns 409 Conflict RFC 7807 on conflicting duplicate submission")
    void recordSession_ConflictingDuplicate_Returns409Conflict() throws Exception {
        UUID installationId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();

        when(clientProfileService.parseAndValidateInstallationId(installationId.toString()))
            .thenReturn(installationId);
        when(gameSessionService.recordSession(eq(installationId), any(CreateGameSessionRequest.class)))
            .thenThrow(new SessionConflictException("Session ID " + sessionId + " already exists with a different payload."));

        mockMvc.perform(post(SESSIONS_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRunnerPayload(sessionId))
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.type", is("urn:gazemouse:error:session-conflict")))
            .andExpect(jsonPath("$.title", is("Session Conflict")))
            .andExpect(jsonPath("$.status", is(409)))
            .andExpect(jsonPath("$.detail", notNullValue()));
    }

    @Test
    @DisplayName("POST /api/v1/sessions returns 400 Bad Request RFC 7807 when X-Installation-Id header is missing")
    void recordSession_MissingHeader_Returns400() throws Exception {
        when(clientProfileService.parseAndValidateInstallationId(null))
            .thenThrow(new InvalidInstallationIdException("Header 'X-Installation-Id' is required."));

        mockMvc.perform(post(SESSIONS_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRunnerPayload(UUID.randomUUID()))
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type", is("urn:gazemouse:error:invalid-installation-id")))
            .andExpect(jsonPath("$.status", is(400)));
    }
}

