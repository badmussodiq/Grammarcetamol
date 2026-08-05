package com.grammarcetamol.gateway.config;

import com.grammarcetamol.gateway.filter.RateLimitConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class RouteConfig {

    private final RateLimitConfig rateLimitConfig;
    private final AppGatewayProperties appGatewayProperties;

    @Bean
    public RouteLocator routeLocator(RouteLocatorBuilder builder) {
        return builder.routes()
            // Auth service routes with rate limiting on sensitive endpoints
            .route("auth-login", r -> r
                .path("/api/auth/**")
                .filters(f -> f.requestRateLimiter(c -> {
                    c.setRateLimiter(rateLimitConfig.authRateLimiter());
                    c.setKeyResolver(rateLimitConfig.ipKeyResolver());
                }))
                .uri(appGatewayProperties.getAuthServiceUrl()))
            // User profile routes — now served by auth-service (merged)
            .route("user-profile", r -> r
                .path("/api/users/**")
                .uri(appGatewayProperties.getAuthServiceUrl()))
            // Course service routes
            .route("course-service", r -> r
                .path("/api/courses/**")
                .uri(appGatewayProperties.getCourseServiceUrl()))
            .route("categories-service", r -> r
                .path("/api/categories/**")
                .uri(appGatewayProperties.getCourseServiceUrl()))
            // Enrollment service routes
            .route("enrollment-service", r -> r
                .path("/api/enrollments/**")
                .uri(appGatewayProperties.getEnrollmentServiceUrl()))
            .route("progress-service", r -> r
                .path("/api/progress")
                .uri(appGatewayProperties.getEnrollmentServiceUrl()))
            .build();
    }
}
