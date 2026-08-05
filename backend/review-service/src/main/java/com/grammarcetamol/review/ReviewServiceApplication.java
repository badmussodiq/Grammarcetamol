package com.grammarcetamol.review;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.ComponentScan;

// shared-java is a plain library, not a Spring Boot auto-configuration — see its README.
@SpringBootApplication
@ComponentScan(basePackages = {"com.grammarcetamol.review", "com.grammarcetamol.shared"})
@ConfigurationPropertiesScan
public class ReviewServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ReviewServiceApplication.class, args);
    }
}
