package com.grammarcetamol.gateway.filter;

import com.grammarcetamol.gateway.grpc.AuthProto;
import com.grammarcetamol.gateway.grpc.AuthServiceGrpc;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthFilterTest {

    @Mock
    private AuthServiceGrpc.AuthServiceBlockingStub authServiceStub;

    @Mock
    private GatewayFilterChain chain;

    @InjectMocks
    private JwtAuthFilter jwtAuthFilter;

    @BeforeEach
    void setUp() {
        // lenient: invalidTokenReturns401 and missingTokenReturns401 never reach chain.filter(),
        // since the request is rejected before the chain runs.
        lenient().when(chain.filter(any())).thenReturn(Mono.empty());
    }

    @Test
    void publicRouteSkipsFilter() {
        MockServerHttpRequest request = MockServerHttpRequest
            .post("/api/auth/login")
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        verify(authServiceStub, never()).validateToken(any());
        verify(chain, times(1)).filter(any());
    }

    @Test
    void validTokenPassesThrough() {
        AuthProto.ValidateTokenResponse grpcResponse = AuthProto.ValidateTokenResponse.newBuilder()
            .setValid(true)
            .setUserId("user-123")
            .setEmail("user@example.com")
            .addRoles("STUDENT")
            .build();

        when(authServiceStub.validateToken(any())).thenReturn(grpcResponse);

        MockServerHttpRequest request = MockServerHttpRequest
            .get("/api/users/me")
            .header(HttpHeaders.AUTHORIZATION, "Bearer valid.jwt.token")
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        verify(chain, times(1)).filter(argThat(ex -> {
            String userId = ex.getRequest().getHeaders().getFirst("X-User-Id");
            return "user-123".equals(userId);
        }));
    }

    @Test
    void invalidTokenReturns401() {
        AuthProto.ValidateTokenResponse grpcResponse = AuthProto.ValidateTokenResponse.newBuilder()
            .setValid(false)
            .setErrorMessage("Token expired")
            .build();

        when(authServiceStub.validateToken(any())).thenReturn(grpcResponse);

        MockServerHttpRequest request = MockServerHttpRequest
            .get("/api/users/me")
            .header(HttpHeaders.AUTHORIZATION, "Bearer expired.jwt.token")
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void missingTokenReturns401() {
        MockServerHttpRequest request = MockServerHttpRequest
            .get("/api/users/me")
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(authServiceStub, never()).validateToken(any());
    }

    @Test
    void validTokenInCookiePassesThrough() {
        AuthProto.ValidateTokenResponse grpcResponse = AuthProto.ValidateTokenResponse.newBuilder()
            .setValid(true)
            .setUserId("user-456")
            .setEmail("cookie-user@example.com")
            .addRoles("STUDENT")
            .build();

        when(authServiceStub.validateToken(any())).thenReturn(grpcResponse);

        MockServerHttpRequest request = MockServerHttpRequest
            .get("/api/users/me")
            .cookie(new HttpCookie("access_token", "cookie.jwt.token"))
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        verify(chain, times(1)).filter(argThat(ex -> {
            String userId = ex.getRequest().getHeaders().getFirst("X-User-Id");
            return "user-456".equals(userId);
        }));
    }

    @Test
    void headerTakesPrecedenceOverCookie() {
        AuthProto.ValidateTokenResponse grpcResponse = AuthProto.ValidateTokenResponse.newBuilder()
            .setValid(true)
            .setUserId("header-user")
            .build();

        when(authServiceStub.validateToken(argThat(req -> "header.jwt.token".equals(req.getToken()))))
            .thenReturn(grpcResponse);

        MockServerHttpRequest request = MockServerHttpRequest
            .get("/api/users/me")
            .header(HttpHeaders.AUTHORIZATION, "Bearer header.jwt.token")
            .cookie(new HttpCookie("access_token", "cookie.jwt.token"))
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        verify(authServiceStub).validateToken(argThat(req -> "header.jwt.token".equals(req.getToken())));
    }

    @Test
    void optionallyAuthenticatedRouteWithNoTokenPassesThroughAnonymously() {
        MockServerHttpRequest request = MockServerHttpRequest
            .get("/api/courses/some-course-slug")
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        verify(authServiceStub, never()).validateToken(any());
        verify(chain, times(1)).filter(any());
        assertThat(exchange.getRequest().getHeaders().getFirst("X-User-Id")).isNull();
    }

    @Test
    void optionallyAuthenticatedRouteWithValidTokenInjectsIdentity() {
        AuthProto.ValidateTokenResponse grpcResponse = AuthProto.ValidateTokenResponse.newBuilder()
            .setValid(true)
            .setUserId("owner-123")
            .addRoles("MODERATOR")
            .build();
        when(authServiceStub.validateToken(any())).thenReturn(grpcResponse);

        MockServerHttpRequest request = MockServerHttpRequest
            .get("/api/courses/draft-course-id")
            .cookie(new HttpCookie("access_token", "valid.jwt.token"))
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        verify(chain, times(1)).filter(argThat(ex ->
            "owner-123".equals(ex.getRequest().getHeaders().getFirst("X-User-Id"))));
    }

    @Test
    void optionallyAuthenticatedRouteWithInvalidTokenStillPassesThroughAnonymously() {
        AuthProto.ValidateTokenResponse grpcResponse = AuthProto.ValidateTokenResponse.newBuilder()
            .setValid(false)
            .build();
        when(authServiceStub.validateToken(any())).thenReturn(grpcResponse);

        MockServerHttpRequest request = MockServerHttpRequest
            .get("/api/courses/some-course-slug")
            .cookie(new HttpCookie("access_token", "expired.jwt.token"))
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        // Not a 401 — an expired token on a public catalog route just means "browse as a guest".
        assertThat(exchange.getResponse().getStatusCode()).isNull();
        verify(chain, times(1)).filter(any());
    }

    @Test
    void optionallyAuthenticatedRouteFailsOpenWhenAuthServiceUnavailable() {
        when(authServiceStub.validateToken(any())).thenThrow(new io.grpc.StatusRuntimeException(io.grpc.Status.UNAVAILABLE));

        MockServerHttpRequest request = MockServerHttpRequest
            .get("/api/categories")
            .cookie(new HttpCookie("access_token", "some.jwt.token"))
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isNull();
        verify(chain, times(1)).filter(any());
    }

    @Test
    void nonGetOnCoursesStillRequiresAuth() {
        MockServerHttpRequest request = MockServerHttpRequest
            .post("/api/courses")
            .build();
        ServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(jwtAuthFilter.filter(exchange, chain))
            .verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(chain, never()).filter(any());
    }

    @Test
    void resendVerificationAndJwksAreAlsoPublicRoutes() {
        MockServerHttpRequest resendRequest = MockServerHttpRequest
            .post("/api/auth/resend-verification")
            .build();
        StepVerifier.create(jwtAuthFilter.filter(MockServerWebExchange.from(resendRequest), chain))
            .verifyComplete();

        MockServerHttpRequest jwksRequest = MockServerHttpRequest
            .get("/api/auth/.well-known/jwks.json")
            .build();
        StepVerifier.create(jwtAuthFilter.filter(MockServerWebExchange.from(jwksRequest), chain))
            .verifyComplete();

        verify(authServiceStub, never()).validateToken(any());
        verify(chain, times(2)).filter(any());
    }
}
