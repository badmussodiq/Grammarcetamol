package com.grammarcetamol.enrollment;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.ComponentScan;

// shared-java is a plain library, not a Spring Boot auto-configuration — see its README.
@SpringBootApplication
@ComponentScan(basePackages = {"com.grammarcetamol.enrollment", "com.grammarcetamol.shared"})
@ConfigurationPropertiesScan
public class EnrollmentServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(EnrollmentServiceApplication.class, args);
    }
}
