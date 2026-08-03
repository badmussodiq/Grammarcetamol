package com.grammarcetamol.auth.repository;

import com.grammarcetamol.auth.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("""
        SELECT u FROM User u
        WHERE :query IS NULL
           OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :query, '%'))
           OR LOWER(u.email)    LIKE LOWER(CONCAT('%', :query, '%'))
        """)
    Page<User> search(@Param("query") String query, Pageable pageable);
}
