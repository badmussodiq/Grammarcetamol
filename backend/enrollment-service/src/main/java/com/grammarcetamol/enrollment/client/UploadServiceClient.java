package com.grammarcetamol.enrollment.client;

import com.grammarcetamol.enrollment.config.AppProperties;
import com.grammarcetamol.shared.dto.ApiResponse;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.UUID;

/**
 * Resolves a lesson's uploaded file (upload_files.id, stored on course-service's Lesson as
 * uploadFileId) into a short-lived signed playback/download URL — same internal-caller
 * convention as CourseServiceClient (X-User-Role: SUPER_ADMIN, never through the gateway,
 * SimpleClientHttpRequestFactory to sidestep the Windows loopback-socket issue).
 *
 * This is the actual enforcement point for "never trust the frontend" on lesson content: a
 * signed URL is only ever minted here, after getLearnState has already confirmed the caller is
 * really enrolled and the lesson isn't locked. upload-service itself has no concept of
 * enrollment — it just signs whatever a trusted internal caller asks for.
 */
@Component
public class UploadServiceClient {

    private static final UUID INTERNAL_CALLER_ID = new UUID(0, 0);

    private final RestClient restClient;

    public UploadServiceClient(AppProperties appProperties) {
        this.restClient = RestClient.builder()
            .baseUrl(appProperties.getUploadServiceUrl())
            .requestFactory(new SimpleClientHttpRequestFactory())
            .defaultHeader("X-User-Id", INTERNAL_CALLER_ID.toString())
            .defaultHeader("X-User-Role", "SUPER_ADMIN")
            .build();
    }

    /** Null if the file can't be resolved right now (still uploading, deleted, upload-service
     * unreachable) — callers treat that as "no playable content" rather than failing the whole
     * lesson response over a transient signing problem. */
    public String getDownloadUrl(UUID uploadFileId) {
        try {
            ApiResponse<Map<String, Object>> response = restClient.get()
                .uri("/api/uploads/files/{id}/download-url", uploadFileId)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.getData() == null) {
                return null;
            }
            Object url = response.getData().get("url");
            return url != null ? url.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
