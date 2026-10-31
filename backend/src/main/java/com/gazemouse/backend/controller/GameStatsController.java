package com.gazemouse.backend.controller;

import com.gazemouse.backend.dto.GameStatsResponse;
import com.gazemouse.backend.service.ClientProfileService;
import com.gazemouse.backend.service.GameStatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST Controller for retrieving guest game session statistics.
 */
@RestController
@RequestMapping("/api/v1/stats")
public class GameStatsController {

    private final GameStatsService gameStatsService;
    private final ClientProfileService clientProfileService;

    public GameStatsController(GameStatsService gameStatsService,
                               ClientProfileService clientProfileService) {
        this.gameStatsService = gameStatsService;
        this.clientProfileService = clientProfileService;
    }

    /**
     * Retrieves aggregated game session statistics for the guest installation.
     *
     * @param installationIdHeader raw X-Installation-Id header value
     * @param gameId optional game filter identifier (e.g. GAZE_RUNNER, GAZE_MATCH, GAZE_3D_RUNNER)
     * @return 200 OK with aggregated statistics
     */
    @GetMapping
    public ResponseEntity<GameStatsResponse> getStats(
            @RequestHeader(value = "X-Installation-Id", required = false) String installationIdHeader,
            @RequestParam(value = "gameId", required = false) String gameId) {
        UUID installationId = clientProfileService.parseAndValidateInstallationId(installationIdHeader);
        GameStatsResponse response = gameStatsService.getStats(installationId, gameId);
        return ResponseEntity.ok(response);
    }
}

