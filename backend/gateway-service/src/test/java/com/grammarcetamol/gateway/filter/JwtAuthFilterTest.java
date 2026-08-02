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
        when(chain.filter(any())).thenReturn(Mono.empty());
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
}
