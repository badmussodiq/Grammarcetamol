package com.grammarcetamol.course.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class ReorderRequest {

    @NotEmpty(message = "orderedIds must not be empty")
    private List<UUID> orderedIds;
}
