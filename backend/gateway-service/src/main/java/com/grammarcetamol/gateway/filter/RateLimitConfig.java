package com.grammarcetamol.gateway.filter;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import reactor.core.publisher.Mono;

import java.util.Objects;

@Configuration
public class RateLimitConfig {

    /**
     * Default rate limiter: 10 requests/second, burst up to 20.
     */
    @Bean
    @Primary
    public RedisRateLimiter defaultRateLimiter() {
        return new RedisRateLimiter(10, 20);
    }

    /**
     * Auth rate limiter: 1 request/second, burst up to 5.
     * Applied to /api/auth/login and /api/auth/register.
     */
    @Bean
    public RedisRateLimiter authRateLimiter() {
        return new RedisRateLimiter(1, 5);
    }

    /**
     * Key resolver that extracts the client IP from X-Forwarded-For or remoteAddress.
     */
    @Bean
    public KeyResolver ipKeyResolver() {
        return exchange -> {
            String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
            if (forwarded != null && !forwarded.isEmpty()) {
                return Mono.just(forwarded.split(",")[0].trim());
            }
            return Mono.just(
                Objects.requireNonNull(
                    exchange.getRequest().getRemoteAddress()
                ).getAddress().getHostAddress()
            );
        };
    }
}
