package com.grammarcetamol.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body for {@code POST /api/users} — a Super Admin creating a staff account.
 * Deliberately cannot create SUPER_ADMIN or STUDENT accounts through this path:
 * super admins are seeded, students self-register.
 */
@Data
public class CreateUserRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be a valid email address")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
    @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
    private String password;

    @NotBlank(message = "Full name is required")
    private String fullName;

    @NotBlank(message = "Role is required")
    @Pattern(regexp = "MODERATOR|CUSTOMER_SUPPORT", message = "Role must be MODERATOR or CUSTOMER_SUPPORT")
    private String role;
}
