package com.grammarcetamol.auth.dto;

/**
 * Shared password complexity rule: at least one lower case letter, one upper
 * case letter, and one digit (length is enforced separately via @Size).
 * Used by both registration and password-reset so a weak password can't be
 * set through either path.
 */
public final class PasswordPolicy {

    public static final String REGEX = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$";
    public static final String MESSAGE = "Password must contain an upper case letter, a lower case letter, and a number";

    private PasswordPolicy() {
    }
}
