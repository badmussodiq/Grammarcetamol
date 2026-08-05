package com.grammarcetamol.course.repository;

import com.grammarcetamol.course.entity.CourseVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CourseVersionRepository extends JpaRepository<CourseVersion, UUID> {
    List<CourseVersion> findByCourseIdOrderByVersionDesc(UUID courseId);
    Optional<CourseVersion> findTopByCourseIdOrderByVersionDesc(UUID courseId);
}
