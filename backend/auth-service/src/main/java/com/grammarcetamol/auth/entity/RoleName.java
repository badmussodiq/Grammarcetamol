package com.grammarcetamol.auth.entity;

/**
 * All supported user roles.
 * Stored directly as a column on {@link UserProfile} — not a separate table.
 * Add new values here as the application grows; the DB column is VARCHAR so
 * adding a value only requires a Flyway migration to update the CHECK constraint
 * if one exists, or no migration at all if unconstrained.
 */
public enum RoleName {
    SUPER_ADMIN,
    STUDENT,
    MODERATOR,
    CUSTOMER_SUPPORT
}
