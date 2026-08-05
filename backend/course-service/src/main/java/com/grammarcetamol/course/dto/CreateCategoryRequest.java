package com.grammarcetamol.course.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateCategoryRequest {

    @NotBlank(message = "Name is required")
    private String name;

    private String slug;

    private String description;

    private String iconUrl;

    private UUID parentId;

    private int sortOrder = 0;
}
