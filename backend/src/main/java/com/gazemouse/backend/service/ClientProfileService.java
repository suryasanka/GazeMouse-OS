package com.gazemouse.backend.service;

import com.gazemouse.backend.entity.ClientProfile;
import com.gazemouse.backend.exception.InvalidInstallationIdException;
import com.gazemouse.backend.repository.ClientProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Service managing anonymous guest client installations.
 */
@Service
public class ClientProfileService {

    private static final Logger log = LoggerFactory.getLogger(ClientProfileService.class);

    private static final Pattern UUID_PATTERN = Pattern.compile(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    );

    private final ClientProfileRepository clientProfileRepository;

    public ClientProfileService(ClientProfileRepository clientProfileRepository) {
        this.clientProfileRepository = clientProfileRepository;
    }

    /**
     * Validates and parses the X-Installation-Id header value into a UUID.
     *
     * @param headerValue the raw HTTP header value
     * @return parsed UUID
     * @throws InvalidInstallationIdException if missing, blank, or malformed
     */
    public UUID parseAndValidateInstallationId(String headerValue) {
        if (headerValue == null || headerValue.isBlank()) {
            throw new InvalidInstallationIdException("Header 'X-Installation-Id' is required.");
        }

        String trimmed = headerValue.trim();
        if (!UUID_PATTERN.matcher(trimmed).matches()) {
            throw new InvalidInstallationIdException(
                "Header 'X-Installation-Id' must be a valid UUID string (e.g. 123e4567-e89b-12d3-a456-426614174000)."
            );
        }

        try {
            return UUID.fromString(trimmed);
        } catch (IllegalArgumentException e) {
            throw new InvalidInstallationIdException("Header 'X-Installation-Id' could not be parsed as a UUID.");
        }
    }

    /**
     * Resolves an existing guest client profile or creates a new one.
     * Prevents duplicate profile creation under concurrent requests.
     *
     * @param installationId the guest installation UUID
     * @return the persistent ClientProfile entity
     */
    @Transactional
    public ClientProfile getOrCreateProfile(UUID installationId) {
        if (installationId == null) {
            throw new InvalidInstallationIdException("Installation ID cannot be null.");
        }

        return clientProfileRepository.findByInstallationId(installationId)
            .orElseGet(() -> createProfileSafely(installationId));
    }

    private ClientProfile createProfileSafely(UUID installationId) {
        try {
            log.info("Provisioning new guest client profile for installation ID: {}", installationId);
            ClientProfile profile = new ClientProfile(installationId, "WEB");
            return clientProfileRepository.save(profile);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent request created profile simultaneously; re-query existing row
            log.debug("Concurrent installation profile creation detected for ID: {}, reloading existing", installationId);
            return clientProfileRepository.findByInstallationId(installationId)
                .orElseThrow(() -> ex);
        }
    }
}

