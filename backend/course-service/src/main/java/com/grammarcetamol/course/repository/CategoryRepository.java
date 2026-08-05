package com.grammarcetamol.course.repository;

import com.grammarcetamol.course.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    Optional<Category> findBySlug(String slug);
    boolean existsBySlug(String slug);
    List<Category> findAllByOrderBySortOrderAsc();
}
