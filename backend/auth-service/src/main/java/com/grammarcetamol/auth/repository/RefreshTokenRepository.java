package com.grammarcetamol.auth.repository;

import com.grammarcetamol.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String hash);

    void deleteAllByUserId(UUID userId);

    List<RefreshToken> findAllByUserIdAndRevokedAtIsNull(UUID userId);
}
