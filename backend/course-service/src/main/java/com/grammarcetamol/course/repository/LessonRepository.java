package com.grammarcetamol.course.repository;

import com.grammarcetamol.course.entity.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LessonRepository extends JpaRepository<Lesson, UUID> {
    List<Lesson> findByModuleIdOrderByPositionAsc(UUID moduleId);
    List<Lesson> findByModuleIdInOrderByPositionAsc(List<UUID> moduleIds);
    long countByModuleIdIn(List<UUID> moduleIds);
    long countByModuleIdInAndTypeAndVideoUrlIsNull(List<UUID> moduleIds, String type);
}
