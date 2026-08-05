# auth-service

Spring Boot 3 / Java 21. Handles registration, email verification, login/logout, refresh, forgot/reset password, gRPC token validation for the gateway, and user profile + admin user management (there is no separate `user-service` — it was merged in; see `implementation-phases.md`).

Google OAuth is **intentionally deferred** — not implemented, not currently being worked toward. Don't treat its absence as a gap; see `PLAN.md`.

## How to run locally

1. Start Postgres, Redis, and RabbitMQ: `docker compose -f ../../docker/docker-compose.dev.yml up -d` (see the root README for a Windows/WSL2 note on keeping the containers up).
2. Generate RSA keys (see below) if `src/main/resources/keys/private.pem` / `public.pem` don't already exist — they're gitignored, so a fresh clone won't have them.
3. Copy `.env.example` to `.env` and adjust if you're not using the default docker-compose ports.
4. Run: `mvn spring-boot:run`

Flyway migrations run automatically on startup — no separate migration step.

The service seeds a super admin account on first successful boot (`SuperAdminSeeder`, via `app.super-admin-email` / `app.super-admin-password`, defaulting to `admin@grammarcetamol.com` / `ChangeMe123!` — change these for anything beyond local dev).

### Windows-specific gotcha

If startup fails with `Unable to establish loopback connection` / `Selector.open()` errors, that's not this codebase — it's a JDK-level Windows NIO issue, most often triggered by security/endpoint-protection software (Acronis Active Protection and Windows Defender's Network Inspection Service have both been observed causing it) intercepting the loopback socket `Selector` needs. It's been consistently reliable when launched from an interactive terminal but unreliable when launched by automation/scripts, suggesting the offending software trusts interactively-typed commands more than spawned processes. Add a process exclusion for `java.exe` if you hit this; it isn't fixable by JVM flags (a legacy-selector-provider override still fails identically).

## Generate RSA keys

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Place `private.pem` and `public.pem` in `src/main/resources/keys/`. **Never commit these files to git** — `*.pem` under that folder is already gitignored.

## Endpoints

REST, via the gateway at `/api/auth/**` and `/api/users/**` (or directly on `:8081` in dev):

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/auth/register` | public | bcrypt cost 12, publishes `user.created`, queues verification email |
| `GET /api/auth/verify-email?token=` | public | |
| `POST /api/auth/resend-verification` | public | Redis rate-limited, 1/60s per email |
| `POST /api/auth/login` | public | issues httpOnly `access_token` (15 min) + `refresh_token` (7 days) cookies; 5-attempt lockout |
| `POST /api/auth/logout` | authenticated | blacklists the JWT `jti` in Redis, revokes the refresh token |
| `POST /api/auth/refresh` | authenticated | rotates the refresh token |
| `POST /api/auth/forgot-password` / `POST /api/auth/reset-password` | public | Redis-backed reset token, 1h TTL |
| `GET /api/auth/.well-known/jwks.json` | public | RSA public key |
| `GET /api/users/me` / `PATCH /api/users/me` | authenticated | own profile |
| `POST /api/users` | `SUPER_ADMIN` | provisions a `MODERATOR` or `CUSTOMER_SUPPORT` account — cannot create `SUPER_ADMIN` (seeded only) or `STUDENT` (self-register only) |
| `GET /api/users` / `GET /api/users/:id` | `SUPER_ADMIN` or `MODERATOR` | paginated directory / lookup |
| `PATCH /api/users/:id/status` | `SUPER_ADMIN` | suspend/activate |

gRPC, on `:9091` (`auth.proto`) — consumed by the gateway's `JwtAuthFilter` to validate tokens without an HTTP round-trip:

- `ValidateToken` — checks the RSA signature, Redis blacklist, and expiry.
- `GetUserById` — user lookup by UUID.

## Schema notes

`users.status` is a native Postgres `ENUM` (`user_status`), mapped via Hibernate's `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` — **not** a plain string `AttributeConverter`. That distinction matters: a converter that just does enum-name ↔ `String` works for ordinary `VARCHAR` columns, but JDBC can't implicitly cast a driver-typed `varchar` bind parameter into a custom Postgres enum column on `INSERT`/`UPDATE`. If you're adding a new enum-backed column, mirror the `status` field's mapping in `User.java`, not `role`'s (which is a plain `VARCHAR(64)` and doesn't have this problem).

Relatedly: if a JPQL query reuses the same named parameter both in an `IS NULL` check and inside a function call like `CONCAT(...)` (as `UserRepository.search` used to), a `null` value for that parameter gives Hibernate an ambiguous type to infer and it can resolve to `bytea` instead of `text` — surfacing as `function lower(bytea) does not exist`. Branch in Java instead of relying on JPQL to handle the null case (see `UserProfileService.getAllUsers`).

`database-schema-and-migrations.md` documents this table as `status VARCHAR(20) CHECK (...)` with lowercase values — that's the original spec; the actual migration (`V1__auth_initial_schema.sql`) uses the native `ENUM` described above with uppercase values. The migration files under `src/main/resources/db/migration/` are the source of truth.

## Ports

- REST: `8081`
- gRPC: `9091`
