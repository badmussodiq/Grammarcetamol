package com.grammarcetamol.gateway.filter;


import io.grpc.StatusRuntimeException;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    @GrpcClient("auth-service")
    private AuthServiceGrpc.AuthServiceBlockingStub authServiceStub;

    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    private static final List<String[]> PUBLIC_ROUTES = List.of(
        new String[]{"POST", "/api/auth/login"},
        new String[]{"POST", "/api/auth/register"},
        new String[]{"POST", "/api/auth/forgot-password"},
        new String[]{"POST", "/api/auth/reset-password"},
        new String[]{"POST", "/api/auth/resend-verification"},
        new String[]{"GET",  "/api/auth/verify-email"},
        new String[]{"GET",  "/api/auth/.well-known/jwks.json"},
        new String[]{"*",    "/api/auth/oauth2/**"},
        new String[]{"GET",  "/api/courses/**"}
    );

    private static final String ACCESS_TOKEN_COOKIE = "access_token";

    @Override
    public int getOrder() {
        return -1;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path   = request.getPath().value();
        String method = request.getMethod().name();

        if (isPublicRoute(method, path)) {
            return chain.filter(exchange);
        }

        String token = extractToken(request);
        if (token == null) {
            return unauthorizedResponse(exchange, "Missing or invalid access token");
        }

        try {
            AuthProto.ValidateTokenResponse response = authServiceStub.validateToken(
                AuthProto.ValidateTokenRequest.newBuilder().setToken(token).build()
            );

            if (!response.getValid()) {
                return unauthorizedResponse(exchange, "Unauthorized");
            }

            String requestId = UUID.randomUUID().toString();
            String roles = String.join(",", response.getRolesList());

            ServerHttpRequest mutated = request.mutate()
                .header("X-User-Id",    response.getUserId())
                .header("X-User-Role",  roles)
                .header("X-User-Email", response.getEmail())
                .header("X-Request-Id", requestId)
                .build();

            return chain.filter(exchange.mutate().request(mutated).build());

        } catch (StatusRuntimeException e) {
            return serviceUnavailableResponse(exchange, "Auth service unavailable");
        }
    }

    /**
     * The frontend never has JS access to the JWT — it's an httpOnly cookie set by
     * auth-service. So a request is authenticated either via a genuine Authorization
     * header (service-to-service, tests, tools) or via the access_token cookie the
     * browser sends automatically. Header wins if somehow both are present.
     */
    private String extractToken(ServerHttpRequest request) {
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        HttpCookie cookie = request.getCookies().getFirst(ACCESS_TOKEN_COOKIE);
        return cookie != null ? cookie.getValue() : null;
    }

    private boolean isPublicRoute(String method, String path) {
        for (String[] route : PUBLIC_ROUTES) {
            String routeMethod = route[0];
            String routePath   = route[1];
            boolean methodMatch = routeMethod.equals("*") || routeMethod.equals(method);
            boolean pathMatch   = PATH_MATCHER.match(routePath, path);
            if (methodMatch && pathMatch) return true;
        }
        return false;
    }

    private Mono<Void> unauthorizedResponse(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] body = ("{\"error\":\"" + message + "\"}").getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = response.bufferFactory().wrap(body);
        return response.writeWith(Mono.just(buffer));
    }

    private Mono<Void> serviceUnavailableResponse(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] body = ("{\"error\":\"" + message + "\"}").getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = response.bufferFactory().wrap(body);
        return response.writeWith(Mono.just(buffer));
    }
}
