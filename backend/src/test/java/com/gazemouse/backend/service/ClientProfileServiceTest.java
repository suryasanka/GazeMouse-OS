package com.gazemouse.backend.service;

import com.gazemouse.backend.entity.ClientProfile;
import com.gazemouse.backend.exception.InvalidInstallationIdException;
import com.gazemouse.backend.repository.ClientProfileRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientProfileServiceTest {

    @Mock
    private ClientProfileRepository clientProfileRepository;

    @InjectMocks
    private ClientProfileService clientProfileService;

    @Test
    @DisplayName("parseAndValidateInstallationId returns UUID when given valid canonical UUID string")
    void parseAndValidateInstallationId_ValidUuid_ReturnsUuid() {
        UUID expected = UUID.randomUUID();
        UUID actual = clientProfileService.parseAndValidateInstallationId(expected.toString());

        assertThat(actual).isEqualTo(expected);
    }

    @Test
    @DisplayName("parseAndValidateInstallationId trims whitespace around valid UUID string")
    void parseAndValidateInstallationId_WhitespaceAroundUuid_ReturnsUuid() {
        UUID expected = UUID.randomUUID();
        UUID actual = clientProfileService.parseAndValidateInstallationId("  " + expected + "  ");

        assertThat(actual).isEqualTo(expected);
    }

    @Test
    @DisplayName("parseAndValidateInstallationId throws InvalidInstallationIdException when header is null")
    void parseAndValidateInstallationId_NullHeader_ThrowsException() {
        assertThatThrownBy(() -> clientProfileService.parseAndValidateInstallationId(null))
            .isInstanceOf(InvalidInstallationIdException.class)
            .hasMessageContaining("Header 'X-Installation-Id' is required.");
    }

    @Test
    @DisplayName("parseAndValidateInstallationId throws InvalidInstallationIdException when header is blank")
    void parseAndValidateInstallationId_BlankHeader_ThrowsException() {
        assertThatThrownBy(() -> clientProfileService.parseAndValidateInstallationId("   "))
            .isInstanceOf(InvalidInstallationIdException.class)
            .hasMessageContaining("Header 'X-Installation-Id' is required.");
    }

    @Test
    @DisplayName("parseAndValidateInstallationId throws InvalidInstallationIdException when header is malformed")
    void parseAndValidateInstallationId_MalformedHeader_ThrowsException() {
        assertThatThrownBy(() -> clientProfileService.parseAndValidateInstallationId("not-a-valid-uuid"))
            .isInstanceOf(InvalidInstallationIdException.class)
            .hasMessageContaining("must be a valid UUID string");

        assertThatThrownBy(() -> clientProfileService.parseAndValidateInstallationId("12345"))
            .isInstanceOf(InvalidInstallationIdException.class)
            .hasMessageContaining("must be a valid UUID string");
    }

    @Test
    @DisplayName("getOrCreateProfile returns existing profile when already stored")
    void getOrCreateProfile_ExistingProfile_ReturnsExisting() {
        UUID installationId = UUID.randomUUID();
        ClientProfile existingProfile = new ClientProfile(installationId, "WEB");
        existingProfile.setId(UUID.randomUUID());

        when(clientProfileRepository.findByInstallationId(installationId))
            .thenReturn(Optional.of(existingProfile));

        ClientProfile result = clientProfileService.getOrCreateProfile(installationId);

        assertThat(result).isSameAs(existingProfile);
        verify(clientProfileRepository, never()).save(any(ClientProfile.class));
    }

    @Test
    @DisplayName("getOrCreateProfile saves and returns new profile when not found")
    void getOrCreateProfile_NewProfile_SavesAndReturns() {
        UUID installationId = UUID.randomUUID();
        ClientProfile createdProfile = new ClientProfile(installationId, "WEB");
        createdProfile.setId(UUID.randomUUID());

        when(clientProfileRepository.findByInstallationId(installationId))
            .thenReturn(Optional.empty());
        when(clientProfileRepository.save(any(ClientProfile.class)))
            .thenReturn(createdProfile);

        ClientProfile result = clientProfileService.getOrCreateProfile(installationId);

        assertThat(result).isSameAs(createdProfile);
        verify(clientProfileRepository).save(any(ClientProfile.class));
    }

    @Test
    @DisplayName("getOrCreateProfile gracefully recovers from DataIntegrityViolationException on concurrent insert")
    void getOrCreateProfile_ConcurrentRace_RecoversExisting() {
        UUID installationId = UUID.randomUUID();
        ClientProfile concurrentlyCreated = new ClientProfile(installationId, "WEB");
        concurrentlyCreated.setId(UUID.randomUUID());

        // First find returns empty, then save throws DataIntegrityViolationException, second find returns created
        when(clientProfileRepository.findByInstallationId(installationId))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(concurrentlyCreated));
        when(clientProfileRepository.save(any(ClientProfile.class)))
            .thenThrow(new DataIntegrityViolationException("duplicate key value violates unique constraint"));

        ClientProfile result = clientProfileService.getOrCreateProfile(installationId);

        assertThat(result).isSameAs(concurrentlyCreated);
    }

    @Test
    @DisplayName("getOrCreateProfile throws exception when installationId is null")
    void getOrCreateProfile_NullId_ThrowsException() {
        assertThatThrownBy(() -> clientProfileService.getOrCreateProfile(null))
            .isInstanceOf(InvalidInstallationIdException.class)
            .hasMessageContaining("Installation ID cannot be null");
    }
}

