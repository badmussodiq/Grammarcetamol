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
        String internalToken = appGatewayProperties.getInternalToken();

        return builder.routes()
            // Auth service routes with rate limiting on sensitive endpoints
            .route("auth-login", r -> r
                .path("/api/auth/login")
                .filters(f -> f.requestRateLimiter(c -> {
                    c.setRateLimiter(rateLimitConfig.authRateLimiter());
                    c.setKeyResolver(rateLimitConfig.ipKeyResolver());
                }))
                .uri(appGatewayProperties.getAuthServiceUrl()))
            .route("auth-register", r -> r
                .path("/api/auth/register")
                .filters(f -> f.requestRateLimiter(c -> {
                    c.setRateLimiter(rateLimitConfig.authRateLimiter());
                    c.setKeyResolver(rateLimitConfig.ipKeyResolver());
                }))
                .uri(appGatewayProperties.getAuthServiceUrl()))
            .route("auth-service", r -> r
                .path("/api/auth/**")
                .uri(appGatewayProperties.getAuthServiceUrl()))
            // User service routes – inject internal token header
            .route("user-service", r -> r
                .path("/api/users/**")
                .filters(f -> f.addRequestHeader("X-Internal-Token", internalToken))
                .uri(appGatewayProperties.getUserServiceUrl()))
            // Course service routes
            .route("course-service", r -> r
                .path("/api/courses/**")
                .uri(appGatewayProperties.getCourseServiceUrl()))
            .build();
    }
}
