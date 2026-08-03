package com.grammarcetamol.auth.repository;

import com.grammarcetamol.auth.entity.JwtBlacklist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface JwtBlacklistRepository extends JpaRepository<JwtBlacklist, UUID> {

    boolean existsByJti(UUID jti);
}
