package com.grammarcetamol.enrollment.dto;

import java.util.List;
import java.util.UUID;

public record LearnResponse(UUID courseId, String courseTitle, int completionPct, List<LearnModule> modules) {

    public record LearnModule(UUID id, String title, int position, List<LearnLesson> lessons) {
    }

    /** state is one of: locked | unlocked | current | completed */
    public record LearnLesson(UUID id, String title, String type, Integer duration, int position,
                               String videoUrl, String state, int watchPosition) {
    }
}
