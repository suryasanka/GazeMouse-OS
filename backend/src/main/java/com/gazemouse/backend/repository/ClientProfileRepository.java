package com.gazemouse.backend.repository;

import com.gazemouse.backend.entity.ClientProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for ClientProfile entity.
 */
@Repository
public interface ClientProfileRepository extends JpaRepository<ClientProfile, UUID> {

    Optional<ClientProfile> findByInstallationId(UUID installationId);

    boolean existsByInstallationId(UUID installationId);
}

