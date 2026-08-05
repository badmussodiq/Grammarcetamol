package com.grammarcetamol.review.client;

import com.grammarcetamol.review.config.AppProperties;
import com.grammarcetamol.shared.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.UUID;

/**
 * Plain internal REST call to enrollment-service — same "trusted internal caller" convention as
 * enrollment-service's own CourseServiceClient (see that class's doc comment for the full
 * rationale). Presents X-User-Role: SUPER_ADMIN so enrollment-service's own auth check
 * (isAdminOrModerator() || id == the target userId) lets this service check ANY user's
 * completion, not just its own — necessary since it's checking the reviewer's completion, not
 * review-service's own identity. Uses SimpleClientHttpRequestFactory (classic HttpURLConnection),
 * not the JDK HttpClient-based default, for the same Windows loopback-socket reason documented in
 * enrollment-service's CourseServiceClient.
 */
@Component
@RequiredArgsConstructor
public class EnrollmentServiceClient {

    private static final UUID INTERNAL_CALLER_ID = new UUID(0, 0);

    private final AppProperties appProperties;

    private RestClient client() {
        return RestClient.builder()
            .baseUrl(appProperties.getEnrollmentServiceUrl())
            .requestFactory(new SimpleClientHttpRequestFactory())
            .defaultHeader("X-User-Id", INTERNAL_CALLER_ID.toString())
            .defaultHeader("X-User-Role", "SUPER_ADMIN")
            .build();
    }

    public CompletionDto getCompletion(UUID userId, UUID courseId) {
        ApiResponse<CompletionDto> response = client().get()
            .uri("/api/enrollments/completion?userId={userId}&courseId={courseId}", userId, courseId)
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});
        if (response == null || response.getData() == null) {
            return new CompletionDto(false, 0, null);
        }
        return response.getData();
    }
}
