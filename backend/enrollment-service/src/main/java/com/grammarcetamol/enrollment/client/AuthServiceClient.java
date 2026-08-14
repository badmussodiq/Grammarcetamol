package com.grammarcetamol.enrollment.client;

import com.grammarcetamol.enrollment.config.AppProperties;
import com.grammarcetamol.shared.dto.ApiResponse;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.UUID;

/**
 * Internal-only lookup for "who do we email" — hits auth-service's /api/internal/users/{id},
 * which is unauthenticated but never routed through the gateway (see
 * InternalUserController in auth-service), so it's reachable only from other backend services.
 * Unlike CourseServiceClient, no X-User-Id/X-User-Role headers are needed here since the target
 * endpoint doesn't check them.
 */
@Component
public class AuthServiceClient {

    public record UserContactDto(UUID id, String email, String fullName) {
    }

    private final RestClient restClient;

    public AuthServiceClient(AppProperties appProperties) {
        // Same SimpleClientHttpRequestFactory choice as CourseServiceClient — avoids the
        // Windows loopback-socket issue that java.net.http.HttpClient's NIO selector trips.
        this.restClient = RestClient.builder()
            .baseUrl(appProperties.getAuthServiceUrl())
            .requestFactory(new SimpleClientHttpRequestFactory())
            .build();
    }

    public UserContactDto getUser(UUID userId) {
        try {
            ApiResponse<UserContactDto> response = restClient.get()
                .uri("/api/internal/users/{id}", userId)
                .retrieve()
                .body(new org.springframework.core.ParameterizedTypeReference<>() {});
            if (response == null || response.getData() == null) {
                throw new EntityNotFoundException("User not found: " + userId);
            }
            return response.getData();
        } catch (HttpClientErrorException.NotFound e) {
            throw new EntityNotFoundException("User not found: " + userId);
        }
    }
}
