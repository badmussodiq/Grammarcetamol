package com.grammarcetamol.course.dto;

import lombok.Data;

@Data
public class UpdateModuleRequest {
    private String title;
    private String description;
    private Boolean published;
}
