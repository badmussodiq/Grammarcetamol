package com.grammarcetamol.course.dto;

import lombok.Data;

/** Every field is optional — only supplied (non-null) fields are patched onto the lesson. */
@Data
public class UpdateLessonRequest {
    private String title;
    private String description;
    private String type;
    private Integer duration;
    private String videoUrl;
    private Boolean preview;
    private Boolean published;
}
