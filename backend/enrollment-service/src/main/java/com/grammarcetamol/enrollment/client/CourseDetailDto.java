package com.grammarcetamol.enrollment.client;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Local mirror of course-service's JSON response shape for GET /api/courses/{id} — deliberately
 * not shared classes between the two services (different Maven modules, no cross-service DTO
 * coupling). Jackson ignores the many Course fields not listed here (Spring Boot's default
 * ObjectMapper doesn't fail on unknown properties).
 */
public record CourseDetailDto(CourseSummary course, List<ModuleSummary> modules) {

    public record CourseSummary(UUID id, String title, String slug, String status, BigDecimal price) {
    }

    public record ModuleSummary(UUID id, String title, int position, List<LessonSummary> lessons) {
    }

    public record LessonSummary(UUID id, String title, String description, String type, Integer duration, int position,
                                 String videoUrl, UUID uploadFileId, boolean allowDownload, boolean preview, boolean published) {
    }
}
