package com.grammarcetamol.auth.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
public class UpdateProfileRequest {

    @Size(max = 255)
    private String fullName;

    @Size(max = 30)
    private String phone;

    @Size(max = 100)
    private String country;

    @Size(max = 100)
    private String timezone;

    private String bio;

    private List<String> learningGoals;

    @Size(max = 512)
    private String avatarUrl;

    private LocalDate dateOfBirth;

    private Map<String, Object> preferences;
}
