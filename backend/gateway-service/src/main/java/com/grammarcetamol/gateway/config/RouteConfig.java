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
            // Course reviews route to review-service — must be registered before the general
            // course-service route below, since routes match in registration order and
            // /api/courses/** would otherwise swallow this more specific path first.
            .route("course-reviews", r -> r
                .path("/api/courses/*/reviews")
                .uri(appGatewayProperties.getReviewServiceUrl()))
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
            // Payment service routes
            .route("payment-service", r -> r
                .path("/api/payments/**")
                .uri(appGatewayProperties.getPaymentServiceUrl()))
            // Review service routes (course-reviews above already claims /api/courses/*/reviews)
            .route("review-service", r -> r
                .path("/api/reviews/**")
                .uri(appGatewayProperties.getReviewServiceUrl()))
            // Upload service routes
            .route("upload-service", r -> r
                .path("/api/uploads/**")
                .uri(appGatewayProperties.getUploadServiceUrl()))
            // Notification service routes (templates + immutable send-audit log, both admin-gated)
            .route("notification-service", r -> r
                .path("/api/notification-templates/**", "/api/notification-logs/**")
                .uri(appGatewayProperties.getNotificationServiceUrl()))
            // Support tickets — also served by notification-service. POST /api/support/tickets
            // is public (see JwtAuthFilter's OPTIONALLY_AUTHENTICATED_ROUTES); list/detail/close
            // are admin/moderator-gated inside SupportController itself.
            .route("support-service", r -> r
                .path("/api/support/**")
                .uri(appGatewayProperties.getNotificationServiceUrl()))
            .build();
    }
}
