package com.grammarcetamol.auth.grpc;

import com.grammarcetamol.auth.repository.UserRepository;
import com.grammarcetamol.auth.service.JwtService;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.UUID;

@Slf4j
@GrpcService
@RequiredArgsConstructor
public class AuthGrpcService extends AuthServiceGrpc.AuthServiceImplBase {

    private final JwtService         jwtService;
    private final StringRedisTemplate redisTemplate;
    private final UserRepository     userRepository;

    @Override
    public void validateToken(AuthProto.ValidateTokenRequest request,
                              StreamObserver<AuthProto.ValidateTokenResponse> responseObserver) {
        try {
            var claims = jwtService.validateToken(request.getToken());

            String jti = (String) claims.get("jti");
            if (jti != null && Boolean.TRUE.equals(
                    redisTemplate.hasKey("blacklist:" + jti))) {
                responseObserver.onNext(AuthProto.ValidateTokenResponse.newBuilder()
                    .setValid(false)
                    .setErrorMessage("Token has been revoked")
                    .build());
                responseObserver.onCompleted();
                return;
            }

            String userId = claims.getSubject();
            String email  = (String) claims.get("email");
            @SuppressWarnings("unchecked")
            var roles = (java.util.List<String>) claims.get("roles");

            var builder = AuthProto.ValidateTokenResponse.newBuilder()
                .setValid(true)
                .setUserId(userId != null ? userId : "")
                .setEmail(email != null ? email : "");

            if (roles != null) {
                roles.forEach(builder::addRoles);
            }

            responseObserver.onNext(builder.build());
        } catch (Exception e) {
            log.debug("Token validation failed: {}", e.getMessage());
            responseObserver.onNext(AuthProto.ValidateTokenResponse.newBuilder()
                .setValid(false)
                .setErrorMessage(e.getMessage())
                .build());
        }
        responseObserver.onCompleted();
    }

    @Override
    public void getUserById(AuthProto.GetUserByIdRequest request,
                            StreamObserver<AuthProto.UserResponse> responseObserver) {
        try {
            UUID userId = UUID.fromString(request.getUserId());
            userRepository.findById(userId).ifPresentOrElse(
                user -> {
                    responseObserver.onNext(AuthProto.UserResponse.newBuilder()
                        .setId(user.getId().toString())
                        .setEmail(user.getEmail())
                        .setStatus(user.getStatus().name())
                        .setEmailVerified(user.isEmailVerified())
                        .build());
                    responseObserver.onCompleted();
                },
                () -> {
                    responseObserver.onError(
                        io.grpc.Status.NOT_FOUND.withDescription("User not found")
                            .asRuntimeException()
                    );
                }
            );
        } catch (Exception e) {
            responseObserver.onError(
                io.grpc.Status.INTERNAL.withDescription(e.getMessage()).asRuntimeException()
            );
        }
    }
}
