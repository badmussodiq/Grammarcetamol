package com.grammarcetamol.shared.config;

import java.util.Set;
import java.util.UUID;

/**
 * Identity read straight off the gateway's X-User-Id / X-User-Role headers — services on this
 * shared module never see a raw JWT. id is null and roles is empty for anonymous (public route)
 * requests.
 */
public record CurrentUser(UUID id, Set<String> roles) {

    public static final CurrentUser ANONYMOUS = new CurrentUser(null, Set.of());

    public boolean isAuthenticated() {
        return id != null;
    }

    public boolean isAdminOrModerator() {
        return roles.contains("SUPER_ADMIN") || roles.contains("MODERATOR");
    }

    public boolean isSuperAdmin() {
        return roles.contains("SUPER_ADMIN");
    }

    /** True for a super admin, or the resource's own owner. */
    public boolean canModify(UUID resourceOwnerId) {
        return isSuperAdmin() || (isAuthenticated() && id.equals(resourceOwnerId));
    }
}
