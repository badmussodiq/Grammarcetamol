package com.grammarcetamol.review.repository;

import com.grammarcetamol.review.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    Optional<Review> findByUserIdAndCourseId(UUID userId, UUID courseId);

    Page<Review> findByCourseIdAndStatus(UUID courseId, String status, Pageable pageable);

    /** Admin listing — every filter is optional (null = "any"). */
    @Query("""
        SELECT r FROM Review r
        WHERE (:status IS NULL OR r.status = :status)
          AND (:courseId IS NULL OR r.courseId = :courseId)
          AND (:rating IS NULL OR r.rating = :rating)
        """)
    Page<Review> search(@Param("status") String status, @Param("courseId") UUID courseId,
                         @Param("rating") Integer rating, Pageable pageable);
}
