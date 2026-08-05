package com.grammarcetamol.course.repository;

import com.grammarcetamol.course.entity.CourseModule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CourseModuleRepository extends JpaRepository<CourseModule, UUID> {
    List<CourseModule> findByCourseIdOrderByPositionAsc(UUID courseId);
    long countByCourseId(UUID courseId);
}
