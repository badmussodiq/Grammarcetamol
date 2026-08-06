package com.grammarcetamol.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateLessonRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    @Pattern(regexp = "video|text|quiz|resource", message = "Type must be video, text, quiz, or resource")
    private String type = "video";

    private Integer duration;

    private String videoUrl;

    /** upload-service's upload_files.id, once a file has been uploaded through the chunked
     * upload pipeline and attached to this lesson. */
    private UUID uploadFileId;

    private boolean allowDownload = false;

    private boolean preview = false;

    private boolean published = true;
}
