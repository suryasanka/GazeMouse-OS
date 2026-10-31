package com.gazemouse.backend.repository;

import com.gazemouse.backend.entity.GameSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for GameSession entity.
 */
@Repository
public interface GameSessionRepository extends JpaRepository<GameSession, UUID> {

    List<GameSession> findByClientProfileId(UUID clientProfileId);

    List<GameSession> findByClientProfileIdAndGameId(UUID clientProfileId, String gameId);

    Optional<GameSession> findByIdAndClientProfileId(UUID id, UUID clientProfileId);
}

