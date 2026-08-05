package com.grammarcetamol.course.dto;

import com.grammarcetamol.course.entity.Course;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CourseDetailResponse {
    private Course course;
    private List<ModuleResponse> modules;
}
