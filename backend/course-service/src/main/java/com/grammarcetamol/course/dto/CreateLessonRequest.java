package com.grammarcetamol.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CreateLessonRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    @Pattern(regexp = "video|text|quiz|resource", message = "Type must be video, text, quiz, or resource")
    private String type = "video";

    private Integer duration;

    private String videoUrl;

    private boolean preview = false;

    private boolean published = true;
}
