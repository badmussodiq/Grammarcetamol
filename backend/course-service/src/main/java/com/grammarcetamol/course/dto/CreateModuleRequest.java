package com.grammarcetamol.course.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateModuleRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;
}
