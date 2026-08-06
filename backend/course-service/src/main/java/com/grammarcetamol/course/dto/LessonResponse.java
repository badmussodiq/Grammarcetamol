package com.grammarcetamol.course.dto;

import com.grammarcetamol.course.entity.Lesson;
import lombok.Data;

import java.util.UUID;

/**
 * Detached copy of a Lesson for API responses — never the managed JPA entity, so nulling
 * videoUrl for locked lessons here can never accidentally flush back to the database.
 */
@Data
public class LessonResponse {
    private UUID id;
    private String title;
    private String description;
    private String type;
    private Integer duration;
    private int position;
    private String videoUrl;
    private UUID uploadFileId;
    private boolean allowDownload;
    private boolean preview;
    private boolean published;

    public static LessonResponse from(Lesson lesson, boolean includeVideoUrl) {
        LessonResponse dto = new LessonResponse();
        dto.setId(lesson.getId());
        dto.setTitle(lesson.getTitle());
        dto.setDescription(lesson.getDescription());
        dto.setType(lesson.getType());
        dto.setDuration(lesson.getDuration());
        dto.setPosition(lesson.getPosition());
        dto.setVideoUrl(includeVideoUrl ? lesson.getVideoUrl() : null);
        // Same gating as videoUrl — an unresolved file reference is just as much "the actual
        // lesson content" as a plain video_url would be, for a non-preview lesson viewed by a
        // non-owner/non-admin.
        dto.setUploadFileId(includeVideoUrl ? lesson.getUploadFileId() : null);
        dto.setAllowDownload(lesson.isAllowDownload());
        dto.setPreview(lesson.isPreview());
        dto.setPublished(lesson.isPublished());
        return dto;
    }
}
