package com.grammarcetamol.auth.repository;

import com.grammarcetamol.auth.entity.JwtBlacklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface JwtBlacklistRepository extends JpaRepository<JwtBlacklist, UUID> {

    boolean existsByJti(UUID jti);
}
