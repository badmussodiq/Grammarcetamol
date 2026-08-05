package com.grammarcetamol.course.exception;

import lombok.Getter;

import java.util.List;

@Getter
public class CoursePublishValidationException extends RuntimeException {

    private final List<String> errors;

    public CoursePublishValidationException(List<String> errors) {
        super("Course is not ready to publish: " + String.join("; ", errors));
        this.errors = errors;
    }
}
