# gateway-service

Spring Cloud Gateway (reactive, WebFlux). Java 21. The single entry point for all browser traffic — port `8080`. Routes are configured programmatically (no Eureka/service registry; downstream URLs come from environment variables / `application.yml`), not via YAML route lists.

## How to run locally

Needs Redis (for rate limiting) and `auth-service` reachable via both HTTP and gRPC.

1. Start Postgres, Redis, and RabbitMQ: `docker compose -f ../../docker/docker-compose.dev.yml up -d`.
2. Start `auth-service` first — the gateway's `JwtAuthFilter` calls its gRPC `ValidateToken` on every protected request, so it needs to be up.
3. `mvn spring-boot:run`

See `../auth-service/README.md` for a Windows-specific startup gotcha that applies equally here.

## What it does

- **Routing** (`RouteConfig`): `/api/auth/**` and `/api/users/**` → `auth-service`; `/api/courses/**` and `/api/categories/**` → `course-service` (Phase 2, `backend/course-service`, port 8083). Auth routes carry a rate-limit filter.
- **JWT validation** (`JwtAuthFilter`): extracts the token from an `Authorization: Bearer` header or the `access_token` httpOnly cookie (cookie is what the browser actually sends — the frontend never has JS access to the JWT), calls `auth-service` over gRPC to validate it, and injects `X-User-Id` / `X-User-Role` / `X-User-Email` headers onto the downstream request on success. Downstream services (course-service included) trust these headers rather than parsing the JWT themselves. Also stamps every request with an `X-Request-Id`.
  - **`PUBLIC_ROUTES`** (login, register, forgot/reset-password, email verification, JWKS) skip auth entirely — no attempt to read a token even if one's present.
  - **`OPTIONALLY_AUTHENTICATED_ROUTES`** (`GET /api/courses/**`, `GET /api/categories/**`) are different on purpose: a request with no token, an expired token, or a token that can't be validated (auth-service down) all fail *open* to anonymous — guests can always browse the public catalog. But a request that *does* carry a valid token still gets its identity headers injected. This distinction matters: an early version of this filter treated `GET /api/courses/**` as flat-out public and never attempted validation, which meant a logged-in admin viewing their own **draft** course (via `GET /api/courses/{id}`) looked identical to an anonymous guest to course-service — and course-service correctly 404s a non-published course for anyone it can't identify as the owner/an admin. Fixed 2026-08-05; see `JwtAuthFilterTest`'s `optionallyAuthenticatedRoute*` tests.
- **CORS**: via `spring.cloud.gateway.globalcors` in `application.yml` — **not** a custom `CorsWebFilter` bean. That distinction is load-bearing: a hand-rolled `CorsWebFilter` alongside Spring Cloud Gateway's own route/preflight handling produced duplicate `Access-Control-Allow-Origin` / `Access-Control-Allow-Credentials` response headers, which browsers reject outright (`net::ERR_FAILED`) even when both copies are identical — this took a while to track down since the request itself succeeded end-to-end (backend logs looked fine, `curl`/Postman worked, only real browser fetches failed). If you need to touch CORS config, keep it here, in `globalcors` — don't add a second mechanism.
- **Rate limiting** (`RateLimitConfig`, Redis-backed token bucket): default 10 req/s (burst 20) per client IP; auth endpoints 1 req/s (burst 5).
- Auth service's own CORS handling is deliberately absent — the gateway is the only browser-facing service, so CORS only needs to be handled once, here.

## Config

Key `application.yml` values (all overridable via env var):

| Property | Default | |
|---|---|---|
| `gateway.auth-service-url` | `http://localhost:8081` | auth-service REST |
| `gateway.course-service-url` | `http://localhost:8083` | course-service REST |
| `grpc.client.auth-service.address` | `static://localhost:9091` | auth-service gRPC |
| `spring.data.redis.host` / `.port` | `localhost` / `6380` | rate limiting |
| `spring.cloud.gateway.globalcors.cors-configurations` | allows `:3000` and `:3001` | student + admin frontends |

`/actuator/health` and `/actuator/routes` are exposed for debugging.

## Port

`8080`
