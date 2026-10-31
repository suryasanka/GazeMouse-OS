package com.gazemouse.backend.repository;

import com.gazemouse.backend.entity.AccessibilityPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for AccessibilityPreference entity.
 */
@Repository
public interface AccessibilityPreferenceRepository extends JpaRepository<AccessibilityPreference, UUID> {

    Optional<AccessibilityPreference> findByClientProfileId(UUID clientProfileId);
}

