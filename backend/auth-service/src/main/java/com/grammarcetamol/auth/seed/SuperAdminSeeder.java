package com.grammarcetamol.auth.seed;

import com.grammarcetamol.auth.entity.RoleName;
import com.grammarcetamol.auth.exception.EmailAlreadyExistsException;
import com.grammarcetamol.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SuperAdminSeeder {

    private final Logger log = LoggerFactory.getLogger(SuperAdminSeeder.class.getSimpleName());

    private final AuthService authService;

    @Value("${app.super-admin-email:admin@grammarcetamol.com}")
    private String superAdminEmail;

    @Value("${app.super-admin-password:ChangeMe123!}")
    private String superAdminPassword;

    @EventListener(ApplicationReadyEvent.class)
    public void seedSuperAdmin() {
        try {
            authService.registerInternal(
                    superAdminEmail,
                    superAdminPassword,
                    "Super Admin",
                    RoleName.SUPER_ADMIN.name()
            );
            log.info("Super admin account seeded: {}", superAdminEmail);
        } catch (EmailAlreadyExistsException e) {
            log.debug("Super admin already seeded: {}", superAdminEmail);
        } catch (Exception e) {
            log.warn("Super admin seeding failed: {}", e.getMessage());
        }
    }
}
