package com.gazemouse.backend.controller;

import com.gazemouse.backend.dto.GameStatsResponse;
import com.gazemouse.backend.dto.GazeRunnerStats;
import com.gazemouse.backend.exception.GlobalExceptionHandler;
import com.gazemouse.backend.exception.InvalidInstallationIdException;
import com.gazemouse.backend.exception.InvalidSessionException;
import com.gazemouse.backend.service.ClientProfileService;
import com.gazemouse.backend.service.GameStatsService;
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
import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class GameStatsControllerTest {

    private MockMvc mockMvc;

    @Mock
    private GameStatsService gameStatsService;

    @Mock
    private ClientProfileService clientProfileService;

    @InjectMocks
    private GameStatsController gameStatsController;

    private static final String STATS_URL = "/api/v1/stats";
    private static final String HEADER_INSTALLATION_ID = "X-Installation-Id";

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(gameStatsController)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    @Test
    @DisplayName("GET /api/v1/stats returns 200 OK with overall statistics when header is valid")
    void getStats_ValidHeaderNoParam_Returns200Ok() throws Exception {
        UUID installationId = UUID.randomUUID();
        GameStatsResponse response = new GameStatsResponse(
            null,
            5,
            4,
            1,
            0,
            450L,
            750,
            420.5,
            new GazeRunnerStats(65, 8400, new BigDecimal("65.00")),
            null,
            null
        );

        when(clientProfileService.parseAndValidateInstallationId(installationId.toString()))
            .thenReturn(installationId);
        when(gameStatsService.getStats(installationId, null))
            .thenReturn(response);

        mockMvc.perform(get(STATS_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.gameId", nullValue()))
            .andExpect(jsonPath("$.totalSessions", is(5)))
            .andExpect(jsonPath("$.completedSessions", is(4)))
            .andExpect(jsonPath("$.abandonedSessions", is(1)))
            .andExpect(jsonPath("$.interruptedSessions", is(0)))
            .andExpect(jsonPath("$.totalPlayTimeSeconds", is(450)))
            .andExpect(jsonPath("$.highScore", is(750)))
            .andExpect(jsonPath("$.averageScore", is(420.5)))
            .andExpect(jsonPath("$.gazeRunner.totalCoinsCollected", is(65)));
    }

    @Test
    @DisplayName("GET /api/v1/stats?gameId=GAZE_RUNNER returns 200 OK with filtered statistics")
    void getStats_FilterByGameId_Returns200Ok() throws Exception {
        UUID installationId = UUID.randomUUID();
        GameStatsResponse response = new GameStatsResponse(
            "GAZE_RUNNER",
            3,
            3,
            0,
            0,
            300L,
            850,
            600.0,
            new GazeRunnerStats(80, 10500, new BigDecimal("70.00")),
            null,
            null
        );

        when(clientProfileService.parseAndValidateInstallationId(installationId.toString()))
            .thenReturn(installationId);
        when(gameStatsService.getStats(installationId, "GAZE_RUNNER"))
            .thenReturn(response);

        mockMvc.perform(get(STATS_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .param("gameId", "GAZE_RUNNER")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.gameId", is("GAZE_RUNNER")))
            .andExpect(jsonPath("$.totalSessions", is(3)))
            .andExpect(jsonPath("$.highScore", is(850)))
            .andExpect(jsonPath("$.gazeRunner.totalCoinsCollected", is(80)));
    }

    @Test
    @DisplayName("GET /api/v1/stats?gameId=INVALID returns 400 Bad Request RFC 7807")
    void getStats_InvalidGameId_Returns400() throws Exception {
        UUID installationId = UUID.randomUUID();

        when(clientProfileService.parseAndValidateInstallationId(installationId.toString()))
            .thenReturn(installationId);
        when(gameStatsService.getStats(installationId, "INVALID_GAME"))
            .thenThrow(new InvalidSessionException("Invalid gameId 'INVALID_GAME'."));

        mockMvc.perform(get(STATS_URL)
                .header(HEADER_INSTALLATION_ID, installationId.toString())
                .param("gameId", "INVALID_GAME")
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type", is("urn:gazemouse:error:invalid-session")))
            .andExpect(jsonPath("$.status", is(400)))
            .andExpect(jsonPath("$.detail", is("Invalid gameId 'INVALID_GAME'.")));
    }

    @Test
    @DisplayName("GET /api/v1/stats returns 400 Bad Request when X-Installation-Id is missing")
    void getStats_MissingHeader_Returns400() throws Exception {
        when(clientProfileService.parseAndValidateInstallationId(null))
            .thenThrow(new InvalidInstallationIdException("Header 'X-Installation-Id' is required."));

        mockMvc.perform(get(STATS_URL)
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type", is("urn:gazemouse:error:invalid-installation-id")))
            .andExpect(jsonPath("$.status", is(400)));
    }
}

