package com.grammarcetamol.course;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

// shared-java is a plain library, not a Spring Boot auto-configuration — its classes (ApiResponse,
// CurrentUser, CurrentUserArgumentResolver, WebConfig, GlobalExceptionHandler) live outside this
// app's own base package, so they need to be named here explicitly.
@SpringBootApplication
@ComponentScan(basePackages = {"com.grammarcetamol.course", "com.grammarcetamol.shared"})
public class CourseServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(CourseServiceApplication.class, args);
    }
}
