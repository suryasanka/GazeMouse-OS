package com.gazemouse.backend.service;

import com.gazemouse.backend.dto.CreateGameSessionRequest;
import com.gazemouse.backend.dto.GameSessionResponse;
import com.gazemouse.backend.entity.ClientProfile;
import com.gazemouse.backend.entity.GameSession;
import com.gazemouse.backend.exception.SessionConflictException;
import com.gazemouse.backend.repository.GameSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Service managing game session recording and idempotency enforcement.
 */
@Service
public class GameSessionService {

    private static final Logger log = LoggerFactory.getLogger(GameSessionService.class);

    private final GameSessionRepository gameSessionRepository;
    private final ClientProfileService clientProfileService;
    private final GameSessionValidator gameSessionValidator;

    public GameSessionService(GameSessionRepository gameSessionRepository,
                              ClientProfileService clientProfileService,
                              GameSessionValidator gameSessionValidator) {
        this.gameSessionRepository = gameSessionRepository;
        this.clientProfileService = clientProfileService;
        this.gameSessionValidator = gameSessionValidator;
    }

    public record SessionRecordResult(GameSessionResponse response, boolean isCreated) {
    }

    /**
     * Records a game session idempotently.
     *
     * @param installationId guest client installation UUID
     * @param request validated session request payload
     * @return result indicating if created or replayed, along with session response
     */
    @Transactional
    public SessionRecordResult recordSession(UUID installationId, CreateGameSessionRequest request) {
        gameSessionValidator.validate(request);
        ClientProfile profile = clientProfileService.getOrCreateProfile(installationId);

        Optional<GameSession> existingOpt = gameSessionRepository.findById(request.id());

        if (existingOpt.isPresent()) {
            GameSession existing = existingOpt.get();

            // Check guest isolation: session must belong to the caller's installation
            if (!existing.getClientProfile().getId().equals(profile.getId())) {
                log.warn("Session ID {} conflict: belongs to different profile ID {}", request.id(), existing.getClientProfile().getId());
                throw new SessionConflictException("Session ID conflicts with an existing session from another installation.");
            }

            // Check payload idempotency
            if (isPayloadIdentical(existing, request)) {
                log.info("Idempotent duplicate submission for session ID: {}", request.id());
                return new SessionRecordResult(GameSessionResponse.fromEntity(existing), false);
            } else {
                log.warn("Payload conflict for session ID {}: existing session has different values", request.id());
                throw new SessionConflictException("Session ID " + request.id() + " already exists with a different payload.");
            }
        }

        GameSession entity = mapToEntity(profile, request);

        try {
            GameSession saved = gameSessionRepository.save(entity);
            log.info("Recorded new game session: {} for profile: {}", saved.getId(), profile.getId());
            return new SessionRecordResult(GameSessionResponse.fromEntity(saved), true);
        } catch (DataIntegrityViolationException ex) {
            log.debug("Concurrent session insertion detected for ID: {}", request.id());
            GameSession concurrent = gameSessionRepository.findById(request.id())
                .orElseThrow(() -> ex);

            if (concurrent.getClientProfile().getId().equals(profile.getId()) && isPayloadIdentical(concurrent, request)) {
                return new SessionRecordResult(GameSessionResponse.fromEntity(concurrent), false);
            } else {
                throw new SessionConflictException("Session ID " + request.id() + " already exists with a different payload or installation.");
            }
        }
    }

    private GameSession mapToEntity(ClientProfile profile, CreateGameSessionRequest request) {
        GameSession session = new GameSession();
        session.setId(request.id());
        session.setClientProfile(profile);
        session.setGameId(request.gameId());
        session.setGameMode(request.gameMode());
        session.setCompletionStatus(request.completionStatus());
        session.setScore(request.score());
        session.setStartedAt(request.startedAt());
        session.setEndedAt(request.endedAt());
        session.setDurationSeconds(request.durationSeconds());

        session.setCoinsCollected(request.coinsCollected());
        session.setDistancePixels(request.distancePixels());
        session.setSpeedPxPerSec(request.speedPxPerSec());
        session.setDistanceMeters(request.distanceMeters());
        session.setSpeedMPerSec(request.speedMPerSec());
        session.setMovesMade(request.movesMade());
        session.setMovesRemaining(request.movesRemaining());
        session.setMatchesCount(request.matchesCount());
        session.setTargetScore(request.targetScore());
        session.setIsWin(request.isWin());

        Instant now = Instant.now();
        session.setCreatedAt(now);
        session.setRecordedAt(now);

        return session;
    }

    private boolean isPayloadIdentical(GameSession existing, CreateGameSessionRequest request) {
        if (!Objects.equals(existing.getGameId(), request.gameId())) return false;
        if (!Objects.equals(existing.getGameMode(), request.gameMode())) return false;
        if (!Objects.equals(existing.getCompletionStatus(), request.completionStatus())) return false;
        if (!Objects.equals(existing.getScore(), request.score())) return false;
        if (!Objects.equals(existing.getStartedAt(), request.startedAt())) return false;
        if (!Objects.equals(existing.getEndedAt(), request.endedAt())) return false;
        if (!Objects.equals(existing.getDurationSeconds(), request.durationSeconds())) return false;
        if (!Objects.equals(existing.getCoinsCollected(), request.coinsCollected())) return false;
        if (!Objects.equals(existing.getDistancePixels(), request.distancePixels())) return false;
        if (!bigDecimalEquals(existing.getSpeedPxPerSec(), request.speedPxPerSec())) return false;
        if (!bigDecimalEquals(existing.getDistanceMeters(), request.distanceMeters())) return false;
        if (!bigDecimalEquals(existing.getSpeedMPerSec(), request.speedMPerSec())) return false;
        if (!Objects.equals(existing.getMovesMade(), request.movesMade())) return false;
        if (!Objects.equals(existing.getMovesRemaining(), request.movesRemaining())) return false;
        if (!Objects.equals(existing.getMatchesCount(), request.matchesCount())) return false;
        if (!Objects.equals(existing.getTargetScore(), request.targetScore())) return false;
        return Objects.equals(existing.getIsWin(), request.isWin());
    }

    private boolean bigDecimalEquals(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.compareTo(b) == 0;
    }
}

