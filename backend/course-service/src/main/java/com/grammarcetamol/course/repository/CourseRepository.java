package com.grammarcetamol.course.repository;

import com.grammarcetamol.course.entity.Course;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CourseRepository extends JpaRepository<Course, UUID> {

    Optional<Course> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Course> findTop6ByStatusOrderByEnrollmentCountDesc(String status);

    /**
     * Public catalog search: all filters are optional (pass null to skip). Sort is one of
     * newest|price_low|price_high|rating|popular, applied via CASE so a single native query
     * with Pageable-driven paging covers every combination without building SQL from client input.
     */
    @Query(value = """
        SELECT * FROM courses c
        WHERE (:status IS NULL OR c.status = :status)
          AND (:categoryId IS NULL OR c.category_id = :categoryId)
          AND (:difficulty IS NULL OR c.difficulty = :difficulty)
          AND (:priceFilter IS NULL
               OR (:priceFilter = 'free' AND c.price = 0)
               OR (:priceFilter = 'paid' AND c.price > 0))
          AND (:search IS NULL OR to_tsvector('english', c.title || ' ' || coalesce(c.subtitle,'') || ' ' || coalesce(c.description,''))
               @@ plainto_tsquery('english', :search))
        ORDER BY
          CASE WHEN :sort = 'price_low' THEN c.price END ASC NULLS LAST,
          CASE WHEN :sort = 'price_high' THEN c.price END DESC NULLS LAST,
          CASE WHEN :sort = 'rating' THEN c.avg_rating END DESC NULLS LAST,
          CASE WHEN :sort = 'popular' THEN c.enrollment_count END DESC NULLS LAST,
          c.created_at DESC
        """,
        countQuery = """
        SELECT count(*) FROM courses c
        WHERE (:status IS NULL OR c.status = :status)
          AND (:categoryId IS NULL OR c.category_id = :categoryId)
          AND (:difficulty IS NULL OR c.difficulty = :difficulty)
          AND (:priceFilter IS NULL
               OR (:priceFilter = 'free' AND c.price = 0)
               OR (:priceFilter = 'paid' AND c.price > 0))
          AND (:search IS NULL OR to_tsvector('english', c.title || ' ' || coalesce(c.subtitle,'') || ' ' || coalesce(c.description,''))
               @@ plainto_tsquery('english', :search))
        """,
        nativeQuery = true)
    Page<Course> search(@Param("status") String status,
                         @Param("categoryId") UUID categoryId,
                         @Param("difficulty") String difficulty,
                         @Param("priceFilter") String priceFilter,
                         @Param("search") String search,
                         @Param("sort") String sort,
                         Pageable pageable);
}
