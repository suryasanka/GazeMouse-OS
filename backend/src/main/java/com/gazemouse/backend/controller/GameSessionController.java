package com.gazemouse.backend.controller;

import com.gazemouse.backend.dto.CreateGameSessionRequest;
import com.gazemouse.backend.dto.GameSessionResponse;
import com.gazemouse.backend.service.ClientProfileService;
import com.gazemouse.backend.service.GameSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST Controller for recording guest game sessions with idempotency enforcement.
 */
@RestController
@RequestMapping("/api/v1/sessions")
public class GameSessionController {

    private final GameSessionService gameSessionService;
    private final ClientProfileService clientProfileService;

    public GameSessionController(GameSessionService gameSessionService,
                                 ClientProfileService clientProfileService) {
        this.gameSessionService = gameSessionService;
        this.clientProfileService = clientProfileService;
    }

    /**
     * Records a game session for the guest installation identified by X-Installation-Id.
     * Enforces idempotency via the client-generated session UUID.
     *
     * @param installationIdHeader raw X-Installation-Id header value
     * @param request validated session payload
     * @return 201 Created for initial recording, 200 OK for identical replay
     */
    @PostMapping
    public ResponseEntity<GameSessionResponse> recordSession(
            @RequestHeader(value = "X-Installation-Id", required = false) String installationIdHeader,
            @Valid @RequestBody CreateGameSessionRequest request) {
        UUID installationId = clientProfileService.parseAndValidateInstallationId(installationIdHeader);
        GameSessionService.SessionRecordResult result = gameSessionService.recordSession(installationId, request);

        if (result.isCreated()) {
            return ResponseEntity.status(HttpStatus.CREATED).body(result.response());
        } else {
            return ResponseEntity.ok(result.response());
        }
    }
}

