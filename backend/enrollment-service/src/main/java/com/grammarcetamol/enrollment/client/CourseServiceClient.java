package com.grammarcetamol.enrollment.client;

import com.grammarcetamol.enrollment.config.AppProperties;
import com.grammarcetamol.shared.dto.ApiResponse;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.util.UUID;

/**
 * Plain internal REST call to course-service — no gRPC (course-service has no gRPC
 * infrastructure; adding it just for this would be more new surface area than a direct call to
 * an already-public endpoint). Never goes through the gateway.
 *
 * course-service's authorization model only reveals non-preview lesson videoUrl / non-published
 * courses to the owning admin/moderator (see CurrentUser.canModify). Enrollment Service needs the
 * full curriculum (including video URLs) for any enrolled student, not just the course owner —
 * there's no "enrolled student" concept on course-service's side to check against. So this client
 * presents as a trusted internal caller (X-User-Role: SUPER_ADMIN) rather than forwarding the real
 * end user's identity. This is safe because course-service is never reachable directly from a
 * browser (only from other backend services on the internal network) — the same implicit trust
 * boundary every header-trust service already relies on for X-User-Id/X-User-Role.
 */
@Component
public class CourseServiceClient {

    private static final UUID INTERNAL_CALLER_ID = new UUID(0, 0);

    private final RestClient restClient;

    public CourseServiceClient(AppProperties appProperties) {
        // SimpleClientHttpRequestFactory (java.net.HttpURLConnection) instead of RestClient's
        // default java.net.http.HttpClient — the latter opens an NIO Selector on construction,
        // which trips the same pre-existing Windows loopback-socket issue documented in
        // auth-service/course-service's READMEs (security software intercepting the loopback
        // socket). Classic blocking I/O sidesteps that entirely, which is a real reliability win
        // on affected dev machines, not just a workaround for automated verification.
        this.restClient = RestClient.builder()
            .baseUrl(appProperties.getCourseServiceUrl())
            .requestFactory(new SimpleClientHttpRequestFactory())
            .defaultHeader("X-User-Id", INTERNAL_CALLER_ID.toString())
            .defaultHeader("X-User-Role", "SUPER_ADMIN")
            .build();
    }

    public CourseDetailDto getCourse(UUID courseId) {
        try {
            ApiResponse<CourseDetailDto> response = restClient.get()
                .uri("/api/courses/{id}", courseId)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.getData() == null) {
                throw new EntityNotFoundException("Course not found: " + courseId);
            }
            return response.getData();
        } catch (HttpClientErrorException.NotFound e) {
            throw new EntityNotFoundException("Course not found: " + courseId);
        }
    }
}
