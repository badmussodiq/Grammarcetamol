package com.grammarcetamol.enrollment.repository;

import com.grammarcetamol.enrollment.entity.Enrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EnrollmentRepository extends JpaRepository<Enrollment, UUID> {

    Optional<Enrollment> findByUserIdAndCourseId(UUID userId, UUID courseId);

    List<Enrollment> findByUserIdOrderByEnrolledAtDesc(UUID userId);

    List<Enrollment> findByStatusAndEnrolledAtBefore(String status, Instant cutoff);

    /** Task 40 (Phase 4): backs Announcements' targetType='courses' recipient fan-out in
     * notification-service — distinct enrolled userIds for a set of courseIds, active
     * enrollments only. */
    @Query("SELECT DISTINCT e.userId FROM Enrollment e WHERE e.courseId IN :courseIds AND e.status = 'active'")
    List<UUID> findDistinctUserIdsByCourseIdInAndStatusActive(@Param("courseIds") List<UUID> courseIds);
}
