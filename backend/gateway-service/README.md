# gateway-service

Spring Cloud Gateway (reactive, WebFlux). Java 21. The single entry point for all browser traffic — port `8080`. Routes are configured programmatically (no Eureka/service registry; downstream URLs come from environment variables / `application.yml`), not via YAML route lists.

## How to run locally

Needs Redis (for rate limiting) and `auth-service` reachable via both HTTP and gRPC.

1. Start Postgres, Redis, and RabbitMQ: `docker compose -f ../../docker/docker-compose.dev.yml up -d`.
2. Start `auth-service` first — the gateway's `JwtAuthFilter` calls its gRPC `ValidateToken` on every protected request, so it needs to be up.
3. `mvn spring-boot:run`

See `../auth-service/README.md` for a Windows-specific startup gotcha that applies equally here.

## What it does

- **Routing** (`RouteConfig`): `/api/auth/**` and `/api/users/**` → `auth-service`; `/api/courses/**` → a course-service that doesn't exist yet (Phase 2). Auth routes carry a rate-limit filter.
- **JWT validation** (`JwtAuthFilter`): extracts the token from an `Authorization: Bearer` header or the `access_token` httpOnly cookie (cookie is what the browser actually sends — the frontend never has JS access to the JWT), calls `auth-service` over gRPC to validate it, and injects `X-User-Id` / `X-User-Role` / `X-User-Email` headers onto the downstream request on success. A fixed whitelist of public routes (login, register, forgot/reset-password, email verification, JWKS, `GET /api/courses/**`) skips this entirely. Also stamps every request with an `X-Request-Id`.
- **CORS**: via `spring.cloud.gateway.globalcors` in `application.yml` — **not** a custom `CorsWebFilter` bean. That distinction is load-bearing: a hand-rolled `CorsWebFilter` alongside Spring Cloud Gateway's own route/preflight handling produced duplicate `Access-Control-Allow-Origin` / `Access-Control-Allow-Credentials` response headers, which browsers reject outright (`net::ERR_FAILED`) even when both copies are identical — this took a while to track down since the request itself succeeded end-to-end (backend logs looked fine, `curl`/Postman worked, only real browser fetches failed). If you need to touch CORS config, keep it here, in `globalcors` — don't add a second mechanism.
- **Rate limiting** (`RateLimitConfig`, Redis-backed token bucket): default 10 req/s (burst 20) per client IP; auth endpoints 1 req/s (burst 5).
- Auth service's own CORS handling is deliberately absent — the gateway is the only browser-facing service, so CORS only needs to be handled once, here.

## Config

Key `application.yml` values (all overridable via env var):

| Property | Default | |
|---|---|---|
| `gateway.auth-service-url` | `http://localhost:8081` | auth-service REST |
| `grpc.client.auth-service.address` | `static://localhost:9091` | auth-service gRPC |
| `spring.data.redis.host` / `.port` | `localhost` / `6380` | rate limiting |
| `spring.cloud.gateway.globalcors.cors-configurations` | allows `:3000` and `:3001` | student + admin frontends |

`/actuator/health` and `/actuator/routes` are exposed for debugging.

## Port

`8080`
