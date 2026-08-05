package com.grammarcetamol.auth.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CreateUserRequestTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    private CreateUserRequest validRequest(String role) {
        CreateUserRequest req = new CreateUserRequest();
        req.setEmail("staff@example.com");
        req.setPassword("Secret123");
        req.setFullName("Staff Member");
        req.setRole(role);
        return req;
    }

    @Test
    void moderatorRole_isValid() {
        Set<ConstraintViolation<CreateUserRequest>> violations = validator.validate(validRequest("MODERATOR"));
        assertThat(violations).isEmpty();
    }

    @Test
    void customerSupportRole_isValid() {
        Set<ConstraintViolation<CreateUserRequest>> violations = validator.validate(validRequest("CUSTOMER_SUPPORT"));
        assertThat(violations).isEmpty();
    }

    @Test
    void superAdminRole_isRejected() {
        Set<ConstraintViolation<CreateUserRequest>> violations = validator.validate(validRequest("SUPER_ADMIN"));
        assertThat(violations).isNotEmpty();
    }

    @Test
    void studentRole_isRejected() {
        Set<ConstraintViolation<CreateUserRequest>> violations = validator.validate(validRequest("STUDENT"));
        assertThat(violations).isNotEmpty();
    }

    @Test
    void weakPassword_isRejected() {
        CreateUserRequest req = validRequest("MODERATOR");
        req.setPassword("weakpassword");
        Set<ConstraintViolation<CreateUserRequest>> violations = validator.validate(req);
        assertThat(violations).isNotEmpty();
    }
}
