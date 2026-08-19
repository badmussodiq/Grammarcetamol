Good clarifications. Let me update the plan with those constraints before continuing.

**Frontend changes:**
- No TanStack Query, no Zustand — use React `useContext` + `useReducer` for global state, native `fetch` for API calls, custom hooks for data fetching patterns
- Minimize external packages — `react-hook-form` and `zod` are out too; native form validation + custom hooks

**Gateway change:**
- No Eureka service discovery — service URLs are configured statically/programmatically in `application.yml` or a `RouteConfig` bean. Services register their host/port via environment variables, not a registry

Let me now complete the full plan with these corrections applied throughout.

---

# Implementation Plan — Grammarcetamol Digital Learning Ecosystem

> **Port renumbering (2026-08-09):** every service and infra container port cited in individual tasks below (`8080` gateway, `8081` auth, `8083` course, `8084` enrollment, `8085` review, `8086` payment, `8087` upload, plus Postgres `5433`/Redis `6380`/RabbitMQ `5673`+`15673`/MinIO `9002`+`9003`) reflects what was true **when that task was originally written and built** — left as historical record, not retroactively rewritten. All of it was later moved into one dedicated `9000`-series block (gateway first at `9000`, MongoDB added on `9015` for Task 31) to avoid colliding with any other project's own instances of these services on the same machine. **The root `README.md`'s "Running everything locally" section is the authoritative current port mapping** — check there, not the historical numbers below, before actually running anything.

> **Status as of 2026-08-05:** Tasks 1–10 below (Phase 0 + Phase 1) are implemented, with real divergences from this original plan noted inline per task — most notably: no root npm workspace (the repo root is a plain container folder, not a project; `apps/utilities` — renamed from `packages/ui` — is a sibling each app reaches via a `tsconfig.json` path + `turbopack.root`, not an npm dependency), Google OAuth deferred, and gateway CORS handled via Spring Cloud Gateway's native `globalcors` config instead of a hand-rolled `CorsWebFilter` bean (the two conflicted and produced duplicate CORS headers that browsers reject). See `implementation-phases.md` for the phase-level exit-criteria view of the same status.
>
> **Phase 2 planning added 2026-08-05** (Tasks 11–18 below). Backend-first, dependency-first ordering, same as Phase 1: Course Service (Java/Spring Boot, same stack as auth-service) lands before either frontend touches courses. **Tasks 11–12 (Course Service backend) are done as of 2026-08-05** — see their status notes below. Tasks 13–15 (both frontends' course pages, integration) are next. Upload Service and Media Service (Tasks 16–17) are **deferred from the start** — no MinIO/S3 or MongoDB is provisioned in `docker/docker-compose.dev.yml` yet, and the phase's own soft-dependency note explicitly allows stubbing media ("accept file, return mock URL"). Lessons carry a plain admin-supplied `video_url` string until that lands. Course Service also denormalizes `instructor_name`/`instructor_bio`/`instructor_avatar_url` directly onto `courses` — there's no instructor directory or role yet (`admin-frontend.md` lists "Instructor Management" as **Future**), so `instructor_id` is just the creating admin/moderator's user id for audit purposes, not a foreign key into a real instructor entity.
>
> **Phase 3 planning added 2026-08-05** (Tasks 19–30 below). Phase 2 is done and verified end-to-end (see status notes on Tasks 11–15). Phase 3 covers Enrollment Service, Payment Service (Paystack, pluggable for Stripe/Flutterwave later), Review Service, and the student/admin frontend pages built on top of them. **Task 18 (extract `backend/shared-java`) is un-deferred and folded in as Task 19** — its own trigger condition ("once a third Java service exists") is met by Enrollment Service. Cross-service reads (Enrollment→Course, Review→Enrollment) are plain internal REST calls, not gRPC — course-service has no gRPC infrastructure and adding it just to satisfy the original architecture doc's unbuilt aspiration isn't worth the new surface area. Payment Service is the first NestJS service in the repo; no ORM, a thin `pg` client + hand-rolled SQL migration runner, mirroring the Java side's Flyway-file convention without pulling in a Java-less equivalent. Certificates, Upload/Media Service, and email/in-app notifications remain out of scope (no backing infrastructure exists yet for any of them) — see the Task 19–30 status notes below as they land.

## Problem Statement
Build a full-stack digital learning platform from scratch. Two Next.js frontends (student + admin), 13 backend microservices (Java/Spring Boot + Node.js/NestJS), Spring Cloud Gateway as the single entry point, and a shared UI library. PostgreSQL, MongoDB, Redis, and RabbitMQ are already running. No Kubernetes/infrastructure work. No service registry — routing is programmatic via config.

---

## Requirements

- **Monorepo structure:** `apps/student`, `apps/admin`, `packages/ui`, `backend/<service-name>/`, `migrations/`
- **Frontend stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, native `fetch`, `useContext` + `useReducer` for state — no TanStack Query, no Zustand, no react-hook-form, no Zod. Minimize external packages
- **Shared UI library:** `packages/ui` — design tokens + primitive components used by both frontends
- **API Gateway:** Spring Cloud Gateway with programmatic route configuration (no Eureka). Service URLs come from environment variables / `application.yml`
- **Backend:** Java/Spring Boot for Auth, Course, Enrollment, Review, Admin services. Node.js/NestJS for User, Upload, Payment, Notification, Live Class, Analytics, Service Request services
- **Inter-service communication:** gRPC for synchronous cross-service calls (where a response is expected); RabbitMQ for asynchronous fire-and-forget events
- **Databases:** Single PostgreSQL instance (multiple databases), single MongoDB instance (multiple databases), Redis and RabbitMQ already running
- **No Kubernetes/infra work**

---

## Background

The project has comprehensive specification documents covering all 13 services, full DB schemas, component specs, and API flows. Key architectural decisions:

- **Spring Cloud Gateway** — programmatic `RouteLocator` bean, service URLs injected via environment variables. `JwtAuthFilter` validates tokens on every protected route by calling Auth Service via gRPC
- **gRPC** — used when a service needs a synchronous response (e.g., gateway validating a JWT, Enrollment Service checking if a course exists)
- **RabbitMQ** — used for domain events where no response is needed (e.g., `user.created` → User Service auto-creates profile)
- **Frontend state** — `useContext` + `useReducer` for auth/UI state; custom `useFetch` hook wrapping native `fetch` for data fetching with loading/error/data states; no external state libraries

---

## Proposed Solution

Build in vertical slices, dependency-first. Each task produces a working, demoable increment.

---

## Task Breakdown

---

### PHASE 0 — Foundation

---

**Task 1: Monorepo Scaffold**

> **Status: ⚠️ Diverged.** No root `package.json`/npm workspaces — the repo root is intentionally a plain container folder, not a project (an earlier attempt to add one for a shared-package TypeScript resolution issue was explicitly rejected). Folder skeleton exists but as `apps/utilities` rather than `packages/ui`, no `.editorconfig`, and `migrations/` doesn't exist as a top-level folder (auth-service's migrations live inside the service itself, at `backend/auth-service/src/main/resources/db/migration/`). A root `README.md` does exist now.

**Objective:** Create the root project structure so every developer can clone, orient, and run everything from a single root.

**Implementation guidance:**
- Initialize root `package.json` with npm workspaces:
  ```json
  {
    "workspaces": ["apps/*", "packages/*"]
  }
  ```
- Create the full folder skeleton:
  ```
  /
  ├── apps/
  │   ├── student/
  │   └── admin/
  ├── packages/
  │   └── ui/
  ├── backend/
  │   ├── gateway-service/
  │   ├── auth-service/
  │   ├── user-service/
  │   ├── course-service/
  │   ├── upload-service/
  │   ├── media-service/
  │   ├── enrollment-service/
  │   ├── payment-service/
  │   ├── review-service/
  │   ├── notification-service/
  │   ├── liveclass-service/
  │   ├── analytics-service/
  │   ├── servicerequest-service/
  │   └── admin-service/
  ├── migrations/
  │   ├── postgres/
  │   └── mongo/
  ├── .gitignore
  ├── .editorconfig
  └── README.md
  ```
- Add `.gitignore` covering `node_modules`, `target/`, `.next/`, `.env*.local`, `*.class`
- Add `.editorconfig` — 2-space indent for JS/TS, 4-space for Java, LF line endings
- Write `README.md` with project overview, folder structure explanation, and "Getting Started" section listing prerequisites and startup order

**Tests:** `npm install` from root resolves workspaces without errors.

**Demo:** Repository cloned → `npm install` from root succeeds → folder tree matches spec above.

---

**Task 2: Shared UI Library (`packages/ui`)**

> **Status: ✅ Done, as `apps/utilities` (`@grammarcetamol/utilities`).** No `tsup` build step — consumed as raw TypeScript source via a `tsconfig.json` path mapping, since there's no npm workspace to publish/link it through (see Task 1). Has its own `node_modules` purely for standalone typechecking (a file outside `apps/admin`/`apps/student` can't resolve into either app's `node_modules`); this doesn't cause a duplicate-React-at-runtime issue since actual bundling still happens inside each consuming app. Component set has grown beyond the original list (added `Mapping`, `useGenericState`) but doesn't have a `tokens-preview.tsx` demo page, and not every component has a dedicated test — only the ones with real logic (`useFetch`, `useGenericState`, `Mapping`) do. See `apps/utilities/README.md`.

**Objective:** Create the shared design system package that both frontends import, covering design tokens and all primitive components.

**Implementation guidance:**
- Initialize `packages/ui` with `package.json` (name: `@grammarcetamol/ui`), TypeScript config, `tsup` for bundling
- Create `src/tokens/index.css` — all CSS custom properties from the design spec:
  - Student palette: `--color-primary: #1E3A5F`, `--color-accent: #F59E0B`, all semantic tokens
  - Admin palette: `--color-accent: #0EA5E9` (overridable via Tailwind theme extension)
  - Typography scale, spacing scale (8px grid), border radius tokens, shadow tokens, animation duration tokens
- Create `src/tokens/index.ts` — JS constants mirroring the CSS tokens (for use in dynamic styles)
- Create a Tailwind CSS preset `src/tailwind-preset.ts` that both apps extend
- Build primitive components (typed with TypeScript, styled with Tailwind, zero external dependencies beyond React):
  - `Button` — props: `variant` (primary/secondary/ghost/destructive), `size` (sm/md/lg), `loading` (boolean), `disabled`, `onClick`, `type`; renders spinner from `Spinner` when loading
  - `Input` — props: `label`, `helperText`, `error`, `prefixIcon`, `suffixIcon`, `type`; password toggle built in; shows error ring on `error` prop
  - `Modal` — props: `open`, `onClose`, `size` (sm/md/lg/fullscreen), `title`; implements focus trap with `useEffect` + `querySelectorAll`; Escape key handler; backdrop click closes
  - `Toast` — props: `type` (success/error/warning/info), `message`, `duration`, `onDismiss`; auto-dismiss via `useEffect` + `setTimeout`
  - `Badge` / `StatusBadge` — props: `variant` (success/warning/error/info/neutral), `size` (sm/md/lg), `dot` (boolean); pill shape
  - `Skeleton` — props: `width`, `height`, `variant` (text/circle/rect); animated shimmer via CSS `@keyframes`
  - `Spinner` — props: `size` (sm/md/lg), `color`; pure CSS animation
  - `Tabs` — props: `tabs: {label, value}[]`, `activeTab`, `onChange`; keyboard navigation (arrow keys)
  - `Dropdown` — props: `trigger`, `items: {label, onClick, icon?}[]`; closes on outside click via `useEffect`
- Export a `cn()` utility function (string concatenation helper, no external lib — simple conditional class merge)
- Export all components from `src/index.ts`

**Tests:** Write a simple render test for each component (React Testing Library or a Storybook story) verifying all variants render without errors and key interactions (Modal closes on Escape, Toast auto-dismisses, Button shows spinner when loading) work correctly.

**Demo:** Both `apps/student` and `apps/admin` import `Button` from `@grammarcetamol/ui` and render all variants. Color tokens visible in a simple reference page at `packages/ui/src/tokens-preview.tsx`.

---

**Task 3: API Gateway (`backend/gateway-service`)**

> **Status: ✅ Done**, with one deliberate deviation: CORS is handled via Spring Cloud Gateway's native `globalcors` YAML config, not a custom `CorsWebFilter` bean as originally planned. The two together produced duplicate `Access-Control-Allow-Origin`/`Access-Control-Allow-Credentials` response headers, which browsers reject outright even when both copies are identical — the request succeeded end-to-end on the backend (and in curl/Postman), only real browser `fetch()` calls failed. See `backend/gateway-service/README.md`.

**Objective:** Stand up Spring Cloud Gateway with programmatic route configuration (no Eureka), JWT validation via gRPC, CORS, and rate limiting. All API traffic must flow through port 8080 from this point forward.

**Implementation guidance:**
- Initialize Spring Boot project with dependencies: `spring-cloud-starter-gateway`, `spring-boot-starter-actuator`, `spring-boot-starter-data-redis-reactive`, `grpc-spring-boot-starter`, `io.jsonwebtoken:jjwt`
- **Programmatic routing** — define a `RouteLocator` bean instead of YAML routes:
  ```java
  @Bean
  public RouteLocator routes(RouteLocatorBuilder builder, GatewayProperties props) {
      return builder.routes()
          .route("auth-service", r -> r.path("/api/auth/**")
              .uri(props.getAuthServiceUrl()))
          .route("user-profile", r -> r.path("/api/users/**")
              .uri(props.getAuthServiceUrl()))
          // ... all other services
          .build();
  }
  ```
- `GatewayProperties` is a `@ConfigurationProperties` bean reading from `application.yml`:
  ```yaml
  gateway:
    auth-service-url: ${AUTH_SERVICE_URL:http://localhost:8081}
    course-service-url: ${COURSE_SERVICE_URL:http://localhost:8083}
    # ... all services
  ```
- **`JwtAuthFilter`** (GatewayFilter applied globally):
  - Extract `Authorization: Bearer <token>` header
  - Call Auth Service gRPC `ValidateToken` synchronously
  - On success: add `X-User-Id`, `X-User-Role`, `X-User-Email` headers to downstream request
  - On failure: return `401 Unauthorized` immediately
  - **Public route whitelist** (skip filter): `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/verify-email`, `GET /api/auth/oauth2/**`, `GET /api/courses/**`, `GET /api/services/**`
- **CORS config** — global `CorsWebFilter` bean allowing origins `http://localhost:3000` (student) and `http://localhost:3001` (admin), all standard headers, credentials: true
- **Rate limiting** — `RequestRateLimiterGatewayFilterFactory` with Redis token bucket:
  - Default: 100 req/min per IP
  - Auth endpoints (`/api/auth/login`, `/api/auth/register`): 5 req/15min per IP
- Expose `/actuator/health` and `/actuator/routes` (for debugging registered routes)

**Tests:**
- Unit: `JwtAuthFilter` — mock gRPC client; valid token passes with correct downstream headers; expired/missing token returns 401; public routes skip filter entirely
- Integration: Start gateway + mock upstream HTTP server; verify routing, CORS headers on response, rate limiter rejects after threshold

**Demo:** `curl http://localhost:8080/actuator/routes` returns all configured routes. `curl -X POST http://localhost:8080/api/auth/login` without token passes through to auth service (not blocked by filter). `curl http://localhost:8080/api/users/me` without token returns 401 from the gateway filter. CORS headers present on preflight OPTIONS request.

---

**Task 4: Database Migrations — All Services**

> **Status: ✅ Superseded by later phases (confirmed 2026-08-18).** The note below ("only `auth_db` exists") was accurate as of Phase 0 but is now historical — every service built since then owns its own `db/migration` directory (`course-service`, `enrollment-service`, `review-service`, `payment-service`, `upload-service`, `notification-service` all have real Flyway/SQL migration files as of this audit). The original plan of one shared top-level `migrations/postgres/`+`migrations/mongo/` folder with `run-postgres.sh`/`run-mongo.sh` was never adopted — each service manages its own schema in-repo instead, same pattern as `auth-service` set from the start. `users.status` is still a native Postgres `ENUM`, not `VARCHAR + CHECK` — see `database-schema-and-migrations.md`'s status note and `backend/auth-service/README.md`'s schema-notes section.
>
> Original note, left for history: "Partial — only `auth_db` exists, since no other service has been built yet."

**Objective:** Create and run all database schemas so every service has its tables and indexes ready before service code touches the database.

**Implementation guidance:**
- Under `migrations/postgres/`, one subfolder per service:
  ```
  migrations/postgres/
  ├── auth_db/V1__auth_initial_schema.sql
  ├── auth_db/V3__add_profile_columns.sql
  ├── course_db/V1__course_initial_schema.sql
  ├── upload_db/V1__upload_initial_schema.sql
  ├── enrollment_db/V1__enrollment_initial_schema.sql
  ├── payment_db/V1__payment_initial_schema.sql
  ├── review_db/V1__review_initial_schema.sql
  ├── notification_db/V1__notification_initial_schema.sql
  └── admin_db/V1__admin_initial_schema.sql
  ```
- Copy all SQL scripts exactly from the database spec document into their respective files (all scripts are idempotent — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- Under `migrations/mongo/`:
  ```
  migrations/mongo/
  ├── 001_media_initial.js
  ├── 001_liveclass_initial.js
  ├── 001_analytics_initial.js
  └── 001_servicerequest_initial.js
  ```
- Write `migrations/run-postgres.sh`:
  ```bash
  #!/bin/bash
  # Creates databases if not exist, then runs migrations in dependency order
  for db in auth_db course_db upload_db enrollment_db payment_db review_db notification_db admin_db; do
    psql -U $PGUSER -h $PGHOST -c "CREATE DATABASE $db;" 2>/dev/null || true
    psql -U $PGUSER -h $PGHOST -d $db -f migrations/postgres/${db}/V1__*
  done
  ```
- Write `migrations/run-mongo.sh` — runs each `.js` file via `mongosh`
- Write `migrations/README.md` — documents env vars required, execution order rationale, and how to reset

**Tests:** Run both scripts once → verify all tables/collections exist. Run both scripts a second time → zero errors (idempotency confirmed). Query `information_schema.tables` for each PostgreSQL database and `show collections` + `getIndexes()` in each MongoDB database.

**Demo:** `bash migrations/run-postgres.sh` and `bash migrations/run-mongo.sh` complete with no errors. Connect to `auth_db` → `\dt` shows `users`, `refresh_tokens`, `jwt_blacklist`. Connect to `media_db` in MongoDB → `db.media_assets.getIndexes()` returns the defined indexes.

---

### PHASE 1 — Identity, Access & User Management

---

**Task 5: Auth Service — Registration, Email Verification & Login**

> **Status: ✅ Done.** All listed endpoints implemented and verified working (register, verify-email, resend-verification, login, logout, refresh, forgot/reset-password).

**Objective:** Build the Auth Service with secure registration, email verification, and JWT login so users can create and access accounts.

**Implementation guidance:**
- Initialize Spring Boot project in `backend/auth-service/` with: `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-security`, `spring-boot-starter-amqp`, `spring-boot-starter-mail`, `jjwt`, `postgresql` driver, `spring-boot-starter-data-redis`
- Connect to `auth_db` (port 5432, database `auth_db`)
- Implement JPA entities: `User`, `RefreshToken`, `JwtBlacklist` — map to schemas from Task 4
- Implement services and controllers:
  - `POST /api/auth/register` — validate input (email format, password min 8 chars mixed case + number), bcrypt hash (cost 12), create `User` with status `pending_verification`, generate 24h email token, publish `user.created` to RabbitMQ `user.exchange` routing key `user.created`, queue verification + welcome emails
  - `GET /api/auth/verify-email?token=` — validate token expiry, transition status to `active`, publish `user.verified`
  - `POST /api/auth/resend-verification` — Redis rate limit: 1 req/60s per email
  - `POST /api/auth/login` — check status, check lockout (`locked_until`), validate password, on success generate JWT access (15 min, RSA-signed) + refresh token (7 days, stored hashed), return both as httpOnly cookies; publish `user.login`; on 5th failed attempt set `locked_until = NOW() + 15min`, publish `user.locked`
  - `POST /api/auth/logout` — add JWT `jti` to Redis blacklist (TTL = remaining token lifetime), revoke refresh token in DB, publish `user.logout`
  - `POST /api/auth/refresh` — validate refresh token hash, rotate (revoke old row, insert new), return new access token cookie
  - `POST /api/auth/forgot-password` — generate reset token (Redis, TTL 1h), queue email
  - `POST /api/auth/reset-password` — validate Redis token, update password hash, delete all refresh tokens for user
- RabbitMQ: Declare `user.exchange` (topic type) on startup via `@Bean Queue`/`Exchange`/`Binding`
- JWT: use RSA key pair — private key for signing (auth service only), public key shared with gateway for verification

**Tests:**
- Unit: Password hashing correctness, JWT claims encoding, lockout threshold logic, token expiry calculation
- Integration: Full `register → verify → login → logout → refresh` sequence against real `auth_db` and Redis
- Security: Attempt login after lockout → 423; attempt access with blacklisted token → 401 at gateway; re-run verification link after use → 410 Gone

**Demo:** `POST /api/auth/register` → user created. Verification email sent (check mail logs/MailHog). `GET /api/auth/verify-email?token=xxx` → status becomes `active`. `POST /api/auth/login` → httpOnly cookies set. `POST /api/auth/logout` → cookies cleared. All calls via `localhost:8080/api/auth/**`.

---

**Task 6: Auth Service — Google OAuth & gRPC Token Validation Endpoint**

> **Status: ⚠️ Half done.** gRPC (`ValidateToken`, `GetUserById` on `:9091`) and the JWKS endpoint are implemented and working — the gateway's `JwtAuthFilter` calls this in production use. **Google OAuth is not implemented and is intentionally deferred** — the user hasn't set up a Google Cloud OAuth client yet. Don't treat its absence as a gap; revisit once provider credentials exist.

**Objective:** Add Google OAuth2 login and expose a gRPC server so the gateway (and future services) can synchronously validate tokens without HTTP round-trips.

**Implementation guidance:**
- Add `spring-security-oauth2-client` dependency
- Configure Google OAuth2 in `application.yml` with `client-id` and `client-secret` from env vars
- Implement `OAuth2SuccessHandler`:
  - Extract email from Google profile
  - Upsert `User` (create if new with status `active` and `email_verified = true`; find by email if existing)
  - Generate JWT pair, set httpOnly cookies
  - Redirect to `returnUrl` from session state (default: frontend dashboard)
- Implement gRPC server on port `9091`:
  - Define `auth.proto` with:
    ```protobuf
import "auth.proto";
    service AuthService {
      rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
      rpc GetUserById(GetUserByIdRequest) returns (UserResponse);
    }
    ```
  - `ValidateToken`: verify RSA signature → check Redis blacklist → check expiry → return `{ valid, userId, email, roles }`
  - `GetUserById`: fetch user row by UUID → return `{ id, email, status, emailVerified }`
- Update gateway's `JwtAuthFilter` to call this gRPC endpoint (replace any local JWT parsing in the gateway)
- Expose the RSA public key via `GET /api/auth/.well-known/jwks.json` for future use

**Tests:**
- Unit: OAuth upsert logic — new user created, existing user found, email conflict handled
- gRPC: `ValidateToken` with valid / expired / blacklisted / malformed tokens → correct responses
- Integration: Mock Google OAuth callback → user created → JWT returned → gRPC validates the JWT successfully

**Demo:** Navigate to `http://localhost:8080/api/auth/oauth2/authorization/google` → Google login → redirected to student frontend dashboard with valid session cookie. Gateway's gRPC call to `ValidateToken` returns valid user for subsequent protected requests.

---

**Task 7: Auth Service — User Profile Management**

> **Status: ✅ Done.** `UserProfileService`/`UserProfileController` implemented as specified, all endpoints working, `SuperAdminSeeder` runs on `ApplicationReadyEvent` as designed.

**Objective:** Implement profile initialisation and management directly inside auth-service. There is no separate user-service microservice — all profile data lives in the `users` table in `auth_db`.

**Context:** The `users` table has all profile columns added by V3 migration (`role`, `full_name`, `phone`, `avatar_url`, `country`, `timezone`, `bio`, `learning_goals`, `date_of_birth`, `preferences`). The `RoleName` Java enum (`SUPER_ADMIN`, `STUDENT`, `MODERATOR`, `CUSTOMER_SUPPORT`) is stored as `@Enumerated(EnumType.STRING)` on the `User` entity.

**Implementation guidance:**
- `UserProfileService` in `backend/auth-service/` operates directly on `UserRepository`:
  - `initProfile(userId, fullName, roleName)` — called by `AuthService` synchronously after saving the user; sets `fullName` and `role` on the existing user record; no message queue or separate table
  - `getMyProfile(userId)` — fetch `User` by id
  - `updateMyProfile(userId, dto)` — patch allowed fields: `fullName`, `phone`, `country`, `timezone`, `bio`, `learningGoals`
  - `getAllUsers(query, page, limit)` — paginated search by name or email
  - `getUserById(id)` — admin lookup by profile UUID (same as auth user id)
  - `updateUserStatus(userId, status)` — admin status change, validates against `User.Status` enum
- `UserProfileController` in `backend/auth-service/` exposes:
  - `GET /api/users/me` — any authenticated user; reads `sub` claim from JWT via `@AuthenticationPrincipal Jwt`
  - `PATCH /api/users/me` — any authenticated user
  - `GET /api/users` — `SUPER_ADMIN` or `MODERATOR` only (`@PreAuthorize`)
  - `GET /api/users/:id` — `SUPER_ADMIN` or `MODERATOR` only
  - `PATCH /api/users/:id/status` — `SUPER_ADMIN` only
- All endpoints use Spring Security JWT resource server — no `X-Internal-Token` header, no separate auth check needed
- `SuperAdminSeeder` runs on `ApplicationReadyEvent`, calls `authService.registerInternal(email, password, "Super Admin", "SUPER_ADMIN")` which saves the user and calls `userProfileService.initProfile(...)` in one transaction
- Gateway routes `/api/users/**` → auth-service (same host:port as `/api/auth/**`); remove `user-service-url` from gateway config

**Tests:**
- Unit: `UserProfileService` — `initProfile` with unknown role defaults to STUDENT; `updateMyProfile` only patches supplied fields; `updateUserStatus` rejects invalid status values
- Unit: `AuthService` — `register` calls `initProfile` with STUDENT role; `registerInternal` calls `initProfile` with provided role; duplicate email is no-op
- Integration: `POST /api/auth/register` → `GET /api/users/me` via gateway returns profile with `role: STUDENT` and `fullName` set

**Demo:** `POST /api/auth/register` → `GET /api/users/me` returns user row with `role: STUDENT`. Login as super admin → role in JWT is `SUPER_ADMIN`. Admin `PATCH /api/users/:id/status` body `{"status":"SUSPENDED"}` suspends the account.

---

**Task 8: Student Frontend — Auth Context & Auth Pages**

> **Status: ✅ Done** (updated 2026-08-18 — the "Not built" caveat below is stale, confirmed via code review). All five auth pages built (login, register, forgot-password, reset-password, verify-email), `AuthContext` + `useFormState` + `apiFetch`-with-refresh-retry implemented per the no-external-state-library constraint. Additionally now rejects login if the account isn't a `STUDENT` role (cross-portal guard, not in the original scope). `middleware.ts` is now `proxy.ts` (Next.js 16 renamed the convention). `Navbar.tsx` (`apps/student/components/Navbar.tsx`, guest-vs-authenticated conditional via `useAuth`) is built and wired into the `(main)` layout; the landing page (`apps/student/app/(main)/page.tsx`, 160 lines) is real, not a placeholder; `/profile` (`apps/student/app/(main)/profile/page.tsx`, 169 lines) exists. None of this was flagged as missing in prior verification passes for Phase 3 — it was simply never revisited after this task's original write-up.

**Objective:** Build the student Next.js app with an `AuthContext`, custom data-fetching hooks, and all auth pages (register, login, verify email, forgot password) wired through the gateway.

**Implementation guidance:**
- Initialize Next.js 14 (App Router) in `apps/student/` — TypeScript, Tailwind CSS
- Configure Tailwind to extend `@grammarcetamol/ui` tailwind preset (student accent: `#F59E0B`)
- **No external state library, no react-hook-form, no Zod, no TanStack Query**
- Create `lib/api.ts` — wrapper around native `fetch`:
  ```typescript
  export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      credentials: 'include', // send httpOnly cookies
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
    if (!res.ok) throw await res.json();
    return res.json();
  }
  ```
- Create `hooks/useFetch.ts` — generic hook returning `{ data, loading, error, refetch }` using `useEffect` + `useState`
- Create `contexts/AuthContext.tsx`:
  ```typescript
  interface AuthContextValue {
    user: Student | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
  }
  ```
  - `useReducer` for state: actions `SET_USER`, `CLEAR_USER`, `SET_LOADING`
  - On mount: call `GET /api/users/me` to rehydrate session from cookie
  - Wrap `app/layout.tsx` with `<AuthProvider>`
- Create `middleware.ts` — protect routes `/dashboard`, `/my-courses/**`, `/profile/**`, `/checkout/**`, `/notifications`; redirect to `/login?returnUrl=<path>` if no session
- Build pages using only `@grammarcetamol/ui` primitives + native HTML forms:
  - `/register` — controlled inputs with `useState`, inline validation (email regex, password rules checked on blur), password strength indicator (CSS bar), confirm password match, T&Cs checkbox, Google OAuth button, submit calls `POST /api/auth/register`
  - `/login` — email + password, Google OAuth button, "Forgot Password" link, reads `returnUrl` from `useSearchParams`, on success calls `refreshUser()` then `router.push(returnUrl)`
  - `/forgot-password` — email input, success state, 60s cooldown timer via `useState` + `useEffect`
  - `/verify-email` — reads `?token=` from URL, calls API on mount, renders success / expired / already-verified states with resend option
- Build `Navbar` — transparent on hero scroll → solid on scroll (IntersectionObserver); conditional guest vs authenticated rendering via `useAuth()` hook

**Tests:**
- Unit: `AuthContext` reducer — all action types produce correct state
- Unit: Inline form validation logic — email regex, password rules, confirm match
- Integration: `useFetch` hook — loading state on mount, data state on resolve, error state on reject
- E2E: Register → toast confirmation → verify email → login → redirected to `/dashboard` → logout → redirected to `/login`

**Demo:** Open `localhost:3000/register`, fill form with inline validation feedback, submit. Toast appears. Verify email via link. Login redirects to dashboard. Attempt to visit `/dashboard` while logged out → redirected to `/login?returnUrl=/dashboard` → after login, lands on dashboard.

---

**Task 9: Admin Frontend — Auth Context, Shell Layout & Auth Pages**

> **Status: ✅ Done** (updated 2026-08-18 — superseded by Task 26 for the shell, confirmed via code review). Auth pages (login, forgot-password, reset-password — no register, by design) and `AuthContext` (with `hasPermission`) are built and working, plus the same cross-portal login rejection as the student app. **The dashboard-shell gap is closed**: `apps/admin/app/(dashboard)/layout.tsx` renders real `Sidebar`/`TopHeader` components, and `Breadcrumb.tsx` exists and is rendered from `TopHeader` — this landed as part of Task 26 (Admin Frontend Shell & Shared Primitives) rather than being revisited here, same pattern as Task 18 being superseded by Task 19. No dedicated `UIContext` exists — toasts still use the shared `ToastContext` from `apps/utilities`, which was always the intended simplification, not a gap. **The "known bug" no longer exists**: `computeHasPermission` in `apps/admin/lib/auth.api.ts:22-28` checks `roles.includes('SUPER_ADMIN')` (uppercase), matching the backend — either fixed silently at some point or the original bug report was itself mistaken; either way, current code is correct. `middleware.ts` is now `proxy.ts` (Next.js 16 renamed the convention), and additionally checks role from the JWT payload, not just cookie presence.

**Objective:** Build the admin Next.js app with an `AuthContext`, the persistent shell layout (sidebar + header), and auth pages — using the same patterns as the student frontend.

**Implementation guidance:**
- Initialize Next.js 14 (App Router) in `apps/admin/` — TypeScript, Tailwind CSS
- Configure Tailwind to extend `@grammarcetamol/ui` preset, override accent to `#0EA5E9` (admin theme), override sidebar background to `#0F172A`
- Same `lib/api.ts` and `hooks/useFetch.ts` pattern as student frontend
- Create `contexts/AuthContext.tsx` — same shape as student but `user` type is `AdminUser` with `permissions: string[]`; add `hasPermission(resource: string, action: string): boolean` derived from permissions array
- Create `contexts/UIContext.tsx`:
  ```typescript
  interface UIContextValue {
    sidebarCollapsed: boolean;
    toggleSidebar: () => void;
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
  }
  ```
  - `useReducer` for toast queue (add with generated id, remove by id, auto-remove after duration)
- Create `middleware.ts` — all routes except `/login`, `/forgot-password` require auth + admin/moderator role
- Build shell layout (`app/(dashboard)/layout.tsx`):
  - `Sidebar` component — nav groups from spec (Overview, Education, People, Business, Insights, Communication, System); each nav item checks `hasPermission()` before rendering; active route via `usePathname()`; collapse toggle stores preference in `localStorage`; icon-only mode when collapsed
  - `TopHeader` — search bar (placeholder, Cmd+K stub), notification bell with unread count badge (stub for now), user avatar dropdown (Profile link, Logout button calling `POST /api/auth/logout`)
  - `Breadcrumb` — derives path segments from `usePathname()`, renders as linked segments
- Build pages:
  - `/login` — clean centered card, email + password, no Google OAuth; submit calls `POST /api/auth/login`; on success `refreshUser()` then `router.push('/')`
  - `/forgot-password` — same pattern as student
  - `/` (Dashboard shell) — `StatCard` skeletons in a 4-column grid (data wired in Phase 5); Quick Actions bar with stubbed buttons; "Welcome, [Name]" heading from `useAuth()`

**Tests:**
- Unit: `hasPermission()` — super admin has all permissions; moderator missing financial/settings permissions
- Unit: `UIContext` toast reducer — add, auto-remove, remove by id
- Integration: Login as moderator → sidebar renders without Revenue/Settings items → direct URL to `/settings` → redirected to dashboard with access denied toast
- E2E: Login → shell renders → logout → redirected to login

**Demo:** Login as super admin at `localhost:3001` — full sidebar visible. Login as moderator — Revenue, Settings, Logs items hidden. Navigate to `/courses` from sidebar — breadcrumb shows "Dashboard > Courses". Sidebar collapse toggle shrinks to icon-only mode.

---

**Task 10: End-to-End Auth Integration**

> **Status: ✅ Done**, originally verified live only (not via an automated E2E suite): gateway → auth-service gRPC header injection confirmed, `returnUrl` redirect on the student route guard implemented, `fetchWithRefresh`-equivalent (401-triggered single retry) implemented in `apiFetch`. Beyond the original scope: cross-portal login rejection was added this phase after being flagged as a gap — a student's valid credentials no longer grant access to the admin portal (and vice versa), enforced both at login time (`AuthContext`) and via the route guard reading role from the JWT (defense-in-depth, not cryptographically verified — the real enforcement remains the backend's `@PreAuthorize` checks). **Update (2026-08-18):** an automated suite now also covers this — `backend/integration-tests/auth-flow.integration.spec.ts` (register/duplicate-409/wrong-password-401/login-before-verification) and `auth-boundary.integration.spec.ts` (401/403 sweep across services) both landed as part of Task 30, closing the "not via an automated E2E suite" gap this task's status note originally called out.

**Objective:** Validate the complete auth path across gateway → auth service → user service → both frontends, including edge cases and the `returnUrl` redirect flow.

**Implementation guidance:**
- Confirm gateway's `JwtAuthFilter` correctly calls Auth Service gRPC `ValidateToken` and injects `X-User-Id`, `X-User-Role` headers; verify user service reads these headers (not the raw JWT) for authorization
- Implement `returnUrl` redirect on student frontend: when unauthenticated user attempts to access a protected resource (e.g., clicks "Enroll"), middleware stores intent → redirects to `/login?returnUrl=/checkout/course-id` → after login, `router.push(returnUrl)` → add contextual banner: "Please log in to continue your enrollment"
- Add `X-Request-Id` header injection in gateway (UUID per request) for tracing through logs
- Validate RabbitMQ event chain: `POST /api/auth/register` → `user.created` published → user service consumes → profile exists in `user_db` within 1 second
- Handle token refresh transparently in both frontends: add a `fetchWithRefresh` wrapper — on 401 response, call `POST /api/auth/refresh`, then retry the original request once; on second 401, clear auth context and redirect to login
- Write a `useAuth()` convenience hook in both frontends that reads from `AuthContext` (throws if used outside provider)

**Tests:**
- Integration: Full chain — student frontend form submit → gateway → auth service → RabbitMQ → user service → `GET /api/users/me` returns profile
- Token refresh: Simulate expired access token → `fetchWithRefresh` transparently refreshes → original request succeeds
- Load: `POST /api/auth/login` via gateway at 100 concurrent requests → all succeed; at 200 req/min per IP → rate limiter engages correctly
- Security: Blacklisted token after logout returns 401 at gateway

---

### PHASE 2 — Course Content & Discovery

---

**Task 11: Course Service — Bootstrap, Schema & Header-Based AuthZ**

> **Status: ✅ Done.** `backend/course-service` scaffolded exactly as planned — Spring Boot 3.2.5/Java 21, no security starter, no gRPC. `CurrentUserArgumentResolver` + `CurrentUser` record (with `isAdminOrModerator()`/`canModify(ownerId)` helpers) read `X-User-Id`/`X-User-Role` directly, registered via a plain `WebMvcConfigurer`. `course_db` needed manual creation on the existing Postgres volume (`docker/postgres-init/01-create-databases.sh` was added for fresh volumes, but init scripts only run once against an empty data directory — an already-initialized volume needs the one-off `CREATE DATABASE` documented in `backend/course-service/README.md`). Flyway migration verified applying successfully against the real local Postgres instance. The embedded Tomcat listener itself couldn't be verified live in the agent sandbox that did this work (the same pre-existing Windows loopback-socket issue documented in the root README for the other two services) — Flyway/Hibernate initialize and connect fine before that point, so the DB/JPA layer is confirmed working; the HTTP layer needs a live run on a normal dev machine to fully confirm.

**Objective:** Stand up `backend/course-service/` as a working, empty-but-wired Spring Boot service — same conventions as `auth-service` — with its own database and a way to trust the gateway's identity headers instead of re-parsing JWTs.

**Implementation guidance:**
- Initialize Spring Boot 3.2.5 / Java 21 project at `backend/course-service/`, `pom.xml` mirroring `auth-service`'s: `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-validation`, `spring-boot-starter-actuator`, `postgresql`, `flyway-core` + `flyway-database-postgresql`, `lombok`. **No** `spring-boot-starter-security`, **no** `jjwt`, **no** gRPC deps — course-service never sees a raw JWT.
- `application.yml`: `server.port: 8083` (matches gateway's `COURSE_SERVICE_URL` default already in `backend/gateway-service/src/main/resources/application.yml`), datasource pointed at `course_db` on the existing Postgres instance (port 5433 externally, `platform`/`platform`), Flyway enabled, `management.endpoints.web.exposure.include: health,info`.
- **Identity from headers, not tokens:** the gateway's `JwtAuthFilter` already validates the JWT and injects `X-User-Id`, `X-User-Role`, `X-User-Email`, `X-Request-Id` before forwarding (see `backend/gateway-service/.../JwtAuthFilter.java`). Course-service must trust those headers on requests that reach it — it is never reachable directly by a browser. Implement a small `CurrentUserArgumentResolver` (or a `@RequestHeader` on each admin-only endpoint, whichever reads cleaner once controllers exist) that extracts `X-User-Id`/`X-User-Role` into a `CurrentUser record(UUID id, Set<String> roles)`. No Spring Security filter chain needed — this is a plain Spring MVC `HandlerMethodArgumentResolver`, not an authentication framework, since there's nothing left to authenticate.
- Role enforcement is a plain `if (!currentUser.roles().contains("SUPER_ADMIN") && !currentUser.roles().contains("MODERATOR")) throw new ForbiddenException()` at the top of write-endpoint service methods — no `@PreAuthorize`, since there's no `Authentication` object in the security context to evaluate it against.
- `GlobalExceptionHandler` mirroring `auth-service`'s, mapping domain exceptions (`CourseNotFoundException`, `ForbiddenException`, `CoursePublishValidationException`, `CourseDeletionBlockedException`) to the same `ApiResponse` envelope shape auth-service uses.

**Tests:** Context loads with a real `course_db` connection (Testcontainers or the local Postgres instance). `/actuator/health` returns `UP`.

**Demo:** `mvn spring-boot:run` in `backend/course-service/` starts cleanly on `:8083`, connects to `course_db`, Flyway reports "no migrations to apply" on second run.

---

**Task 12: Course Service — Categories, Courses, Modules & Lessons**

> **Status: ✅ Done**, with a few real deviations from the guidance below:
> - There's no separate admin-listing endpoint/path. `GET /api/courses` does double duty: non-admins always get `status=published` regardless of what they pass; admins/moderators may pass any `status` (or omit it for "all statuses"), which is what the admin `/courses` list page (Task 14) will use. One query, one native `search()` repository method, instead of two.
> - `resources` and `tags`/`course_tags` tables exist in the migration (matching the spec) but have no JPA entities or controllers — nothing in this task's scope writes to them yet. Adding entities for unused tables felt like exactly the kind of premature abstraction worth skipping; see `backend/course-service/README.md`.
> - Publish validation and the delete guard are unit-tested with Mockito (`CourseServiceTest`, `CourseStructureServiceTest`, 13 tests, all passing) — no Testcontainers/real-Postgres integration test yet, since the catalog's `plainto_tsquery` full-text search needs real Postgres (not H2) to run at all. That's its own follow-up if an integration suite is wanted.
> - `ApiResponse`, the exception-handler pattern, and the header-auth resolver are local copies, not shared with `auth-service` — see Task 18 (deferred by explicit user decision, 2026-08-05).
> - **Gateway bug found and fixed during Task 14 live verification (2026-08-05):** `JwtAuthFilter`'s original `GET /api/courses/**`/`GET /api/categories/**` public whitelist skipped token validation entirely, so a logged-in admin viewing their own **draft** course looked identical to an anonymous guest by the time the request reached course-service — which correctly 404s a non-published course for anyone it can't identify as the owner. Fixed by splitting the whitelist into `PUBLIC_ROUTES` (never attempt auth) and a new `OPTIONALLY_AUTHENTICATED_ROUTES` category (attempt auth if a token is present; fail open to anonymous on no/invalid/unverifiable token, never a 401/503). See `backend/gateway-service/README.md` and `JwtAuthFilterTest`.

**Objective:** Implement the full course-authoring and catalog-browsing backend: categories, course CRUD with draft/review/published/archived lifecycle, versioning, module/lesson trees, and a searchable public catalog.

**Implementation guidance:**
- **Migration `V1__course_initial_schema.sql`** — adapted from `database-schema-and-migrations.md` §3.3 with two fixes:
  - The spec's `CREATE TYPE lesson_type AS ('video', 'text', 'quiz', 'resource')` is invalid Postgres (that's composite-type syntax, not enum — needs `AS ENUM (...)`). Use `VARCHAR(20) NOT NULL DEFAULT 'video' CHECK (type IN ('video','text','quiz','resource'))` instead, consistent with how `courses.status`/`courses.difficulty` already do it in the same schema, and consistent with why `auth_db` avoided native Postgres enums for JDBC bind-parameter reasons (see `backend/auth-service/README.md`).
  - Add `instructor_name VARCHAR(255) NOT NULL`, `instructor_bio TEXT`, `instructor_avatar_url VARCHAR(500)` to `courses` (beyond the original spec) — see the Phase 2 status note at the top of this document for why.
  - Seed a handful of default categories (English for Beginners, Business English, IELTS/TOEFL Prep, Conversation Practice, Grammar & Writing) as an idempotent `INSERT ... ON CONFLICT (slug) DO NOTHING` at the end of V1, so the catalog isn't empty on first boot.
- **Entities:** `Category`, `Course`, `CourseVersion`, `CourseModule` (named to avoid colliding with `java.lang.Module`, maps to the `modules` table), `Lesson`, `Resource`, `Tag` — standard JPA, `@Enumerated` not needed since lifecycle/type fields are plain strings validated at the service layer.
- **`CategoryController`** — `GET /api/categories` (public, flat or nested by `parent_id`), `POST /api/categories` (admin-only).
- **`CourseController`**:
  - `GET /api/courses` — public. Query params: `category`, `difficulty`, `price` (`free`/`paid`), `q` (search), `sort`, `page`, `limit`. Search uses the `idx_courses_search` GIN/tsvector index via a native query (`@Query(nativeQuery = true)` with `plainto_tsquery`). Only returns `status = 'published'` courses to unauthenticated/student callers.
  - `GET /api/courses/{slugOrId}` — public. Full detail: course fields, modules with lessons. Non-preview lesson `video_url` is stripped from the response for anyone who isn't the owning admin/moderator (enrollment-based unlocking is Phase 3 — for now "enrolled" doesn't exist, so only `is_preview` lessons expose their URL).
  - `POST /api/courses` — SUPER_ADMIN/MODERATOR. Creates `status = 'draft'`. `instructor_id` set from `X-User-Id`.
  - `PATCH /api/courses/{id}` — owner or SUPER_ADMIN. Writes a `course_versions` snapshot row (JSONB of the pre-change state) before applying updates whenever the course is already `published`.
  - `POST /api/courses/{id}/publish` — validates: cover image present, price set (or explicitly free), at least one module with at least one lesson, all lesson `video_url`s present for `type = 'video'` lessons. Fails with a structured list of missing items (`CoursePublishValidationException`) instead of a generic 400. Transitions `draft`/`review` → `published`, sets `published_at`.
  - `POST /api/courses/{id}/archive` — sets `status = 'archived'`, hidden from catalog, existing structure retained.
  - `DELETE /api/courses/{id}` — blocked (`CourseDeletionBlockedException` → 409) if `enrollment_count > 0` (the column exists now; nothing increments it until Enrollment Service ships in Phase 3, but the guard is real and future-proof). Otherwise hard-deletes (cascades to modules/lessons/resources/course_tags via FK).
  - `GET /api/courses/{id}/versions` — owner or SUPER_ADMIN, lists `course_versions`. `POST /api/courses/{id}/versions/{versionId}/restore` — restores the snapshot as the current state (writes a new version first, so restore is itself undoable).
- **`CourseModuleController` / `LessonController`** (nested under `/api/courses/{courseId}/modules` and `.../modules/{moduleId}/lessons`) — CRUD + a `PATCH .../reorder` endpoint taking an ordered list of ids and rewriting `position` in one transaction.
- **Gateway wiring:** add a `categories-service` route (reuses `courseServiceUrl`) and a `GET /api/categories/**` entry to `JwtAuthFilter.PUBLIC_ROUTES` — the existing `course-service` route and `GET /api/courses/**` public entry are already in place from earlier prep work, no change needed there.

**Tests:**
- Unit: publish validation — missing cover image / no lessons / video lesson missing URL each produce the expected error list; passes when everything required is present.
- Unit: delete guard — `enrollment_count > 0` throws; `= 0` deletes.
- Unit: catalog query building — free/paid price filter, category filter, search term all narrow results correctly (use an in-memory/Testcontainers Postgres, since `plainto_tsquery` needs real Postgres, not H2).
- Integration: create (draft) → add module → add lesson → publish → appears in `GET /api/courses` → `GET /api/courses/{slug}` shows full curriculum.

**Demo:** `POST /api/courses` (as seeded super admin) → `POST .../modules` → `POST .../lessons` → `POST .../publish` → `curl localhost:8080/api/courses` (no auth) shows the course. `DELETE` on a course with `enrollment_count = 0` succeeds; manually setting `enrollment_count = 1` in `psql` and retrying returns 409.

---

**Task 13: Student Frontend — Course Catalog, Detail Pages & Landing Hero**

> **Status: ✅ Done**, verified live end-to-end against the real stack (Postgres → course-service → gateway → Next.js), not just built. Real deviations from the guidance below:
> - Category filter is single-select (clickable pills with a radio-style indicator), not checkboxes — the backend's `category` query param only accepts one slug at a time, and building fake multi-select UI over a single-select API would be misleading.
> - `/courses` syncs `category`/`difficulty`/`price`/`q`/`sort` to the URL via `router.replace`; `page` is deliberately excluded (it's a "Load more" accumulator, not a bookmarkable dimension).
> - Landing page (`/`) got hero + featured-courses only — the full 7-service-card/testimonials/FAQ treatment from `student-frontend.md` needs the Service Request catalog (Phase 5), out of scope here.
> - Added `apps/student/vitest.config.ts` (didn't exist before — this app had zero test infra prior to this task) with a path alias for `@grammarcetamol/utilities`, matching `apps/admin`'s setup.
> - **Found and fixed two pre-existing bugs during live verification, not scoped to this task but blocking it:**
>   1. `apiFetch` (`apps/utilities/src/lib/api.ts`) unconditionally called `res.json()`, which throws on a `204 No Content` response — every `DELETE` and `reorder` endpoint added in Task 12 would have crashed the calling UI. Now returns `undefined` for 204. Also extended `ApiError` to carry the parsed response body (`.body`), needed to surface the structured publish-validation error list.
>   2. `AuthContext.refreshUser()` on **both** frontends dispatched `GET /api/users/me`'s raw response (`{id, role, ...}`) directly as if it matched the login response's shape (`{userId, roles}`) — meaning `user.roles` was `undefined` after every page refresh, on both portals, since Phase 1. Fixed by mapping the response shape explicitly in both `AuthContext.tsx` files. (This is also why the admin `hasPermission` lowercase-vs-uppercase bug noted in Task 9 was never actually observable in its full effect — `roles` was frequently just missing entirely.)

**Objective:** Replace the placeholder landing page and build the public course browsing experience, using the same `apiFetch`/`useFetch` patterns already established in Task 8 — no new state library.

**Implementation guidance:**
- `hooks/useCourses.ts` / `hooks/useCourse.ts` — thin wrappers over `useFetch` for the list and detail endpoints, building the query string from filter state.
- `/courses` — filter sidebar (category checkboxes from `GET /api/categories`, difficulty radio, free/paid toggle) driven by `useReducer` + synced to the URL via `useSearchParams`/`router.replace` (so filters survive refresh/share); search input (debounced); sort dropdown; `CourseCard` grid using `@grammarcetamol/utilities` primitives; a "Load more" button appending pages (plain pagination, not `IntersectionObserver` infinite scroll — matches the no-external-library constraint and keeps behavior predictable).
- `/courses/[slug]` — full description, learning objectives, target audience, prerequisites, curriculum accordion (locked lock-icon rows for non-preview lessons), instructor card (`instructor_name`/`instructor_bio`/`instructor_avatar_url` straight off the course response), sticky price card with an "Enroll" button that — since Enrollment Service doesn't exist until Phase 3 — routes to `/login?returnUrl=/courses/[slug]` for guests and shows a disabled "Coming soon" state for logged-in students (no dead-end 404, no fake purchase flow).
- `/` (Landing) — hero section, featured-courses carousel pulling `GET /api/courses?sort=enrollment_count&limit=6`, replacing the current placeholder noted in `README.md`. Full 7-service-card/testimonials/FAQ treatment from `student-frontend.md` is out of scope here (those depend on the Service Request catalog, Phase 5) — just hero + featured courses.

**Tests:**
- Unit: filter-state reducer — each filter action narrows the querystring correctly; clearing resets to defaults.
- Unit: curriculum accordion — preview lessons show a play affordance, non-preview show a lock icon, independent of auth state (since enrollment-based unlocking isn't wired yet).
- Integration: `useCourses` — loading → data → refetch-on-filter-change.

**Demo:** `localhost:3000/courses` shows the seeded categories as filters and any published courses; filtering by category/difficulty updates the URL and results; clicking a card opens `/courses/[slug]` with full curriculum and a working "Enroll" CTA that redirects appropriately for guests vs. logged-in students.

---

**Task 14: Admin Frontend — Course Management (List, Create, Content Tree)**

> **Status: ✅ Done**, verified live end-to-end via the browser as the seeded super admin: created a draft, attempted to publish (correctly blocked with the full structured error list, not just the first error), added a module + lesson via the Content tab, edited the lesson to add a `videoUrl` inline, published successfully, and confirmed the course appeared instantly on the public student catalog. Real deviations from the guidance below:
> - `/courses/create` is one page with two sections (Course Info, Pricing) — not a literal multi-step wizard with resume-later autosave, per the deliberate simplification flagged in this task's own guidance.
> - Content tab reordering is up/down buttons, not drag-and-drop, per this task's own guidance.
> - `CourseForm` (`apps/admin/components/CourseForm.tsx`) is shared between create and edit rather than duplicated.
> - **Found and fixed a real gateway bug during live verification:** `JwtAuthFilter`'s `GET /api/courses/**`/`GET /api/categories/**` public whitelist skipped token validation entirely, so a logged-in admin viewing their own **draft** course via `GET /api/courses/{id}` looked identical to an anonymous guest — and course-service correctly 404s a non-published course for anyone it can't identify as the owner. This also silently broke the admin course list's status filter (non-published courses never showed). Fixed by splitting the gateway whitelist into `PUBLIC_ROUTES` (never attempt auth) and `OPTIONALLY_AUTHENTICATED_ROUTES` (attempt auth if a token is present; fail open to anonymous on no/invalid/unverifiable token — never a 401/503 on these routes). See `backend/gateway-service/README.md` and `JwtAuthFilterTest`.

**Objective:** Give admins/moderators a way to create, edit, and manage course structure end-to-end, following the same "single coherent form, not a fully autosaving wizard" simplification already accepted for `/users/create` in Task 9.

**Implementation guidance:**
- `/courses` — server-rendered list (same pattern as `/users`): thumbnail, title, category, status badge, price, enrollment count, rating; filter by status/category; row actions (Edit, Archive, Delete — delete disabled with a tooltip when `enrollment_count > 0`, matching the backend guard so the button state isn't a lie).
- `/courses/create` — one page, sectioned (not a literal multi-step wizard with resume-later autosave — flagged here deliberately so it can be pushed back on): Course Info (title, subtitle, description, objectives as a tag-input, audience, prerequisites, category select, difficulty, language, duration, cover image URL, promo video URL, instructor name/bio/avatar), Pricing (free/paid toggle, price, discount price/expiry). Submits as `status: draft`. Module/lesson structure is built on the following page, not in this form — matches how the backend separates course creation from module/lesson CRUD.
- `/courses/[id]` — tabs: **Overview** (read-only summary + Publish/Archive/Delete actions, publish button surfaces the structured validation error list from `POST .../publish` inline instead of a generic toast), **Edit** (same field set as create, PATCH on save), **Content** (module/lesson tree: add/rename/delete modules, add/edit/delete lessons within a module, reorder via up/down buttons — not drag-and-drop, since that needs a dedicated pointer-event implementation with no external DnD library and isn't required for the phase's exit criteria), **Versions** (read-only list from `GET .../versions` with a Restore button per row).
- Reuse `ToastContext` from `apps/utilities` for save/publish/error feedback, same as the rest of the admin app.

**Tests:**
- Unit: publish-validation-error rendering — given a structured error list from the API, each item renders as a distinct actionable message.
- Unit: module/lesson reorder — up/down button clicks produce the correct new order before the PATCH fires.
- Integration: create course → add module → add lesson → publish → course appears in `/courses` list with a Published badge.

**Demo:** Login as super admin at `localhost:3001` → `/courses/create` → fill form → save → land on `/courses/[id]` → Content tab → add a module and two lessons → Overview tab → Publish → course now shows Published status in the `/courses` list and is visible at `localhost:3000/courses`.

---

**Task 15: Phase 2 Integration & Verification**

> **Status: ✅ Done.** Full loop verified live: admin creates a draft at `localhost:3001` → attempted publish blocked with the full structured error list → adds a module, a lesson, and a `videoUrl` via the Content tab → publishes → course appears immediately, unauthenticated, at `localhost:3000/courses` and its detail page. Auth boundary checks via `curl`: `POST /api/courses` with no session → 401; same request as a logged-in `STUDENT` (a throwaway test account, manually verified in `auth_db` since no local SMTP is configured) → 403 "Only super admins or moderators can perform this action"; `DELETE` on a course with `enrollment_count` manually set to 1 → 409, reset back to 0 after. `GET /api/courses`/`GET /api/categories` confirmed reachable with zero cookies (true guest path). Two demo courses ("Business English Essentials", "Everyday Conversation Skills") and one throwaway student account (`teststudent@example.com`) were left in the local dev DB from this verification pass — harmless, but worth knowing about if you want a clean slate.

**Objective:** Confirm the full course-authoring-to-discovery loop works end-to-end through the gateway, across both frontends.

**Implementation guidance:**
- Full chain check: admin creates + publishes a course at `localhost:3001` → same course visible unauthenticated at `localhost:3000/courses` within the request/response cycle (no caching layer yet to worry about — Redis catalog caching from the original Task 2.3 cross-cutting notes is deferred, not required for the exit criteria below).
- Confirm `GET /api/courses/**` truly requires no auth end-to-end (guest browser session, no cookies) and that `POST/PATCH/DELETE` correctly 401 without a session and 403 for a `STUDENT`-role session.
- Confirm the delete-guard is unbypassable from the UI (button disabled) and from a raw `curl DELETE` (backend 409) when `enrollment_count > 0`.

**Tests:** The integration/E2E tests specified in Tasks 12–14, run together against a single running stack.

**Demo:** Same as the Phase 2 exit criteria's first two bullets in `implementation-phases.md`: admin creates a 3-module course with 5 lessons and publishes it; guest visits `/courses`, filters by "Beginner", clicks through to see the curriculum.

---

**Task 16: Upload Service — Done**

> **Status: ✅ Done, live-verified end-to-end against the real stack (2026-08-06).** Un-deferred once MinIO was provisioned in `docker/docker-compose.dev.yml`. `backend/upload-service` (the repo's second NestJS service, copying `payment-service`'s conventions — hand-rolled migration runner, header-trust `CurrentUser`, `{success,data,error,timestamp}` envelope, publish-only RabbitMQ) implements resumable chunked upload as real S3/MinIO **multipart uploads** (not a homemade reassembly scheme) — 5MB parts (S3's own multipart minimum), presigned PUT URLs so chunk bytes go directly from the browser to object storage, session/file/chunk state in `upload_db` for resume-after-crash.
>
> **Object storage is a pluggable `StorageProvider` abstraction** (mirroring `PaymentProvider`) rather than a hardcoded MinIO client, per an explicit user requirement: support MinIO and real S3 coexisting at once, with already-uploaded files staying correctly addressable on whichever backend they actually live on even after the "current" provider changes. Solved by never storing a resolved URL — each `upload_files` row records its own `storage_provider`/`storage_bucket`/`storage_path` at creation time, permanently; a `StorageProviderRegistry` resolves the right provider instance per-file from that stored value, not from "whatever's active today." `S3CompatibleStorageProvider` is one class (backed by `@aws-sdk/client-s3`) registered twice under different names/config once both backends are wanted — MinIO and AWS S3 both speak the S3 API, so adding real S3 later is a config change (`AWS_ACCESS_KEY_ID` set), not new code.
>
> Live-verified with a from-scratch end-to-end script (`e2e/upload-flow.e2e.ts` — no prior e2e harness existed anywhere in the repo to mirror) against the real running stack: real gateway JWT auth, a real `course-service` lookup, a real 2-part multipart upload actually PUT to a real MinIO instance, real ETags round-tripped, multipart completion, and an independent `HeadObjectCommand` check directly against MinIO (bypassing upload-service) confirming the object genuinely exists at the correct size. All 4 spec'd events (`upload.session.started/chunk.completed/file.completed/failed`) confirmed publishing with correct payloads.
>
> Also gained during this task: `docker-compose.dev.yml` gained a `minio` service (ports 9002/9003, `restart: always`), every infra container switched from `restart: unless-stopped` to `restart: always`, and the pre-existing standalone `platform-mongo` container (holding an unrelated `notifications` database — not touched) got the same restart policy applied non-destructively via `docker update`.
>
> Not built in this task: the admin frontend's upload UI (`/courses/[id]/upload`) — this was scoped and agreed as backend-first, matching every other phase's own "backend before frontend" ordering. Lessons still take a plain admin-pasted `video_url` until that frontend work lands.
>
> **Update (2026-08-06, done in Task 30):** the admin upload UI landed — `LessonFileUpload.tsx` in `apps/admin/app/(dashboard)/courses/[id]/` drives the real chunked multipart flow (session → per-chunk presign+PUT → complete) from a plain `<input type="file">`, live-verified via a DataTransfer-simulated file selection (the in-app browser tool has no native file-upload action) against the real running stack. `Lesson` gained `uploadFileId`/`allowDownload` fields end-to-end (migration → entity → DTOs → admin UI); `enrollment-service` resolves a fresh signed playback/download URL server-side via a new `UploadServiceClient` rather than ever trusting a client-supplied or previously-stored URL.

---

**Task 17: Media Service — Deferred**

> **Status: ⏸️ Deferred.** Depends on Task 16 (nothing to transcode without an upload pipeline) and on MongoDB, which also isn't provisioned yet. The transcoding pipeline (ffprobe + HLS) additionally needs `ffmpeg` available in whatever runs the service — a real infrastructure decision (container image, or a managed transcoding API) that's out of scope for "no Kubernetes/infra work." Revisit alongside Task 16.

**When resumed, implementation guidance is unchanged from `implementation-phases.md` §2.1** and **`database-schema-and-migrations.md` §4.1** (`media_db` Mongo schema is already fully specified).

---

**Task 18: Extract `backend/shared-java` — Deferred (follow-up, not blocking)**

> **Status: 🔲 Not started, deliberately deferred.** `course-service` (Task 11) duplicates `ApiResponse`, the `GlobalExceptionHandler` pattern, and the `CurrentUser`/header-auth resolver that `auth-service` and the gateway already established. That duplication is real but small (~150 lines) and not worth pausing Task 12 mid-flight to fix — **decided 2026-08-05:** extract into a shared Maven module once a **third** Java service exists and the duplication pattern is fully proven out, not guessed at in advance. Cross-stack sharing (with the future NestJS services) isn't in scope for this — there's no runtime in common between a `@RestControllerAdvice` and a NestJS exception filter; the only thing crossing that boundary is JSON over HTTP, which the frontends already handle stack-agnostically via `apiFetch`.

**When resumed:** create `backend/shared-java/` (own `pom.xml`, `mvn install`ed to the local repo, versioned — not a multi-module Maven reactor, since the existing service poms are deliberately standalone), move `ApiResponse`, `GlobalExceptionHandler`'s common exception mappings, and `CurrentUser`/`CurrentUserArgumentResolver`/`WebConfig` into it, then update `auth-service` and `course-service` to depend on it and delete their local copies.

> **Status: superseded by Task 19 (2026-08-05).** Enrollment Service (Task 20) is the third Java service this task's own trigger condition was waiting for — see Task 19 below for the actual extraction (which only migrates `course-service`, not `auth-service`; see Task 19's own status note for why).

---

### PHASE 3 — Enrollment, Payments & Learning Loop

---

**Task 19: Extract `backend/shared-java`**

> **Status: ✅ Done (2026-08-05), verified live.** `backend/shared-java` created and `mvn install`ed locally as a **plain library jar** — no Spring Boot auto-configuration, no `spring-boot-maven-plugin`, nothing that self-registers; an earlier draft of this task used `META-INF/spring/...AutoConfiguration.imports` for auto-discovery but that made shared-java feel like its own mini Spring Boot starter rather than "just a library," so it was replaced with one explicit `@ComponentScan(basePackages = {"com.grammarcetamol.course", "com.grammarcetamol.shared"})` line on `CourseServiceApplication` — visible per-service wiring, no hidden discovery. `course-service` migrated (its local `ApiResponse`/`CurrentUser`/`CurrentUserArgumentResolver`/`WebConfig`/common-exception-mappings deleted, replaced by the shared dependency; kept a local `CourseExceptionHandler` for its three domain exceptions). `auth-service` intentionally **not** migrated — see the shared-java README for why. `course-service`'s full test suite (13 tests) passes unchanged post-migration, proving no behavior change. Verified live twice: once against the real dev stack via the user's own running instance (`GET /actuator/health` → `UP`, `GET /api/categories` → real seeded rows correctly wrapped in the shared `ApiResponse` envelope) before the auto-configuration→`@ComponentScan` rework, and again afterward via a scratch-port boot (`:8093`, so as not to disturb that running instance) — Spring context fully initialized (Flyway validated, Hibernate/JPA loaded, all shared-java beans wired) and only failed at Tomcat's OS-level loopback-socket bind, the same pre-existing Windows environment issue already documented in `auth-service`/`course-service`'s READMEs, unrelated to this change.

**Objective:** Stop copy-pasting `ApiResponse`, `GlobalExceptionHandler`, and the header-trust `CurrentUser`/`CurrentUserArgumentResolver`/`WebConfig` pattern into every new header-trust Java service. Enrollment Service (Task 20) would be the third copy — extract now, before it's written, so it's built on the shared module from day one.

**Implementation guidance:**
- New standalone Maven module `backend/shared-java/` — own `pom.xml` (group `com.grammarcetamol`, artifact `shared-java`), Spring Boot 3.2.5 / Java 21 to match, packaging `jar`, `mvn install`ed to the local `~/.m2` repo (not a multi-module reactor — the existing service poms are deliberately standalone, per Task 18's original note).
- Move from `course-service` into `shared-java`: `dto/ApiResponse.java`, the common exception-mapping portion of `GlobalExceptionHandler` (`MethodArgumentNotValidException`, `EntityNotFoundException`, `IllegalArgumentException`, catch-all `RuntimeException`), and `config/CurrentUser.java` / `CurrentUserArgumentResolver.java` / `WebConfig.java`.
- `course-service` depends on `shared-java` (`<dependency>` in its `pom.xml`), deletes its local copies, keeps only its own domain exceptions (`ForbiddenException`, `CoursePublishValidationException`, `CourseDeletionBlockedException`) and their `@ExceptionHandler` mappings — either as a small course-service-local `@RestControllerAdvice` extending/alongside the shared one, or (simpler) course-service's `GlobalExceptionHandler` becomes a thin subclass-equivalent that only adds its domain-specific handlers, since `@RestControllerAdvice` classes don't compose via inheritance cleanly in Spring — verify which actually works cleanly with Spring's advice ordering before committing to one shape.
- `auth-service` is **not** migrated — it has a materially different `ApiResponse.error()` overload set already in sync with `course-service`'s (fine to leave as-is), a much larger domain-specific exception set, and real JWT-based identity instead of header-trust, so there's nothing header-trust-shaped to share with it. Migrating it would be a bigger, riskier refactor for no behavior change — not worth doing opportunistically here.

**Tests:** `course-service`'s existing `CourseServiceTest`/`CourseStructureServiceTest` suite passes unchanged after the migration (proves no behavior change). `mvn spring-boot:run` still starts cleanly on `:8083`.

**Demo:** `mvn install` in `backend/shared-java/` succeeds. `mvn test` in `backend/course-service/` passes with zero changes to test assertions, only import-path changes.

---

**Task 20: Enrollment Service — Bootstrap, Schema, Enrollment & Progress**

> **Status: ✅ Done (2026-08-05).** `backend/enrollment-service` scaffolded on `shared-java`, port `8084`, `enrollment_db` created and migrated (`enrollments`, `lesson_progress`; `certificates` skipped as spec'd "future"). All endpoints implemented as planned: free enrollment (idempotent, rejects paid courses with a 400 pointing at checkout), `GET .../learn` (curriculum + per-lesson lock state), `PATCH /api/progress`, the admin at-risk query, and the internal completion-check endpoint `review-service` (Task 22) will call. `CourseServiceClient` calls `course-service` directly via `RestClient` (no gRPC — see the Phase 3 planning note), presenting as a trusted internal caller (`X-User-Role: SUPER_ADMIN`) since course-service has no "enrolled student" concept to authorize against otherwise. RabbitMQ: publishes `enrollment.created`/`enrollment.completed`/`lesson.progress.updated`; consumes `payment.completed` (queue/binding declared here independently of whether `payment-service` has started). Gateway wiring done (`enrollmentServiceUrl` + two new routes, no public/optional tier needed). 12 Mockito unit tests pass, covering idempotency, prerequisite gating, auto-completion, and the at-risk threshold boundary. **Real deviation found during this task:** `RestClient`'s default JDK `HttpClient`-based request factory also trips the pre-existing Windows loopback-socket issue (it opens an NIO `Selector` at construction, same as Tomcat's connector) — fixed by using `SimpleClientHttpRequestFactory` instead, a genuine reliability improvement on affected dev machines, not just a workaround. **Verified:** compiles, all tests pass, Flyway migration applies cleanly against the real `enrollment_db` (confirmed live via `psql \d`), full Spring bean graph constructs successfully including the RestClient/RabbitMQ/JPA layers. The Tomcat NIO-connector loopback issue documented for `auth-service`/`course-service` blocked an automated `mvn spring-boot:run` (tried via both Bash and PowerShell) in this sandbox specifically — running it directly (outside sandboxed automation) started cleanly: `GET :8084/actuator/health` → `UP`, confirmed live. **Updated during Task 22:** `CompletionResponse` gained an `enrollmentId` field so `review-service` can stamp `reviews.enrollment_id`. **Flagged gap (found during Task 22, not fixed here):** this service never increments `course-service`'s denormalized `courses.enrollment_count` — real enrollments don't move that counter, even though the original Task 12 notes expected Enrollment Service to start doing so. Same shape of gap as review-service not updating `avg_rating`/`review_count` — worth one combined follow-up rather than two separate patches. **Update (2026-08-06, Task 30):** the sequential prerequisite gating described in this task's own objective (`locked` state, lesson N+1 stays locked until lesson N completes) was implemented, then deliberately **removed** per explicit live user feedback while testing real content — "locking it won't bring a good user experience" for a student who has already paid/enrolled. `getLearnState()` no longer computes a `locked` state at all; only `unlocked`/`current`/`completed` remain, and every lesson in an enrolled course is reachable in any order. The separate, still-fully-active preview gating on the public (pre-enrollment) course-detail page is untouched — confirmed as a deliberate distinction, not an oversight. `resolveContentUrl()` was also added to resolve a fresh signed URL via a new `UploadServiceClient` when a lesson has an `uploadFileId`, falling back to the plain `videoUrl` otherwise.

**Objective:** Stand up `backend/enrollment-service/` so students can enroll (free instantly, paid via a `payment.completed` event), track lesson progress, get prerequisite-gated access to the curriculum, and let admins query at-risk students.

**Implementation guidance:**
- Bootstrap identical to `course-service`'s Task 11 pattern, on top of `shared-java`: Spring Boot 3.2.5/Java 21, `spring-boot-starter-web/data-jpa/validation/actuator`, `postgresql`, `flyway-core`, `spring-boot-starter-amqp` (this service does publish/consume, unlike course-service), no security/gRPC. Port `8084`, datasource `enrollment_db`.
- **Migration `V1__enrollment_initial_schema.sql`** — adapted from `database-schema-and-migrations.md` §3.4 with the same enum-syntax fix already established (`CREATE TYPE enrollment_status AS (...)` is invalid Postgres — use `VARCHAR(20) CHECK (status IN ('active','completed','dropped','expired'))` instead, matching `lesson_progress.status`'s own `VARCHAR + CHECK`). Tables: `enrollments`, `lesson_progress`. Skip `certificates` (explicitly commented "(future)" in the spec).
- **Cross-service reads via plain REST** (`RestClient`, Spring's newer synchronous HTTP client) to `course-service` at `${COURSE_SERVICE_URL:http://localhost:8083}` — no gRPC (see Phase 3 planning note above for why). Needed for: validating a course exists/is published before creating an enrollment, and fetching the module/lesson tree to compute prerequisite gating + completion percentage.
- **`EnrollmentController`**: `POST /api/enrollments` (any authenticated student; body `{courseId}`; free courses only — paid courses go through Payment Service's flow; idempotent on `(user_id, course_id)` via a unique constraint + catch-and-return-existing), `GET /api/enrollments/mine` (list with course summary), `GET /api/enrollments/course/{courseId}/learn` (assembles Course Service's curriculum with this service's `lesson_progress` rows into per-lesson `locked | unlocked | completed | current` state — the endpoint the learning interface page consumes), `PATCH /api/progress` (body `{lessonId, currentTime, completed}`, upserts `lesson_progress`), `GET /api/enrollments/at-risk` (SUPER_ADMIN/MODERATOR; `completion < 20%` AND `enrolled_at < now() - 14 days` AND `status = 'active'`).
- **RabbitMQ**: `EnrollmentEventPublisher` publishes `enrollment.created`, `enrollment.completed` (when all lessons reach `completed`), `lesson.progress.updated` — same `TopicExchange` + fire-and-forget-with-logging pattern as `auth-service`'s `UserEventPublisher`. `PaymentEventListener` consumes `payment.completed` off `payment.exchange` (declared here as a consumer-side queue/binding, matching how `auth-service` declares its own queues) and creates the enrollment with `price_paid`/`currency`/`payment_id` populated — same idempotency guard as the free-enrollment path.
- **Gateway wiring**: add `enrollmentServiceUrl` to `AppGatewayProperties` + `application.yml`, new `.route("enrollment-service", r -> r.path("/api/enrollments/**").uri(...))` — no public/optional tier needed, everything here requires auth (unlike course catalog reads).

**Tests:** Mockito unit tests — idempotent enrollment (second call for the same user+course returns the existing row, doesn't error or duplicate), prerequisite gating (lesson N+1 stays locked until lesson N is completed), at-risk query boundary (exactly 20%/exactly 14 days edge cases), `payment.completed` consumer creates an enrollment with the right `price_paid`.

**Demo:** `mvn spring-boot:run` starts on `:8084`, Flyway applies cleanly. `POST /api/enrollments` for a free course (as a seeded student) → `GET /api/enrollments/mine` shows it. `PATCH /api/progress` on lesson 1 → `GET .../learn` shows lesson 2 unlocked, lesson 3 still locked. Publishing a manual `payment.completed` message via the RabbitMQ management UI creates a paid enrollment.

---

**Task 21: Payment Service — Bootstrap (first NestJS service) & Paystack Checkout**

> **Status: ✅ Done (2026-08-05), verified live.** `backend/payment-service` scaffolded on NestJS 11 (per user request — the plan's original NestJS 10 pin was bumped), `payment_db` created and migrated via a hand-rolled migration runner (no ORM). `PaymentProvider` interface + `PaystackProvider` + a registry (`PAYMENT_GATEWAY` env var selects the active one) implemented as planned. All four endpoints working, confirmed live: `initialize` (rejects free/unpublished courses, confirmed via real course-service data), `confirm`, `webhook` (real HMAC-SHA512 signature verified — valid signature accepted, tampered/wrong-secret rejected with 403, tested against a live-running instance not just unit tests), `refund` (admin-only, balance-validated). Auth boundaries confirmed via curl: 403 unauthenticated, 403 non-admin refund attempt. Gateway wiring done (`paymentServiceUrl` + route; webhook path added to `JwtAuthFilter.PUBLIC_ROUTES` since Paystack calls it server-to-server with no JWT). 13 Jest unit tests pass. **Real bug found and fixed during this task's own live verification** (not just written blind): `initialize()` originally wrote a `pending` payments row *before* calling the provider, so a failed provider call (see next paragraph) left an orphaned row with no error info — fixed by calling the provider first and writing exactly one row only on success; confirmed fixed live (0 rows left behind on a repeat failed call). **Known gap, deliberately deferred (2026-08-05 user decision):** the Paystack test account these dev keys belong to only supports NGN — initializing a USD-priced course (every seeded course) fails with `unsupported_currency`; confirmed via a direct Paystack API call with the same credentials (NGN succeeds, USD fails identically) that this is an account-configuration matter, not a bug in this service. The user's actual plan is per-region/currency-equivalent course pricing (geo-based), explicitly deferred — not something to build or route around now. `PaystackProvider` already passes through whatever currency the course record carries, so no code change is needed here when that lands; it'll likely touch `courses` (per-region price fields) or a live FX lookup, the user's call. Until then, Task 23's live checkout demo can't complete a real charge against a USD-priced course with these keys — a manual currency/course-data workaround at demo time, not a service bug. **Update (2026-08-06, resolved in Task 30):** the user's actual decision was simpler than a geo-pricing system — all courses are priced in NGN now, including for students abroad, who pay the NGN price via their card/bank and let the card network handle FX on their end (see memory: `project_multicurrency_deferred`). No code changed in this service — `PaystackProvider` was already currency-agnostic. All 7 courses were re-priced to NGN, and a real Paystack test-mode charge has since completed successfully end-to-end, the first real transaction in this project's history.

**Objective:** Stand up `backend/payment-service/` as the repo's first Node.js/NestJS service, behind a gateway-agnostic `PaymentProvider` abstraction, with Paystack as the sole live implementation (test-mode keys provided by the user).

**Implementation guidance:**
- New NestJS project at `backend/payment-service/`. No ORM — a thin `DatabaseModule` wrapping `pg` (`node-postgres`), plus a small hand-rolled migration runner (`db/migration/V1__payment_initial_schema.sql`, executed in filename order at boot, tracked in a `schema_migrations` table) — mirrors the Flyway-file convention on the Java side without adding a Java-less ORM dependency. Port `8086`.
- **Migration** — adapted from `database-schema-and-migrations.md` §3.5, same enum→`VARCHAR+CHECK` fix. Tables: `payments`, `transactions`, `refunds` (skip `invoices` unless trivial to fold in alongside).
- **`PaymentProvider` interface** (`src/providers/payment-provider.interface.ts`): `initialize(order): Promise<{reference, accessCode, raw}>`, `verify(reference): Promise<{status, amount, raw}>`, `verifyWebhookSignature(payload, signature): boolean`. `PaystackProvider` implements it (`src/providers/paystack.provider.ts`) against Paystack's REST API (`https://api.paystack.co/transaction/initialize`, `/transaction/verify/:reference`), signature check via HMAC-SHA512 with the secret key per Paystack's documented webhook-verification recipe. A tiny `PaymentProviderRegistry` (`Map<string, PaymentProvider>`) resolves the active provider from `PAYMENT_GATEWAY` env var (`paystack` for now) — adding `StripeProvider`/`FlutterwaveProvider` later is a new class + registry entry.
- **Secrets**: `backend/payment-service/.env` (already covered by the `backend/**/.env` gitignore pattern) holding `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYMENT_GATEWAY=paystack`, `DB_*`. Commit a `.env.example` with placeholder values only, never the real keys.
- **`PaymentsController`**: `POST /api/payments/initialize` (authenticated student; body `{courseId}`; looks up course price via REST call to `course-service`, creates a `pending` `payments` row, calls the active provider's `initialize`, returns `{reference, accessCode, publicKey}` — the public key is safe to return to the frontend, it's not a secret), `POST /api/payments/{reference}/confirm` (re-verifies against the provider server-side, idempotently transitions the payment to `completed`/`failed`, writes a `transactions` ledger row, publishes `payment.completed`/`payment.failed`), `POST /api/payments/webhook` (signature-verified, same idempotent transition as `/confirm` — both converge on one internal method so whichever arrives first wins and the second is a no-op), `POST /api/payments/{id}/refund` (SUPER_ADMIN only; creates a `refunds` row, publishes `refund.requested`/`refund.completed`).
- **Gateway wiring**: `paymentServiceUrl` in `AppGatewayProperties` + `application.yml`, new route for `/api/payments/**`. The webhook path (`POST /api/payments/webhook`) needs to reach payment-service without the gateway's JWT filter rejecting it (Paystack calls it directly, no user session) — add it to `PUBLIC_ROUTES` (it authenticates itself via the Paystack signature header instead of a JWT, so this is safe the same way login/register are public-but-self-validating).

**Tests:** Jest unit tests (NestJS default) — `PaystackProvider`'s signature verification (valid/invalid/tampered payload), the idempotent confirm/webhook convergence (second call is a no-op, doesn't double-publish or double-write the ledger), refund validation (can't refund more than the paid amount).

**Demo:** `npm run start:dev` in `backend/payment-service/` boots on `:8086`, migration runner applies `V1` cleanly. `POST /api/payments/initialize` against a real Paystack test-mode course purchase returns a working `accessCode`; completing payment with Paystack's documented test card and calling `/confirm` transitions the payment to `completed` and an enrollment appears via Task 20's consumer.

---

**Task 22: Review Service — Bootstrap, Schema, Reviews & Moderation**

> **Status: ✅ Done (2026-08-05), verified live.** `backend/review-service` scaffolded on `shared-java` (4th consumer), `review_db` created and migrated (`reviews`, `review_votes` — the latter has no JPA entity yet, same "don't add entities for unused tables" call as course-service's `resources`/`tags`). All endpoints implemented and working: create (50%-gate + duplicate-409, both live-verified), edit-within-7-days, public course reviews, admin listing/moderation. `EnrollmentServiceClient` calls `enrollment-service` live via REST (same internal-caller convention as that service's own `CourseServiceClient`) — confirmed working end-to-end live, not just mocked: a real request correctly got "not enrolled" back from a real cross-service call. Required a small, clean extension to Task 20's already-shipped `enrollment-service` (`CompletionResponse` gained an `enrollmentId` field) so this service can stamp `reviews.enrollment_id` correctly. Gateway wiring done, including a real routing-order gotcha: `/api/courses/{id}/reviews` needed its own route registered *before* the general `/api/courses/**` → course-service route, or the broader pattern would have swallowed it. 10 Mockito unit tests pass. **Flagged, not fixed:** neither this task nor Task 20 updates `course-service`'s denormalized `courses.avg_rating`/`review_count`/`enrollment_count` columns — a real gap the original schema doc's own notes expected a later phase to close, worth a dedicated follow-up (see review-service's README).

**Objective:** Stand up `backend/review-service/` so students who've completed at least 50% of a course can rate and review it, and admins can moderate submissions.

**Implementation guidance:**
- Bootstrap identical to Task 20's pattern, on `shared-java` (fourth consumer). Port `8085`, datasource `review_db`, `spring-boot-starter-amqp` for publishing.
- **Migration `V1__review_initial_schema.sql`** — adapted from `database-schema-and-migrations.md` §3.6, same enum fix (`VARCHAR(20) CHECK (status IN ('pending','approved','rejected','flagged'))`). Tables: `reviews`, `review_votes`.
- **Cross-service read**: REST call to `enrollment-service` (`${ENROLLMENT_SERVICE_URL:http://localhost:8084}`) for the current user's completion percentage on the course being reviewed — the 50% gate check at submission time, no denormalized/event-driven completion flag.
- **`ReviewController`**: `POST /api/reviews` (authenticated student; 403 with a clear message if completion < 50%; `UNIQUE(user_id, course_id)` enforced, so a second submit is really an edit path — return 409 pointing at the PATCH endpoint), `PATCH /api/reviews/{id}` (owner only, only within 7 days of `created_at`, sets `is_edited`/`edited_at`), `GET /api/courses/{courseId}/reviews` (public, `status = 'approved'` only, paginated), admin `GET /api/reviews` (SUPER_ADMIN/MODERATOR, all statuses, filterable by status/course/rating), `PATCH /api/reviews/{id}/moderate` (admin; transitions status, sets `moderated_by`/`moderated_at`/`moderation_note`).
- **RabbitMQ**: publishes `review.submitted`, `review.approved`, `review.moderated` (fire-and-forget, same pattern as the other two new services). No consumer — the completion check is a live REST call, not an event subscription (see Phase 3 planning note above for why).
- **Gateway wiring**: `reviewServiceUrl` + route for `/api/reviews/**`; `GET /api/courses/{courseId}/reviews` goes in `OPTIONALLY_AUTHENTICATED_ROUTES` (same treatment as course catalog GETs) since it's a public read that doesn't need identity.

**Tests:** Mockito — 50%-gate boundary (49% blocked, 50% allowed), 7-day edit-window boundary, duplicate-submission returns 409 not a second row, moderation transition sets the right audit fields.

**Demo:** As a seeded student with <50% progress, `POST /api/reviews` → 403 with the completion requirement in the message. Progress past 50% (via Task 20's progress endpoint) → same request succeeds, status `pending`. Admin `PATCH .../moderate` with `{status: "approved"}` → `GET /api/courses/{id}/reviews` (no auth) now shows it.

---

**Task 23: Student Frontend — Checkout Flow**

> **Status: ✅ Done (2026-08-05), verified live end-to-end in the browser.** `lib/enrollment.api.ts` and `lib/checkout.api.ts` built as planned; `/checkout/[courseId]` uses Paystack's classic `.setup({ref, amount, email, key})` popup API (not `resumeTransaction`/access-code resume) — simpler and reuses the backend-generated `reference` directly. Free-course "Enroll for Free" wired into the course detail page's existing `EnrollButton`, paid courses route to `/checkout/[slug]`. Live-verified via the browser preview: registered a real test student (`e2etest@example.com` — activated directly via SQL to skip email verification, no local SMTP; password `TestPass123`, left in place as a reusable test account like Task 15's `teststudent@example.com`), enrolled for free in "Everyday Conversation Skills", confirmed it appeared correctly. Checkout page for the paid course renders correctly (order summary, pre-filled email, correct total) and — as already flagged in Task 21 — fails gracefully with "Payment provider initialization failed" when actually paying, due to the known Paystack NGN/USD account gap; the failure UI (inline error, form stays editable, button resets) works as designed. A real Paystack test-card charge therefore isn't demoed yet — blocked on the same deferred currency decision, not a frontend bug. Small upstream fix made during this task: `AuthContext.login()` now calls `refreshUser()` immediately after login so `fullName` (needed for the dashboard greeting, Task 24) is available without waiting for a full page reload — previously only `{userId, email, roles}` populated until next mount. 6 new logic tests pass (`hasEnrollmentFor`, `toPaystackSubunit`). **Update (2026-08-06, Task 30):** with courses re-priced in NGN, a real Paystack test-mode charge against this exact page completed successfully — popup opened, test card confirmed, `onSuccess` → `confirmPayment` → `enrollFromPayment` → the course appeared in `GET /api/enrollments/mine`, and the transaction is visible on the admin `/revenue`/`/transactions` pages (Task 27). The previously-blocked "real charge" demo is no longer blocked.

**Objective:** Let a logged-in student buy a paid course through a page-hosted Paystack popup, and enroll in a free course with one click — no external state library, following the established `useGenericState`/`apiFetch` conventions.

**Implementation guidance:**
- `lib/enrollment.api.ts` — `enrollFree(courseId)`, `getMyEnrollments()`, types. `lib/checkout.api.ts` — `initializePayment(courseId)`, `confirmPayment(reference)`, types. Both get `*.test.ts` logic tests for any pure helper (e.g. price/currency formatting reused from the course detail page), matching `course.api.test.ts`'s pattern.
- Course detail page (`/courses/[slug]`, from Task 13): the existing "disabled Coming soon" enroll button for logged-in students becomes real — free courses call `enrollFree` directly (toast + redirect to `/my-courses/[courseId]`), paid courses route to `/checkout/[courseId]`.
- `/checkout/[courseId]` — two-column layout per `student-frontend.md` §5.6: left = order summary (thumbnail/title/instructor/price breakdown, reusing the `Intl.NumberFormat` currency pattern already used in `CourseCard`/course detail); right = customer details (`useGenericState`, pre-filled from `useAuth()`) + a "Pay" button that calls `initializePayment`, loads Paystack's `inline.js` script (`https://js.paystack.co/v1/inline.js`) once, and opens `PaystackPop.setup({ key: publicKey, ... }).openIframe()` with the returned `accessCode`/`reference`. On the popup's `onSuccess` callback, call `confirmPayment(reference)`, then poll `getMyEnrollments()` a few times (short interval) until the course appears, then show the success state (checkmark, "Start Learning Now" → `/my-courses/[courseId]`, "Go to Dashboard"). `onClose`/failure → inline error + "Try Again".
- No payment-method-selector UI needed — Paystack's popup already offers card/bank/USSD/mobile money.

**Tests:** Unit tests for `checkout.api.ts`/`enrollment.api.ts` pure functions. No component/RTL tests for the checkout page itself, consistent with this repo's existing test scope (see frontend research findings — `apps/student`'s vitest config has no jsdom).

**Demo:** Logged-in student on a free course's detail page clicks "Enroll for Free" → toast → redirected to the (still-building) `/my-courses/[courseId]`. On a paid course, `/checkout/[slug]` loads, "Pay" opens the real Paystack test-mode popup, completing it with Paystack's documented test card shows the success state and the course appears in `GET /api/enrollments/mine`.

---

**Task 24: Student Frontend — Dashboard & My Courses**

> **Status: ✅ Done (2026-08-05), verified live in the browser.** `hooks/useMyCourses.ts` combines `GET /api/enrollments/mine` with a per-enrollment course-detail + learn-state fetch (no single pre-joined endpoint exists) — real N+1-shaped fan-out, deliberately not optimized ahead of it being a real problem at this scale. `/dashboard` and `/my-courses` built as planned; live-verified: dashboard's greeting, empty states, and Recommended Courses (correctly excluding nothing since no enrollments existed yet) all rendered correctly on first load, then correctly updated to show the newly-created enrollment after Task 23's live free-enroll test. `/my-courses` correctly showed the course as "Completed" at 100% after Task 25's live completion test. `lib/dashboard.ts`'s `greetingForHour` has 6 boundary tests (11→morning, 12→afternoon, 17→afternoon, 18→evening).

**Objective:** Give a logged-in student a home base and an enrolled-courses list — both pages designed fresh since neither has a detailed spec in `student-frontend.md` beyond a one-line route mention (`/my-courses`) or a partial section (`/dashboard` §5.4, live-classes panel excluded — no Live Class Service exists).

**Implementation guidance:**
- `lib/dashboard.api.ts` / reuse `lib/enrollment.api.ts` — `useFetch` against `GET /api/enrollments/mine` (+ course summaries) for both pages.
- `/dashboard` — welcome card ("Good morning/afternoon/evening, [name]" by local time-of-day, per §5.4), "Continue Learning" card (most recently accessed in-progress enrollment, `Resume` → learning interface; empty state CTA to `/courses`), My Courses tabbed preview (In Progress | Completed | Not Started, 3-card grid, "View All" → `/my-courses`), Recommended Courses (simple: `GET /api/courses?sort=enrollment_count&limit=6` excluding already-enrolled, reusing `CourseCard`). Skip: live-classes panel, notifications panel (no dedicated notifications backend yet beyond the toast system).
- `/my-courses` — grid of all enrollments (`CourseCard`-style with a `ProgressBar` from `apps/utilities` added), status filter (`Tabs`: All | In Progress | Completed), empty state CTA to `/courses`.

**Tests:** Any pure helper (e.g. "time of day" greeting logic, enrollment status grouping) gets a logic test.

**Demo:** Logged-in student with 2 enrollments (one in-progress, one completed) sees both correctly grouped on `/dashboard`'s preview and `/my-courses`'s filtered grid; "Continue Learning" resumes the in-progress one.

---

**Task 25: Student Frontend — Learning Interface**

> **Status: ✅ Done (2026-08-05), verified live in the browser — the strongest end-to-end proof of Phase 3's backend work so far.** `/my-courses/[courseId]` built exactly as scoped down in the Phase 3 planning notes. Live-verified the full loop in one pass: enrolled for free in a real course from the course detail page → landed on the learning interface → mobile sidebar (browser viewport was narrower than the `md` breakpoint, so the mobile drawer path got exercised for free) correctly showed the module/lesson tree with a play icon → clicked "Mark Complete" → lesson flipped to a green checkmark, the button became disabled "Completed ✓", the course's `completionPct` crossed 50% and the "Leave a Review" link appeared **exactly as designed**, live, computed from real backend data, not a mock. `/my-courses` then correctly reflected the enrollment as "Completed" at 100%. This is a real, unscripted confirmation that Task 20's gating/completion logic, Task 25's UI, and the review-eligibility threshold all compose correctly end-to-end. Progress-sync debouncing, prerequisite lock/unlock on a multi-lesson course, and the "Leave a Review" link's actual destination (still just routes to `/courses` — no review-submission UI exists until Task 28/a student-side review form, which isn't in this task's scope) remain unverified beyond the single-lesson course tested. **Update (found missing while verifying Task 28, fixed same session):** the "Leave a Review" link was still that dead `/courses` stub with no actual form behind it — built `ReviewModal.tsx` (star rating + optional title/comment) posting to Task 22's review endpoints, plus one new backend endpoint (`GET /api/reviews/mine?courseId=`) so the frontend can tell create from edit and pre-fill. Live-verified both paths: a student with an existing review sees "Edit Your Review" pre-filled and a `PATCH` that persists without resetting moderation status; a fresh student sees an empty "Leave a Review" form with validation blocking submission with no rating, and a `POST` that creates a `pending` review. Found and fixed one real bug along the way: the modal is mounted once and toggled via an `open` prop, so its `useState` initial values never re-synced once the async `myReview` fetch resolved after mount — fixed with a `useEffect` that re-syncs form state whenever the modal opens. **Update (2026-08-06, Task 30):** the main content area is now content-type-aware instead of a bare `<video>` — video lessons keep the HTML5 player, `resource`-type lessons (PDF/other documents) render in an inline `<iframe>`, and `text`-type lessons render an inline `<img>` alongside the lesson description; all three confirmed rendering correctly in the user's real browser. Sequential lesson-locking (described in this task's original scope) was removed per Task 20's update note above — the `LockIcon` component and all `locked`-state branches were deleted from this page's sidebar and `openLesson()` logic.

**Objective:** Build `/my-courses/[courseId]`, the actual place students watch lessons and track progress — scoped to what's backed by real infrastructure (see Phase 3 planning note above for the full list of deferred sub-features: hls.js, PiP, keyboard shortcuts, discussion, bookmarks, notes, signed-URL downloads).

**Implementation guidance:**
- Single `useFetch` against Task 20's `GET /api/enrollments/course/{courseId}/learn` for the full curriculum + progress state; local state for the currently-selected lesson.
- **Left sidebar** (collapsible): module accordion (title + completion fraction), lesson rows with icon state (lock / play / check / pulse-for-current) per `student-frontend.md` §5.5; clicking a locked lesson is a no-op (or a toast explaining why).
- **Main area**: plain HTML5 `<video>` element pointed at the lesson's `videoUrl`, seeking to `lastWatchedPosition` on load; below it, lesson title, a "Mark Complete" checkbox/button, Previous/Next navigation (respecting lock state), and — once the course-wide completion crosses 50% — a "Leave a Review" link to a simple inline review form (rating + text) posting to Task 22's `POST /api/reviews`.
- **Progress sync**: `timeupdate` handler, debounced to once per 5s, `PATCH /api/progress` with `{lessonId, currentTime, completed}`; `completed` flips true on `ended` or when watch position crosses a completion threshold (e.g. 90%).
- **Mobile**: left sidebar collapses into a bottom-sheet/drawer toggle instead of a fixed pane; right-sidebar content (none exists in this scoped-down version) is skipped rather than becoming mobile tabs, since nothing lives there yet.

**Tests:** Logic test for the 5s-debounce/completion-threshold helper if it's extracted as a pure function.

**Demo:** Enrolled student opens `/my-courses/[courseId]`, video resumes at last position, watches past the completion threshold, lesson flips to completed and the next lesson unlocks, reloading the page preserves the resume position.

---

**Task 26: Admin Frontend — Shell Layout & Shared Primitives**

> **Status: ✅ Done (2026-08-05), verified live in the browser.** `hasPermission` bug fixed (extracted to a pure, unit-tested `computeHasPermission` in `lib/auth.api.ts` — 6 regression tests, including the exact "uppercase multi-role string" scenario that used to fail). `Sidebar`/`TopHeader`/`Breadcrumb` built and wired into `app/(dashboard)/layout.tsx`, replacing the bare `<div>`; nav groups limited to what's actually built (Overview/Education/People/Business/Feedback — Insights/Communication/System omitted, nothing backs them). `DataTable` and `BarChart`/`LineChart`/`DonutChart` built in `apps/utilities` as plain (non-`'use client'`) presentational components — same reasoning as `Mapping`: they need to render inside Server Components, which every existing admin list page is. `DataTable` deliberately excludes pagination (stays the page's own responsibility, matching `/courses`'s existing URL-driven pattern) and sorting-as-state (a `headerHref` prop supports sort-via-link instead, not client sort state) — the plan's original "client-side sort" note didn't fit the actual established SSR pattern once real precedent was read. 11 new component tests pass. **Real bug found and fixed during live verification, not caught by any test:** the sidebar's collapse-toggle button was rendering below the viewport fold — every existing admin page keeps its own `min-h-screen` wrapper, which combined with the new `TopHeader`'s height inflated total page height past 100vh, and the sidebar (naively flex-stretching off a `min-h-screen` ancestor) grew to match rather than staying capped at the actual screen height. Fixed with `sticky top-0 h-screen` on the sidebar (and the header) instead of relying on flex-stretch — confirmed via the browser that the collapse button now sits exactly at the viewport edge, and that collapsing/expanding actually works and persists via `localStorage`. Verified live end-to-end: logged in as the seeded super admin, confirmed breadcrumb + active-nav-highlighting update correctly on navigation, confirmed the existing `/courses` page renders cleanly inside the new shell with no layout regressions, and — as a side effect of visiting `/courses` — reconfirmed the already-flagged `enrollment_count` gap (both test courses still show 0 students despite a real enrollment existing from Task 25's testing).

**Objective:** Give the admin app a real persistent shell (it's been a bare `<div>` since Phase 1) and build the `DataTable`/chart primitives every Phase 3 admin page below needs — both real gaps, not copy-paste from an existing pattern.

**Implementation guidance:**
- Fix the `hasPermission` bug in `apps/admin/contexts/AuthContext.tsx` first (`roles === 'super_admin'` → compare against the actual uppercase role string(s) correctly) — new pages gate on this.
- `Sidebar` (nav groups per `admin-frontend.md`'s sketch: Overview, Education, People, Business, Insights; items gated by `hasPermission`; active route via `usePathname()`; collapse toggle in `localStorage`) + `TopHeader` (user avatar dropdown with Profile/Logout, breadcrumb) + `Breadcrumb` (derived from `usePathname()`), replacing the bare `<div>` in `app/(dashboard)/layout.tsx`. Uses the already-defined-but-unused `--color-sidebar*` tokens in `globals.css`.
- `DataTable` in `apps/utilities/src/components/DataTable/` — columns config (header, accessor, sortable, optional cell renderer), client-side sort, pagination, loading (skeleton rows)/empty states; deliberately not the full spec (no bulk-action floating bar, no column-level filter UI, no drag-resize) — just what Transactions/Reviews/Students actually need. RTL tests matching `Mapping.test.tsx`'s pattern.
- Chart primitives in `apps/utilities/src/components/Charts/` — hand-rolled SVG `BarChart`, `LineChart`, `DonutChart` (no Recharts/Chart.js, per the project's standing "minimize external packages" constraint and the existing custom-built-component precedent). Simple props (`data`, `xKey`, `yKey`, `color`), no zoom/pan/brush. RTL tests for basic rendering with sample data.

**Tests:** `DataTable`/chart component tests (RTL, in `apps/utilities` where `jsdom` is already configured). `hasPermission` unit test covering the bug fix explicitly.

**Demo:** Admin app now has a persistent sidebar across all pages; moderator login hides Revenue/Settings per `hasPermission` (now actually working); `DataTable` and a sample chart render correctly with mock data in a scratch page before being wired into real Phase 3 pages.

---

**Task 27: Admin Frontend — Revenue & Transactions**

> **Status: ✅ Done (2026-08-05), verified live in the browser.** This task needed real backend work first — `payment-service` had no admin read endpoints at all before this task (only checkout/webhook/refund). Added `GET /api/payments` (paginated, filterable by status/method/date range) and a `RevenueService` + `RevenueController` (`GET /api/payments/revenue/{summary,trend,best-sellers,by-method}`, all SUPER_ADMIN/MODERATOR-only). **One deliberate spec substitution:** the "revenue by category" donut became "revenue by payment method" — category breakdown needs a cross-service join (payment→course→category) that's real but disproportionate scope for this task; payment method breakdown is derivable purely from `payments.payment_method`, no join needed. Revenue trend bucketing delegates entirely to Postgres (`generate_series` + `date_trunc`) rather than reimplementing week/month boundary math in JS, where it's easy to drift out of sync with how Postgres actually buckets. Best-sellers enriches raw `courseId`s with real course titles via a small parallel fan-out to course-service (no batch-by-ids endpoint exists, and the list is capped at 10, so this is proportionate rather than worth a new endpoint). `/revenue` is a client component (period toggle needs to refetch without a full page reload); `/transactions` stays a Server Component with URL-driven filters, matching `/courses`'s existing established pattern — `DataTable`'s design choice to leave pagination/sorting to the caller (Task 26) is exactly what made this composition work cleanly. Refund modal uses React 19's `useActionState` over a Server Action, matching the rest of the admin app's mutation pattern. Live-verified: stat cards, the trend chart with a working Daily/Weekly/Monthly toggle (confirmed both bucket counts and date labels update correctly), and both empty states render correctly against the real running stack. **Not verified: an actual populated transaction row or the refund modal's real submit path** — blocked on the same already-flagged Paystack NGN/USD gap (Task 21), since no completed payment exists to display. 9 Jest/Vitest tests added (3 backend `formatBucketLabel`, 2 `formatMethodLabel`, 3 `buildTransactionsQuery`, plus existing suites). **Update (2026-08-06, Task 30):** the NGN gap is resolved and a real completed Paystack transaction now populates both pages — `/transactions` shows the correct student/course/amount/method/status row, and `/revenue`'s stat cards and trend chart reflect it. Still not verified: the refund modal's real submit path (no refund has actually been issued against a real transaction yet).

**Objective:** Give admins the revenue visibility and refund workflow from `admin-frontend.md` §6.8, scoped to one chart type per metric instead of the full interactive-everything spec.

**Implementation guidance:**
- `lib/revenue.api.ts` / `lib/transactions.api.ts` against Payment Service (via gateway).
- `/revenue` — `StatCard` row (lifetime/month/week/today revenue, avg transaction value, refund rate), one `LineChart`/`BarChart` with a Daily/Weekly/Monthly toggle (not a date-range picker), a `DonutChart` for revenue-by-category (course category, joined against Course Service category data), a ranked best-sellers list (top 10 by enrollment count/revenue).
- `/transactions` — `DataTable` (ID, date, student, course, amount, method, status), status/date-range filters, refund action opening a `Modal` (reason textarea + amount, calls Task 21's refund endpoint) with `ToastContext` feedback.

**Tests:** Any pure aggregation/formatting helper (e.g. revenue-by-period bucketing) gets a logic test.

**Demo:** After a completed Paystack test transaction (Task 21/23), `/revenue`'s today/lifetime stat cards and the trend chart reflect it; `/transactions` lists it and the refund modal successfully calls the backend.

---

**Task 28: Admin Frontend — Review Moderation**

> **Status: ✅ Done (2026-08-06), verified live.** Needed a new `GET /api/reviews/{id}` endpoint on `review-service` — didn't exist before, only the list and moderate endpoints did. Live-verified against the real stack: registered a fresh student, enrolled free in "Everyday Conversation Skills", completed its one lesson, submitted a review directly via `POST /api/reviews` (the student frontend had no review-submission UI yet at this point — built afterward, see Task 25's update note above), then in the admin UI confirmed the list showed it, status filtering worked, and Approve → Flag → Reject all round-tripped correctly (badge, moderation note, "last moderated" timestamp, button disabled-state all updated live).

**Objective:** Give admins a moderation queue for reviews — a filtered table, not the Kanban board the phase's original aspirational task list implied (no such spec exists for reviews; the only real Kanban spec in the docs is Phase 5's Service Requests).

**Implementation guidance:**
- `lib/reviews.api.ts` against Review Service.
- `/reviews` — `DataTable` with a status-tab filter (Pending | Approved | Rejected | Flagged | All), columns (student, course, rating, excerpt, submitted date, status), row action → `/reviews/[id]`.
- `/reviews/[id]` — full review text + rating + course/student context, moderate actions (Approve/Reject/Flag with an optional note), calling Task 22's moderate endpoint.

**Tests:** Any pure status-grouping/filter helper gets a logic test.

**Demo:** A pending review submitted in Task 22's demo shows up in `/reviews`'s Pending tab; approving it there makes it appear on the public course detail page's reviews section.

---

**Task 29: Admin Frontend — Student Directory**

> **Status: ✅ Done (2026-08-06), verified live.** Built as its own page/API client (`/students`, scoped to `role=STUDENT`) rather than reusing `/users` — per `admin-frontend.md` §6.7 vs §6.12, they're spec'd as intentionally distinct pages with different filters/columns/detail content. Needed three small backend additions, all admin/moderator-gated: `auth-service` `GET /api/users` gained `role`/`status` query params; `enrollment-service` gained `GET /api/enrollments/user/{userId}`; `payment-service` `GET /api/payments` gained a `userId` param. No "Notes" tab (spec has one) and no per-lesson Progress breakdown (spec implies one) — neither has a backing data source; Progress instead shows per-course completion % via the existing completion endpoint. Activity tab is a client-side merge of login/enrollment/payment timestamps — no activity-log service exists anywhere in the codebase. **Found and fixed a real backend bug along the way:** the naive `(:status IS NULL OR u.status = :status)` JPQL pattern (used successfully elsewhere for plain-string columns) fails outright for `User.status`, a native Postgres enum column — rewrote `UserProfileService.getAllUsers` on a JPA `Specification` instead, which omits absent-filter predicates entirely rather than null-binding them. Live-verified end-to-end: role-scoping, status filtering, detail tabs (including a real Activity timeline and Enrollments/Progress showing real completion data), and both the list-row and detail-page Suspend/Activate actions. **Update (2026-08-06, Task 30):** a real payment now exists in the dev DB (see Task 21's update note) — the `payments?userId=` filter's *existence* of real data to narrow is no longer the blocker it was, but the filter itself hasn't been explicitly re-checked against it through this page's own Transactions tab; still only confirmed via `/transactions`/`/revenue` (Task 27) directly.

**Objective:** Give admins the student directory and profile drill-down from `admin-frontend.md` §6.7, reusing the Task 26 `DataTable`.

**Implementation guidance:**
- Extends the existing `/users` admin functionality (Task 9) rather than duplicating it — `/students` can be the same underlying user list filtered to `role = STUDENT`, or a dedicated route reusing the same data source; decide based on how much Task 9's existing `/users` page can be reused vs. how different the column set actually needs to be (enrollment count, last active aren't on the current `/users` table).
- `/students` — `DataTable` + filter sidebar (search, registration date range, status, enrollment count range) per §6.7; enrollment-count/last-active columns need Enrollment Service data joined in (REST call per row or a batch lookup, not N+1 — batch by user ids).
- `/students/[id]` — header (avatar/name/status/actions), info grid, tabs: Activity (best-effort simple timeline from available data — full cross-service activity aggregation may be thin given no dedicated activity-log table exists), Enrollments (course cards + progress bars from Enrollment Service), Progress (per-course breakdown), Transactions (Payment Service history). Skip the Notes tab unless a trivial backing table is worth adding — no notes schema currently exists anywhere in the spec.

**Tests:** Any pure filter/query-building helper gets a logic test, matching `course.api.test.ts`'s pattern.

**Demo:** `/students` lists all students with real enrollment counts; clicking through to `/students/[id]` shows their actual enrollments/progress/transaction history from the three backend services.

---

**Task 30: Phase 3 Integration & Verification**

> **Status: 🟡 In progress (2026-08-06).** The full chain described below is now live-verified end-to-end for the first time: 5 new courses were seeded with real content (15 lessons — video/text+image/pdf, 3 per course — via a from-scratch Node seeding script hitting real APIs, files staged locally under `seed-assets/` at the project root and uploaded through the real admin upload UI, see Task 16's update note above), all 7 courses were re-priced in NGN (the user's explicit decision — see memory: `project_multicurrency_deferred` — not a currency-conversion system, everyone pays the NGN price and card networks handle FX), and a real Paystack test-mode checkout completed successfully: `payment.completed` webhook → `enrollFromPayment` → a real enrollment → real revenue appearing on both `/revenue` and `/transactions`. This is the project's first real (non-seeded, non-mocked) transaction end to end.
>
> Two UX fixes landed during this live-testing pass, both from direct user feedback while using the learning interface with real content:
> - **Removed sequential lesson-locking** in the enrolled learning interface (`apps/student/app/my-courses/[courseId]/page.tsx`) — an enrolled student can open any lesson in any order; `enrollment-service`'s `getLearnState()` no longer computes a `locked` state at all (only `unlocked`/`current`/`completed` remain). The separate, still-fully-active preview/locked gating on the *public* course-detail page (pre-enrollment) is untouched — confirmed as a deliberate distinction, not an oversight, per the user.
> - **View-only-by-default content policy**: non-video lesson resources (text+image, PDF, etc.) render inline (`<img>`, `<iframe>`) rather than triggering a download; instructors opt a specific lesson into raw download/open-in-new-tab access via a new `allowDownload` checkbox in the same admin upload/edit panel (not a separate settings screen, per explicit user requirement).
>
> Two real bugs were found and fixed via manual QA during this pass (not caught by existing automated tests until regression tests were added afterward):
> 1. `allowDownload` existed on the lesson create/update DTOs but `CourseStructureService` never copied it onto the entity — PATCHing it silently no-opped. Fixed in `createLesson`/`updateLesson`; 3 regression tests added to `CourseStructureServiceTest`.
> 2. A stale Turbopack-compiled bundle in `apps/student` threw `Uncaught ReferenceError: LockIcon is not defined` after the lesson-locking UI was removed (leftover reference to the deleted component that HMR hadn't reconciled) — fixed by clearing `.next` and restarting the dev server; confirmed independently by the user after their own restart.
>
> **Task 30 complete (2026-08-06).** The auth-boundary sweep started as ad-hoc `curl` checks (24 checks against all three Phase 3 services through the real gateway, logged in as a real SUPER_ADMIN and a real STUDENT, not mocked — every write/admin-gated endpoint on `enrollment-service`, `payment-service`, and `review-service` correctly 401s with no token and 403s for the wrong role, with an admin-token sanity check confirming each endpoint still works for the right caller) and was then turned into a real, repeatable test suite: `backend/integration-tests/auth-boundary.integration.spec.ts`, a new sibling project (own `package.json`, not folded into any one service since it tests the boundary *between* them) with a real Jest `describe`/`it`/`expect` suite hitting the live stack via `fetch`, run with `npm test`. All 24 checks pass as real Jest tests, matching the ad-hoc run. One apparent mismatch on the original ad-hoc pass — `refund` returning `400` instead of `403` for a STUDENT token — turned out to be the test's own fault: an empty `{}` body failed `RefundPaymentDto`'s `class-validator` checks before the controller's `SUPER_ADMIN` role check ever ran; the committed test sends a validation-passing body (`{amount, reason}`) and correctly asserts `403`. This is a genuinely new category of test in the repo — every other backend test is either a Mockito/Jest unit test against mocks, or `upload-service`'s one-off e2e console script; this is the first real cross-service integration suite with proper test-runner semantics. The `PLAN.md`/`implementation-phases.md` per-task status-note pass for Tasks 19–29 was completed the same day. Phase 3 is now fully closed out.
>
> **Update (2026-08-06) — expanded to total integration testing, per explicit user request.** `backend/integration-tests` grew from the one 24-test auth-boundary file to **59 tests across 6 files**, covering the real functional flow of every Phase 1–3 service, not just its auth boundary: registration/login (`auth-flow`), full course authoring draft→publish (`course-catalog`), enrollment/progress/no-lesson-locking (`enrollment-learning`), real Paystack test-mode calls (`payment-flow`), and the 50%-completion review gate + moderation (`review-moderation`). Had to switch to `--runInBand` — Jest's default parallel workers caused real request failures (auth-service 500s) from DB/connection contention across 6 files hitting the shared live stack at once, not flakiness. Three real test-authoring bugs found and fixed while building this (not app bugs): a fake `.local` email domain got rejected by Paystack's real validator once payment tests started sending it a real email; a wrong assumption that `PATCH /api/progress` returns `{completed: boolean}` when `LessonProgress` actually serializes as `{status: "completed"}`; and forgetting NestJS defaults `@Post()` handlers to `201`, including `confirm` (which isn't semantically creating anything). See `backend/integration-tests/README.md` for the full breakdown.
>
> Also, per the same request: `apps/admin` and `apps/student` gained **component tests** (RTL, API mocked at the module boundary — `ContentTab.test.tsx`, `ReviewModal.test.tsx`, the latter a direct regression test for Task 25's pre-fill re-sync bug) and **integration tests** (only `global.fetch` mocked, the real `*.api.ts` client code runs — `uploads.api.integration.test.ts`, `reviews.api.integration.test.ts`). Neither app had jsdom configured before this — a deliberate simplification made earlier in Phase 3, revisited here on explicit request. Needed `resolve.dedupe: ['react','react-dom']` in both vitest configs: `apps/utilities` is a sibling with its own `node_modules` (see its own README), so importing its component source directly (the existing alias) pulled in a second React copy and threw "Invalid hook call" until deduped. Admin: 32→44 tests. Student: 27→38 tests.

**Objective:** Confirm the full enrollment → payment → learning → review → moderation loop works end-to-end through the gateway, across both frontends, same verification discipline as Task 15 closed out Phase 2.

**Implementation guidance:**
- Full chain: guest browses a paid course → registers/logs in → checkout with Paystack test card → payment confirms → enrollment appears in "My Courses" → learning interface plays the video and persists progress across a reload → crossing 50% unlocks the review form → submitted review appears in admin's Pending queue → approving it surfaces it on the public course page → the transaction shows up in `/revenue` and `/transactions`.
- Auth boundary checks via `curl`: write endpoints on all three new services 401 with no session, 403 for the wrong role.
- Update `PLAN.md`/`implementation-phases.md` status notes for Tasks 19–29 and the Phase 3 header as each is actually verified, same convention as Phases 1–2 — this task's own status note is where any real deviations found only during integration (like Phase 2's gateway-whitelist bug) get recorded.

**Tests:** The integration/unit tests specified in Tasks 19–29, run together against a single running stack.

---

### PHASE 3.5 — MVP Completion

> **Current status (2026-08-19): Phase 3.5 is fully complete.** Tasks 31–37 all done — see each task's own status note below. Task 37 closed out the phase with live end-to-end verification against the real running stack (not just code review) and found/fixed three real bugs, most notably that account lockout had never actually persisted (see Task 37's status note). Inserted between Phase 3 and Phase 4 on explicit user direction: a real production MVP (guest/student flows for pre-recorded courses, admin course management + analytics + support) ships *before* Live Classes, not after. Phase 4's own Tasks 31–37 are renumbered to 38–44 below to make room, and Phase 4's former "Notification Service" task is reduced to an *extension* task (39) since the service now gets built here instead.
>
> **Resolved decisions** (do not revisit): "services" for MVP purposes means courses only, no Phase 5 Service Request Catalog pulled forward. OTP covers email verification + password reset; login 2FA is explicitly deferred to later. Account auto-lockout was found **already built** in `AuthService.login()` (`MAX_FAILED_ATTEMPTS=5`, `LOCK_DURATION_MINUTES=15`, publishes `user.locked`) — the gap was assumed to be just wiring an email to that existing event, not new lockout logic; **Task 37 found this assumption was only half right** — the lockout logic existed but never actually persisted due to a transactional rollback bug, fixed as part of Task 37 (see its status note). `EmailProvider` is pluggable — `LogEmailProvider` (log-only) is the code-level default, but this environment's local `.env` has `EMAIL_PROVIDER=smtp` pointing at a real Gmail account, so local dev genuinely sends real email, not just logs it. Support/enquiry is a deliberately thin two-state (`open`→`closed`) ticket flow — **admin never sends email through the platform**, they reply directly via their own email client (Gmail etc.) after seeing the submitter's email in the admin console; the platform only sends the automatic "submitted" and "closed" emails. Every other service publishes `{service, templateName, to, toName, variables}` to its **own existing exchange** (no new shared exchange) — Notification Service binds queues to the specific routing keys it cares about. Every email attempt gets exactly one row in an **immutable, insert-only `notification_logs`** collection — no update/delete path exists anywhere in the code for it. Brand color becomes `#F44336` (Material Red 500) with `-light`/`-dark` shades from Material's own adjacent Red palette (`#EF5350`/`#D32F2F`).
>
> **Architecture pivot mid-build (also user-directed):** Notification Service was originally scoped as NestJS + Postgres (matching `payment-service`/`upload-service`'s convention) — switched to **NestJS + MongoDB** instead, reusing the dedicated `grammarcetamol-mongo` instance (port `9015`) already provisioned for Live Class Service's future work. `notification_db` is simply a second database on that same instance. Official `mongodb` driver, no Mongoose, no migration runner — indexes created idempotently on `onModuleInit` instead of SQL migration files.

---

**Task 31: Notification Service — Bootstrap, Templates, Cross-Service Consumer, Immutable Logs, Support Tickets**

> **Status: ✅ Done**, confirmed via code review (not yet live-verified end-to-end against the real running stack — that's Task 37 below). `backend/notification-service` (NestJS + MongoDB, no ORM) is fully built: 9 `email_templates` seeded on startup via idempotent upsert-by-name (`templates.seed.ts`), an insert-only `notification_logs` collection with no update/delete path, a RabbitMQ consumer (`consumer/notification-consumer.service.ts`) bound to `user.exchange`/`payment.exchange`/`enrollment.exchange`, an `EmailProviderRegistry` with both `LogEmailProvider` (default) and a real `SmtpEmailProvider` registered, and the full support-ticket module (`support/`: create/list/detail/close) wired to the submitted/closed template sends. Gateway routing for `/api/support/**` is present.

**Objective:** Stand up `backend/notification-service/` (NestJS + MongoDB, port `9008`) as the one place outbound email happens, consuming events from auth/payment/enrollment-service, rendering named templates with dynamic variables, logging every attempt immutably, and hosting the lightweight support-ticket module.

**Implementation guidance:**
- No ORM, official `mongodb` driver (first Mongo consumer in this codebase), same `CurrentUser`/`ApiResponse`/`AllExceptionsFilter` conventions as `payment-service`. Connects to the dedicated `grammarcetamol-mongo` instance (`mongodb://platform:platform12345@localhost:9015/?authSource=admin`, database `notification_db`) — a completely separate instance from the pre-existing standalone `platform-mongo` (default `27017`, unrelated `notifications` database, never touched).
- **`email_templates`** collection: `name` (unique index), `subject`, `bodyHtml`, `bodyText`, `variables` (documented placeholder-name array), `isActive`, timestamps. Seeded on startup via idempotent upsert-by-name (not a one-shot migration file). Names: `email-verification-otp`, `password-reset-otp`, `account-locked`, `course-purchase-confirmation`, `payment-receipt`, `enrollment-confirmation`, `support-ticket-submitted`, `support-ticket-closed`, `newsletter`. Simple in-house `{{variableName}}` substitution — no templating library, matches the "minimize external packages" convention.
- **`notification_logs`** collection — **insert-only, no update, no delete, ever**: `service`, `templateName`, `recipientEmail`, `status` (`success`|`failed`), `errorMessage` (nullable), `createdAt`. No `updatedAt` field — its absence is the deliberate signal.
- **RabbitMQ consumer** — first NestJS consumer in this repo (every existing NestJS service only publishes so far). On init, idempotently `assertExchange` for `user.exchange`, `payment.exchange`, `enrollment.exchange`; bind one queue per routing key (`user.otp.verification`, `user.otp.password-reset`, `user.locked`, `payment.completed`, `enrollment.created`); ack-on-success / nack-no-requeue-on-parse-failure. Handler reads `templateName`/`to`/`toName`/`variables` straight off the payload (the publishing service names its own template — Notification Service never infers one from the routing key), renders, calls `EmailProvider.send()`, inserts exactly one `notification_logs` row either way.
- **`EmailProvider`/`EmailProviderRegistry`** — mirrors `PaymentProviderRegistry`/`StorageProviderRegistry` exactly. `LogEmailProvider` default logs what would be sent; a real provider later is a new class + registry entry, zero call-site changes.
- **`SupportController`** (same service, own module): `POST /api/support/tickets` (public/optionally-authenticated; creates the ticket, **directly calls the internal email-send function** — no RabbitMQ round-trip needed since Support lives in-process with the email logic — using `support-ticket-submitted`), `GET /api/support/tickets` (admin/moderator, filterable by status), `GET /api/support/tickets/{id}` (admin/moderator — surfaces the submitter's email prominently since replying happens in the admin's own email client, not here), `PATCH /api/support/tickets/{id}/close` (admin/moderator — sends `support-ticket-closed`). `support_tickets` collection: `name`, `email`, `userId` (nullable), `subject`, `message`, `courseId` (nullable), `status` (`open`|`closed`, default `open`), `closedBy`, `closedAt`, timestamps.
- **Gateway wiring**: `notificationServiceUrl` + `.route("support-service", r -> r.path("/api/support/**")...)`. `POST /api/support/tickets` in `OPTIONALLY_AUTHENTICATED_ROUTES`; everything else admin/moderator-gated in the controller.

**Tests:** consumer payload→template→send→log flow (success and failure both produce exactly one log row), template variable substitution, support ticket creation triggers the submitted email, closing triggers the closed email and only that email.

**Demo:** boots on `:9008`, templates seeded. A manual `user.locked` RabbitMQ message produces a real `notification_logs` row (`status='success'`) and a `LogEmailProvider` log line. Guest `POST /api/support/tickets` triggers the submitted email; admin `PATCH .../close` triggers the closed email; both logged.

---

**Task 32: Auth Service — OTP-Based Email Verification & Password Reset**

> **Status: ✅ Done**, confirmed via code review. `AuthService`/`AuthController`/`VerifyEmailRequest`/`ResetPasswordRequest` all carry OTP fields — the silent UUID-token flow described in this task's own Objective (`forgotPassword()`'s literal `// In production, send email here` comment) is gone, replaced with the 6-digit code flow as planned. **One deviation found during Task 37 verification:** the "bounded wrong-attempt guard per code" mentioned in this task's own guidance below was never built — `checkOtp()` only enforces the Redis TTL (~10 min), with no attempt counter, so a code can be brute-forced within its window (6 digits = 1M possibilities, no rate limit on `/verify-email`/`/reset-password` themselves). Not fixed as part of Task 37 — flagged as a real gap, not a blocker for MVP verification. **A separate, more clear-cut bug was found and fixed**: `resetPassword()` never cleared `failedAttempts`/`lockedUntil`, so a user who successfully OTP-reset their password while locked out stayed locked for up to 15 more minutes anyway. Fixed in `AuthService.resetPassword()` plus a new regression test (`AuthServiceTest.resetPassword_correctOtp_clearsExistingLockout`).

**Objective:** Replace the current silent UUID-token flow (verified live: sends nothing — `forgotPassword()` literally has the comment `// In production, send email here via mail service`) with real 6-digit OTP codes, emailed via the new Notification Service.

**Implementation guidance:**
- Change `register()`'s/`forgotPassword()`'s token generation from `UUID.randomUUID().toString()` to a 6-digit numeric code, same Redis key/TTL pattern (`verify:<code>`/`fp:<code>` → userId) but a shorter, OTP-appropriate TTL (~10 min) paired with a bounded wrong-attempt guard per code (same shape as the existing lockout counter, not a new subsystem).
- `verifyEmail`: `GET ...?token=` (link-click) → `POST /api/auth/verify-email {email, otp}` (form submission). `resetPassword`: body becomes `{email, otp, newPassword}`.
- After generating each OTP, publish via the existing `UserEventPublisher` (`user.exchange`): `user.otp.verification` → `{service, templateName: "email-verification-otp", to, toName, variables: {otp, expiresInMinutes}}`; `user.otp.password-reset` similarly.
- `user.locked` is **already published** — no auth-service change needed, Task 31's binding is the only missing piece.

**Tests:** OTP format/TTL/bounded-attempt behavior, the two new event-publish calls (mock `UserEventPublisher`, assert routing key + payload).

**Demo:** `POST /api/auth/register` → a real `user.otp.verification` event with a 6-digit `otp` → `POST /api/auth/verify-email {email, otp}` succeeds and flips status to `ACTIVE`; wrong/expired codes rejected. Same round-trip for forgot/reset.

---

**Task 33: Payment & Enrollment Events — Enrich Payloads for Email**

> **Status: ✅ Done**, confirmed via code review, implemented as a slightly different mechanism than this task's literal wording ("enrich `payment.completed`'s payload") but the same end result: `payment-service` publishes a dedicated `payment.notification` event via a new `PaymentEventPublisher.publishNotification(templateName, to, toName, variables)` method — called from `payments.service.ts` with a real `auth-service` user lookup, firing both `course-purchase-confirmation` and `payment-receipt` off one successful payment — rather than adding `to`/`toName` fields directly onto `payment.completed` itself (which still carries only its original domain payload for `enrollment-service`'s own consumer). `enrollment-service`'s `EnrollmentEventPublisher` does the equivalent for `enrollment-confirmation`. Notification Service still never does its own lookup, matching the objective.

**Objective:** Give Notification Service everything it needs without it looking anything up itself — the *publishing* service supplies `to`/`toName`/`variables` directly, per the user's own spec.

**Implementation guidance:**
- `payment-service`'s `payment.completed` publish gains `to`/`toName` (resolved via a call to auth-service's existing `GET /api/users/{id}`, the same internal-trusted-caller pattern `CourseServiceClient`/`UploadServiceClient` already use) and fires both `course-purchase-confirmation` and `payment-receipt` template sends off this one event.
- `enrollment-service`'s `EnrollmentEventPublisher`'s `enrollment.created` publish gains the same enrichment + `templateName: "enrollment-confirmation"` — covers both free and paid enrollment (paid already flows through `enrollment.created` via enrollment-service's own `payment.completed` consumer).

**Tests:** mock the auth-service HTTP call in both services' existing suites; assert the enriched payload shape.

**Demo:** a real Paystack test-mode purchase produces two successful `notification_logs` entries; a real free enrollment produces one.

---

**Task 34: Student Frontend — OTP Verification/Reset UI & Support Enquiry Form**

> **Status: ✅ Done**, confirmed via code review. `/verify-email` and `/reset-password` are code-entry forms; a `/support` page exists with `lib/support.api.ts` posting to Task 31's endpoint.

**Objective:** Update verification/reset from link-based to code-entry; give guests/students a support enquiry form.

**Implementation guidance:**
- `/verify-email`: auto-verify-on-load → a 6-digit code-entry form with resend (reusing the existing rate-limit UX). `/reset-password`: code input alongside the new password field.
- New `/support` page/modal — name/email (pre-filled if logged in)/subject/message/optional course, posts to Task 31's endpoint, success state confirms "check your email."
- `lib/support.api.ts`; `lib/auth.api.ts`'s verify/reset calls updated to the new request bodies.

**Tests:** OTP-input validation (6 digits, numeric), support form client-side validation.

**Demo:** freshly registered student enters the (dev-logged) OTP and verifies; a guest submits `/support` and sees a confirmation state.

---

**Task 35: Admin Frontend — Support Tickets & Real Dashboard Analytics**

> **Status: ✅ Done**, confirmed via code review. Admin `/support` (list + status filter + detail + close, no reply UI, per the resolved decision) exists. `/dashboard` (`apps/admin/app/(dashboard)/dashboard/page.tsx`) now fetches real data via `useFetch` — student count, published-course count, `/revenue`'s summary, and open-ticket count — replacing the static four-box skeleton this task's Objective describes as the starting point.

**Objective:** Give admins the support-ticket list/detail/close workflow, and replace the current static-skeleton `/dashboard` (verified live: four hardcoded skeleton placeholders, zero data fetching) with real aggregated numbers.

**Implementation guidance:**
- `/support` — `DataTable` (name/email/subject/status/date), status filter, row → detail. `/support/[id]` — message + submitter email prominently displayed + a single "Close Ticket" action, **no response/reply UI** per the resolved decision.
- `/dashboard` — real numbers: total students, published-course count, revenue (reuse `/revenue`'s summary endpoint, don't duplicate its aggregation), and a real open-ticket count replacing the fake "Support Requests" label. Reuse existing `StatCard`/chart primitives from `apps/utilities`.

**Tests:** any pure formatting/aggregation helper as a logic test.

**Demo:** admin closes a real ticket, submitter gets the closed email; `/dashboard` shows real numbers that change as new data arrives.

---

**Task 36: Brand Color Rollout — `#F44336`**

> **Status: ⚠️ Mostly done**, confirmed via code review. Both apps' `globals.css` `@theme` blocks carry `--color-primary: #F44336`, `--color-primary-light: #EF5350`, `--color-primary-dark: #D32F2F`, and the orphaned `apps/utilities/src/tokens/tokens.ts`/`tokens.css` are no longer exported from the package's `index.ts` (cleaned up). **Not done:** `apps/utilities/src/components/Button/Button.tsx` still has the two hardcoded arbitrary-hex classes this task calls out by name — `text-[#64748B]` (ghost variant) and `hover:bg-[#DC2626]` (destructive hover) — neither replaced with a semantic token.

**Objective:** Replace the current navy (`#1E3A5F`) primary with the new orange-red across both frontends' buttons/hover/nav/sidebar.

**Implementation guidance:**
- Both apps' `@theme` blocks (`apps/admin/app/globals.css`, `apps/student/app/globals.css` — verified live: these have already diverged, not a copy-paste between them): `--color-primary: #F44336`, `--color-primary-light: #EF5350`, new `--color-primary-dark: #D32F2F` (doesn't exist in either app today — needed for `hover:bg-primary-dark`-style classes to exist at all under Tailwind v4's `@theme`-only wiring, no `tailwind.config.ts` exists).
- Fix `apps/utilities/src/components/Button/Button.tsx`'s two hardcoded arbitrary-hex classes (verified live: `text-[#64748B]`, `hover:bg-[#DC2626]`) — the destructive-hover one especially should get a real semantic variable instead of a bare hex.
- Grep specifically for the *old* primary hex (`#1E3A5F`/`#2A5285`/`#152B47`) across both apps' page files — not the full ~180-hit hardcoded-hex sweep, which is overwhelmingly unrelated semantic-state color — and replace hits with semantic classes.
- Clean up `apps/utilities/src/tokens/tokens.ts`/`tokens.css` — confirmed live: orphaned, unconsumed, already-drifted duplicates of the real theme (`tokens.ts` is still publicly exported from the package's `index.ts` though nothing imports it).
- `Sidebar.tsx`/`TopHeader.tsx` need no direct changes — already fully semantic, pick up the new color automatically.

**Tests:** none needed for a pure color-value change — verified visually.

**Demo:** both apps' primary buttons/nav/sidebar/hover render the new red family; no navy remains on any primary-branded surface.

---

**Task 37: MVP Integration & Verification**

> **Status: ✅ Done (2026-08-19).** Full local stack brought up (all 8 backend services + both frontends) and verified live — not just via the new automated suite. `backend/integration-tests/notification-flow.integration.spec.ts` added (23 new tests: OTP email-verification round-trip with a real wrong-code 401 and correct-code 200, the account-lockout→locked-email→OTP-reset recovery chain, a full support-ticket create→close lifecycle with `notification_logs` assertions on every email template, and a 401/403 sweep on notification-service's admin-gated endpoints). All 7 spec files / 82 tests pass together (`npm test`, `--runInBand`).
>
> **Three real bugs found and fixed during this pass** (same discipline as Task 30's LockIcon/allowDownload finds):
> 1. **Account lockout never actually persisted.** `AuthService.login()` is `@Transactional`, and Spring's default rollback-on-unchecked-exception silently discarded every `failedAttempts`/`lockedUntil` update the instant it was written, because the method always ends a failed attempt by throwing. Confirmed live: 5 wrong-password curl attempts left `failed_attempts = 0` in the database, every time. This means the lockout feature — a headline piece of Phase 3.5's security scope — has never worked in this codebase. Fixed by extracting the increment/lock logic into a new `LoginAttemptService.recordFailedAttempt()`, `@Transactional(propagation = REQUIRES_NEW)` so it commits independently before the caller's transaction rolls back. New tests: `LoginAttemptServiceTest` (2 tests) plus `AuthServiceTest`'s existing lockout tests updated to match. Live-reverified after the fix: 5 wrong attempts now genuinely lock the account and persist to Postgres.
> 2. **`resetPassword()` never cleared an existing lockout.** A user who correctly OTP-reset their password while locked out stayed locked for up to 15 more minutes anyway, despite proving their identity. Fixed in the same file; regression test `resetPassword_correctOtp_clearsExistingLockout`.
> 3. **Admin frontend's dev server couldn't log in in the browser at all.** `apps/admin/package.json`'s `dev` script ran on port `3006`, not the `3001` every other reference in the codebase assumes (`start` script, root `README.md`, gateway's CORS `allowedOrigins`) — a genuine regression from an unrelated commit (`a1a0222`, "Add NGINX configuration and deployment scripts"), confirmed via `git log -S`. The mismatch meant the browser's CORS preflight to `/api/auth/login` got a 403, and login failed outright — this would have blocked local development entirely the moment someone tried a real browser login rather than `curl`. Fixed by reverting the port to `3001`; also found and cleared a second, unrelated issue on the same server — a stale Turbopack `.next` cache made `/login` 404 even after the port fix, same class of bug as Task 30's `LockIcon` incident, fixed the same way (`rm -rf apps/admin/.next` + restart).
>
> Also found and fixed: the gateway's `RateLimitConfig.authRateLimiter()` Javadoc claimed it only applied to `/api/auth/login` and `/api/auth/register`, but `RouteConfig` actually binds it to the whole `/api/auth/**` path — comment corrected. `backend/integration-tests/helpers.ts`'s `api()`/`login()` gained a 429-retry-with-backoff specifically for `/api/auth/**` calls, since this suite's own real traffic can legitimately exhaust that shared IP-scoped bucket across spec files in one `--runInBand` run.
>
> Live-verified in the browser (not just curl/Jest): admin login → dashboard shows real numbers (27 students, ₦0 revenue, 0 open tickets — all genuinely live, not seeded), both apps' `--color-primary` computes to `#f44336` in the actual DOM. Full chain 1 (guest→register→OTP-verify→enroll/pay→learn→review) and chain 4 (admin publish→dashboard) reuse the already-passing course-catalog/enrollment-learning/payment-flow specs rather than re-proving them here — chains 2 and 3 are what's new in this task and are the ones covered above.

**Objective:** Confirm the full MVP loop end-to-end through the gateway across both frontends, same discipline as Task 30 closed out Phase 3.

**Implementation guidance:**
- Full chain: guest browses → registers → OTP-verifies → logs in → free-enrolls one course + real-pays for another → gets purchase/receipt emails → learns → reviews.
- Second chain: 5 wrong passwords locks the account → locked email; forgot-password → OTP → reset succeeds.
- Third chain: guest submits a support enquiry → submitted email; admin closes it → closed email.
- Fourth chain: admin uploads + publishes a course, sees it live and in `/dashboard`'s real numbers.
- Visual: new `#F44336` brand color consistent across both apps.
- Extend `backend/integration-tests` with `notification-flow.integration.spec.ts`: OTP verify/reset round-trip, support-ticket create→close with `notification_logs` assertions, 401/403 sweep on Notification Service's admin-gated endpoints.
- Update `PLAN.md`/`implementation-phases.md`/`todo.md` status notes for Tasks 31–36 as each is actually verified.

**Tests:** the unit/integration tests specified in Tasks 31–36, run together, plus the new integration-test file.

**Demo:** a real, unscripted end-to-end pass through every chain above, with `notification_logs` as the audit trail proving every email attempt actually happened.

---

### PHASE 4 — Live Classes & Notifications

> **📍 Status tracking for this phase has moved to [`PHASE4.md`](./PHASE4.md)** — that file is
> now the single source of truth for what's done/in-progress/blocked across Tasks 38–45, kept
> up to date as a living tracker rather than a status blockquote per task. The task specs
> below (Objective/Implementation guidance/Tests/Demo) remain here and don't move — `PHASE4.md`
> links back to them rather than duplicating them. Do not add a new status note directly below
> this line; update `PHASE4.md` instead.
>
> **Renumbered 2026-08-19** after the user supplied a full domain/business-rule spec for the
> live-class system. Tasks 38–44 below are the *old* numbering; each has been renumbered by one
> (38→39, 39→40, 40→41, 41→42, 42→43, 43→44, 44→45) and a new Task 38 (Payment Service —
> Subscription Billing) inserted ahead of the old Task 38, since recurring-billing classes
> can't be built without it. **`PHASE4.md`'s Domain Model section is the canonical reference**
> for the Class/Session/Enrollment/Subscription entities everything below now assumes — read
> it before touching any task in this phase.

---

**Task 38: Payment Service — Subscription Billing**

> **Status: ✅ Done (2026-08-19), live-verified against the real Paystack test-mode API and the
> real running service** — not just unit tests. Confirmed live: creating an arbitrary-amount
> Plan works (Paystack Plans aren't restricted to dashboard-predefined pricing, resolving this
> task's own flagged risk), initializing a transaction with `plan` attached returns the same
> shape as a normal initialize, the `subscription/disable` endpoint's `{code,token}` shape is
> correct, and a real `POST /api/subscriptions` → simulated `charge.success` webhook (real HMAC
> signature) → `subscription.create` webhook round-trip correctly activates a subscription,
> backfills `paystack_subscription_code`/`paystack_email_token`, and matches the exact
> `gateway_ref` row rather than a broader update (confirmed by running two concurrent
> subscribe requests and checking only the targeted one activated). Cancel's error path was
> live-verified too (a fake subscription code correctly surfaces a clean 503, not a crash); a
> full successful cancel needs a genuinely completed real checkout (paying via the
> `authorizationUrl` in a browser), left for Task 45's fuller pass. 41/41 tests pass
> (27 existing + 14 new), `tsc --noEmit` clean.
>
> One deviation from `PHASE4.md`'s Domain Model, made necessary by how Paystack actually works:
> added a `pending` status not in the original five-state list — Paystack's
> initialize-with-plan flow is asynchronous (the real subscription only exists once
> `subscription.create` arrives), so a row can legitimately exist before it's `active`, the
> same async gap the existing one-time `payments` table already bridges with its own `pending`
> status. `PHASE4.md` updated to match.

**Objective:** Extend the already-built `backend/payment-service` (Paystack, pluggable `PaymentProvider`, Task 21) with recurring billing, so Task 39's Live Class Service can offer `RECURRING` classes — both a 50-student group class billing everyone monthly and a single negotiated-price private tutoring arrangement — without either owning any Paystack-specific logic itself. See `PHASE4.md`'s Domain Model for the full `subscriptions` entity and lifecycle this task implements.

**Implementation guidance:**
- New Postgres table `subscriptions` in `payment-service`'s existing `payment_db` (hand-rolled SQL migration, same convention as its existing tables): `userId`, `itemType` (generic, e.g. `'live-class'` — mirrors the item-agnostic shape `payment-service` already needs for one-time paid-class registration), `itemId`, `paystackSubscriptionCode`, `paystackCustomerCode`, `planCode`, `status` (`ACTIVE`|`PAYMENT_FAILED`|`PAST_DUE`|`CANCELLED`|`EXPIRED`), `amount`, `currency`, `interval` (`monthly` etc.), `currentPeriodEnd`, timestamps.
- **`SubscriptionsController`**: `POST /api/subscriptions` (authenticated; creates/reuses a Paystack customer, creates a Paystack Plan on the fly if one doesn't already exist for this exact `amount`+`interval`+`currency` combo — negotiated private-class prices mean plans can't all be pre-created — then creates the subscription, returns the authorization URL the same way `payment-service`'s existing `initialize` flow does), `GET /api/subscriptions/mine`, `POST /api/subscriptions/{id}/cancel` (authenticated, owner-only; calls Paystack's disable-subscription endpoint, sets `status='CANCELLED'` — **does not** touch the caller's class access, that's the consuming service's job via the `currentPeriodEnd` it already has from the `subscription.cancelled` event below), `GET /api/subscriptions/{id}` (admin/moderator or owner).
- **Paystack webhook handling** — extend the existing webhook endpoint (don't create a second one) to also handle `subscription.create`, `subscription.disable`, `invoice.create`, `invoice.payment_failed`, and recurring `charge.success` events, same signature-verification path already in place for one-time payments. On successful recurring charge: update `currentPeriodEnd`, ensure `status='ACTIVE'`, publish `subscription.charged`. On `invoice.payment_failed`: set `status='PAYMENT_FAILED'`; if Paystack's own retry schedule is exhausted (its final `invoice.payment_failed` for that cycle), set `status='PAST_DUE'` then, after a short grace window checked by a `@Cron()` sweep, `EXPIRED` — publish `subscription.expired` either way so the consuming service knows to end access.
- **RabbitMQ**: new `subscription.exchange`, publishing `subscription.created`, `subscription.charged`, `subscription.cancelled`, `subscription.expired` — every payload carries `userId`/`itemType`/`itemId`/`currentPeriodEnd` so Task 39's Live Class Service (or any future recurring-billed item type) never needs to call back into `payment-service` synchronously to know what changed.
- **Gateway wiring**: `.route("subscriptions", r -> r.path("/api/subscriptions/**")...)` — same host/port as the rest of `payment-service`, fully authenticated (no public routes).
- **Flag as a real risk, not an assumption**: verify the on-the-fly Plan creation path against Paystack's real test-mode API — Paystack Plans are typically pre-created in their dashboard for fixed pricing, and this project's negotiated/arbitrary pricing needs plans created programmatically per unique price point instead. Confirm this actually works against the real API before building anything on top of it.

**Tests:** Jest unit tests — plan-reuse-vs-create-new decision logic, webhook signature verification (reused from the existing suite), the `PAYMENT_FAILED`→`PAST_DUE`→`EXPIRED` transition timing, cancel-does-not-immediately-revoke-access (i.e. this service never touches anything outside its own `subscriptions` table).

**Demo:** A real Paystack test-mode subscription created via `POST /api/subscriptions` → a simulated recurring `charge.success` webhook extends `currentPeriodEnd` and publishes `subscription.charged` → `POST /api/subscriptions/{id}/cancel` sets `status='CANCELLED'` immediately but a consuming service reading `currentPeriodEnd` would still see access-until-period-end, provable by inspecting the row directly.

---

**Task 39: Live Class Service — Classes, Sessions, Enrollments, Chat, Scheduling & Join-Room**

> **Status: ✅ Done (2026-08-19), live-verified against the real running stack** — not just
> unit tests. `backend/live-class-service` boots clean on `:9007`, Mongo indexes create on
> startup, all RabbitMQ bindings confirmed. Live-verified in full: a real overlapping-session
> conflict correctly 409s; a recurring weekly schedule correctly generates exactly 10 real
> `live_sessions` rows (bulk `insertMany` path, not just the single-session path); the
> four-way room-authorization chain (not-enrolled → enroll → too-early → start → real `roomId`
> revealed → end → parent class status untouched) proven end-to-end; chat lock → student 403 →
> unlock → post succeeds → re-lock → 403 again, exactly matching the task's own demo criteria;
> capacity boundary enforced (2/2 seats → 3rd enrollment 409); a `PRIVATE`/`INVITE_ONLY`/
> `RECURRING` class fully round-tripped — uninvited self-enroll blocked, invite issued with a
> negotiated price different from the class default, invitation accepted → a real Paystack
> subscription created → a real HMAC-signed webhook simulation activates it → the RabbitMQ
> consumer correctly flips the enrollment to `ACTIVE` → the student can post in chat, proving
> `hasAccess` genuinely reads the activated enrollment, not a stub. 33/33 unit tests pass,
> `tsc --noEmit` clean.
>
> **Three real bugs found and fixed during live verification, not caught by unit tests:**
> 1. `POST /api/classes/{id}/sessions`'s response returned the raw session document, leaking
>    `roomId`/`videoDomain` — the exact secret the whole room-reveal design exists to protect.
>    Fixed to route through `toPublicSession()` like every other session-returning endpoint.
> 2. `item_id` was typed strict Postgres `UUID` in both `payment-service`'s `subscriptions`
>    (Task 38) and the new `payments.item_id` column — but Live Class Service's `classId` is a
>    MongoDB ObjectId hex string, not a UUID, so every cross-service payment/subscription call
>    failed outright. Fixed with a new `V4__item_id_as_string.sql` migration (Postgres
>    migrations are immutable once applied in this project, so this is a follow-up ALTER, not
>    an edit to V2/V3) and removed the incorrect `@IsUUID()` validator from
>    `InitializeItemPaymentDto`.
> 3. `EnrollmentsService.createEnrollment` had no idempotency check before inserting — if the
>    payment-service call failed *after* the enrollment row was already written (exactly what
>    bug #2 caused during testing), retrying crashed on the `{classId,studentId}` unique index
>    instead of resuming. Fixed by moving the existing-enrollment check (already present in
>    `enroll()`) into `createEnrollment` itself, so both `enroll()` and `acceptInvitation()`
>    get idempotency for free.
>
> Not exercised live: a full successful subscription **cancel** against a real Paystack
> subscription code (would need a completed real checkout via the `authorizationUrl` in a
> browser) — the cancel error path was verified instead (Task 38's own note). `PHASE4.md`'s
> status table and Update Log carry the same summary.

**Objective:** Stand up `backend/live-class-service/` implementing the full domain model in `PHASE4.md` — persistent `Class`es (group or private, open or invite-only, free/one-time/recurring) each containing independent `LiveSession` occurrences, real-time moderated chat, materials, backend-enforced join-room authorization, and instructor scheduling conflict detection — not just a single-session booking system. This supersedes the lighter original draft of this task; read `PHASE4.md`'s Domain Model section first, it's the source of truth for every entity/field named below.

**Implementation guidance:**
- New NestJS project at `backend/live-class-service/`, port `9007`. Second Mongo-backed service in the repo — `backend/notification-service` (Task 31) already established the pattern: official `mongodb` driver, no Mongoose, no migration runner, index creation as an idempotent `onModuleInit` step (`createIndex` calls, safe to re-run). Reuse that `DatabaseModule` shape directly rather than re-deriving it.
- **Database provisioning — done ahead of this task, already in `docker/docker-compose.dev.yml`**: the dedicated `mongo` service (`mongo:7`, container `grammarcetamol-mongo`, port `9015:27017`, credentials `platform`/`platform12345`) — a completely separate instance from the pre-existing standalone `platform-mongo` container on `27017`, left untouched. Point this service's `MONGO_URL` at `mongodb://platform:platform12345@localhost:9015`, its own database.
- **Collections** — `classes`, `live_sessions`, `enrollments`, `class_materials`, `class_chat_messages`: full field lists in `PHASE4.md`'s Domain Model. Indexes: `classes` on `{instructorId, status}`; `live_sessions` on `{classId, startTime}` and `{instructorId, startTime}` (the conflict-check index — see below); `enrollments` unique on `{classId, studentId}`; `class_materials` on `{classId, sessionId}`; `class_chat_messages` on `{classId, createdAt}`.
- **`ClassesController`**: `POST /api/classes` (instructor/admin/moderator; `classType`, `accessMode`, `paymentModel`, `defaultPrice`/`billingInterval` if applicable, `capacity`, `schedules[]`), `PATCH /api/classes/{id}`, `GET /api/classes` (Upcoming/Past/Mine + `classType`/`accessMode`/instructor/search filters, `OPEN`-only for anonymous browsing), `GET /api/classes/{id}`, `POST /api/classes/{id}/publish` (`DRAFT`→`PUBLISHED`), `POST /api/classes/{id}/end` (`ACTIVE`→`ENDED`, starts the `materialsRetentionDays` countdown — see Retention & Archival in `PHASE4.md`), `PATCH /api/classes/{id}/chat-lock` (admin/instructor toggles `chatLocked`).
- **Enrollment & invitations**: `POST /api/classes/{id}/enroll` (authenticated student, `OPEN` classes only; `FREE` creates an `ACTIVE` enrollment immediately, idempotent on `{classId,studentId}`; `ONE_TIME` goes through the existing `payment.completed` consumer pattern keyed by a new `itemType='live-class'`/`itemId` pair on `payment-service`'s initialize DTO; `RECURRING` calls Task 38's `POST /api/subscriptions` and creates a `PENDING_PAYMENT` enrollment that flips to `ACTIVE` on `subscription.created`), `POST /api/classes/{id}/invite` (instructor/admin, `INVITE_ONLY` classes only; generates a single-use invitation token tied to a specific student email/id, optionally a `negotiatedPrice` override), `POST /api/invitations/{token}/accept` (validates the token, follows the same `FREE`/`ONE_TIME`/`RECURRING` branching as `enroll` above using the invite's negotiated price if set), `DELETE /api/enrollments/{id}` (student self-cancel — for `RECURRING`, calls Task 38's cancel endpoint first, then sets `enrollments.status` per the access-vs-billing rule: stays `ACTIVE` with `accessUntil` set until period end, a cron flips it to `EXPIRED` after).
- **Subscription/payment event consumers**: bind `subscription.exchange` (Task 38) for `subscription.created` (flip `PENDING_PAYMENT`→`ACTIVE`), `subscription.charged` (extend `accessUntil`), `subscription.expired` (set `enrollments.status='EXPIRED'`, `endedReason='payment_failed'`); bind `payment.exchange` for `payment.completed` (`itemType='live-class'`) the same way `enrollment-service` already consumes it for one-time course purchases.
- **Scheduling & conflict detection**: `PATCH /api/classes/{id}/schedules` triggers `SessionGeneratorService` to (re)generate a rolling ~8–12 week window of `live_sessions` from the `schedules[]` templates; every generation and every manual one-off `POST /api/classes/{id}/sessions` runs the same conflict check — any other non-cancelled `live_sessions` row for the same `instructorId` whose `[startTime,endTime)` overlaps → 409 with the conflicting session's detail. A `@Cron()` extends the generated window forward weekly so it never runs dry. `GET /api/instructors/{id}/availability` backs the admin create/edit form's real-time check (Task 43).
- **`GET /api/classes/{id}/sessions/{sessionId}/room`** — **the only endpoint that ever returns `roomId`**, backend-enforcing all four conditions in `PHASE4.md`'s "Join-button + chat gating" section (active enrollment within `accessUntil`, session actually `LIVE`, invite-origin check for `INVITE_ONLY` classes). 403 distinguishes too-early / not-enrolled / session-ended / invite-not-accepted.
- **Session lifecycle**: `POST /api/sessions/{id}/start` and `.../end` (instructor-only; flips `SCHEDULED`→`LIVE`→`ENDED`, publishes `liveclass.session.started`/`liveclass.session.ended` — session ending never touches the parent class's own `status`). A `@Cron()` also auto-flips a session to `ENDED` if `now() > endTime + grace` and nobody ever started it, so stale `LIVE`/`SCHEDULED` rows don't linger.
- **Reminders — no Kubernetes CronJobs** (established "no k8s/heavy infra work" constraint, same reason Media Service remains deferred): `@nestjs/schedule`'s in-process `@Cron()` (every minute) querying sessions starting in the ~24h/~1h/~15min windows that haven't already had that tier sent — track sent tiers as an array field on the session document so a restart mid-run can't double-fire. Publishes one `liveclass.session.reminder` event per active enrollment.
- **Materials**: `POST /api/classes/{id}/materials` (`sessionId` optional — null for class-level), `GET /api/classes/{id}/materials` (enrolled students see everything up to and including their `enrolledAt`, per the "late joiner can catch up" rule — don't hide session-scoped materials from sessions that already happened before the student joined).
- **Chat**: `GET /api/classes/{id}/messages` (paginated, any active enrollment), `POST /api/classes/{id}/messages` (checks `chatLocked` + enrollment `status`/`accessUntil`, 403 if locked). No WebSocket in this task — polling is fine for chat (SSE is Task 40's job for the notification bell specifically); revisit only if chat itself needs to feel more real-time later.
- **`VideoProvider` abstraction** — mirrors `PaymentProvider`/`EmailProvider`/`StorageProvider` exactly: `JitsiProvider` (the only implementation for now, wraps `meet.jit.si` room-name generation) registered in a `VideoProviderRegistry`; adding Zoom/Loom later is a new class + registry entry, zero call-site changes.
- **RabbitMQ**: `LiveClassEventPublisher` (raw `amqplib`, same `TopicExchange`/`persistent:true`/try-catch-log-never-throw shape as `payment-event-publisher.ts`) publishes `liveclass.class.created/updated/ended`, `liveclass.session.created/started/ended/cancelled/reminder`, `liveclass.enrollment.created/cancelled`.
- **Gateway wiring**: `liveClassServiceUrl` in `AppGatewayProperties`/`application.yml`; `.route("live-class-service", r -> r.path("/api/classes/**", "/api/invitations/**", "/api/instructors/**", "/api/sessions/**", "/api/enrollments/**").uri(...))`. `GET /api/classes` (OPEN only) and `GET /api/classes/{id}` go in `OPTIONALLY_AUTHENTICATED_ROUTES`; everything else — including `.../room`, `.../enroll`, `.../messages`, invitation accept — stays fully authenticated.

**Tests:** Jest unit tests — instructor double-booking conflict detection (overlapping / adjacent-non-overlapping / different-day / across recurring-generated sessions), capacity boundary, the room-authorization four-way logic (too-early/not-enrolled/ended/invite-not-accepted vs. success), idempotent free enrollment, `accessUntil` vs. `subscriptions.status` divergence (a cancelled-but-still-paid-through enrollment must still pass access checks), chat-lock gating, the reminder cron's "already-sent-this-tier" guard, session-ending-doesn't-end-class.

**Demo:** `npm run start:dev` boots on `:9007`, Mongo indexes create cleanly. Scheduling two overlapping sessions for the same instructor (including one generated from a recurring schedule) → second attempt returns 409. A student calling `.../room` before the session goes `LIVE` gets 403 "too early"; after `POST .../start`, gets the real `roomId`. A private `INVITE_ONLY` class: instructor invites a specific student, student accepts, pays if priced, gets access; an uninvited student cannot self-enroll. A `RECURRING` group class: two students subscribe independently; one cancels — their `accessUntil` is set to period end, the other student and the class itself are completely unaffected. Chat: locked by default, admin unlocks, student posts, admin locks again and the next post attempt 403s.

---

**Task 40: Notification Service — Extend for Live Classes (In-App Center, SSE, Announcements)**

> **Status: see [`PHASE4.md`](./PHASE4.md).** Short version: part of this task's scope
> (`GET /api/notifications`, `unread-count`, `read-all`, `{id}/read`, `{id}` delete, plus the
> student bell/`/notifications` page) already exists from earlier Task 31 work — the real
> remaining gap is wiring the consumer to populate it, SSE, preferences, and Announcements.
> Full detail in `PHASE4.md`'s "What's already there" section — don't duplicate it here.

**Objective:** Extend the already-built `backend/notification-service` (Phase 3.5 Task 31 — bootstrap, `email_templates`, `notification_logs`, `EmailProvider`, the cross-service consumer, Support tickets) with the pieces Phase 4 specifically needs that weren't part of the MVP: an in-app notification center, SSE streaming, and the Announcement system — rather than building the service from scratch.

**Implementation guidance:**
- Add MongoDB collections: `notifications` (in-app rows — separate from the immutable `notification_logs` audit trail, this one is genuinely mutable: `read`/`unread`/`archived`) and `user_notification_preferences`. Plus a new `announcements` collection (`title`, `body`, `targetType` `all|courses|segments`, `targetIds`, `priority` `low|normal|high|critical`, `status` `draft|scheduled|published|expired`, `publishAt`, `expiresAt`, `createdBy`, timestamps) — at publish time fans out into individual `notifications` rows per matched user. "Segments" targeting is a documented no-op — no real user-segment concept exists anywhere in this codebase; don't invent one just to fill the field.
- Extend the existing RabbitMQ consumer (Task 31 already has the idempotent-`assertExchange`-plus-bind pattern working) with new bindings on **`liveclass.exchange`** (Task 39's publisher — `liveclass.session.reminder`, `liveclass.session.started`, `liveclass.class.ended`) and **`subscription.exchange`** (Task 38's publisher — `subscription.charged` for a receipt-style notification, `subscription.expired` for "your class access has ended"), in addition to the bindings Task 31 already has. Each of these needs a real `email_templates` entry the same way Task 31's originals do (`live-class-reminder`, `live-class-starting`, `class-ended`, `subscription-payment-failed`).
- **`NotificationsController`**: `GET /api/notifications` (own, paginated, filterable), `PATCH /api/notifications/{id}/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications/{id}`, `GET /api/notifications/unread-count`, `GET /api/notifications/stream` (**Server-Sent Events** — an in-process `EventEmitter`/RxJS `Subject` the consumer handler also writes to when it inserts a row), `GET`/`PUT /api/notification-preferences`.
- **`AnnouncementsController`** (SUPER_ADMIN/MODERATOR only): full CRUD + `POST .../publish` + `POST .../send-test` (via the already-built `EmailProvider`) + `GET .../recipient-count` (dry-run). A `@Cron()` sweep publishes anything `status='scheduled' AND publishAt <= now()`. High/critical priority also calls `EmailProvider.send()` per matched recipient, same as any other Task-31-style send, logged the same way in `notification_logs`.
- **Gateway wiring**: add routes for `/api/notifications/**`, `/api/announcements/**`, `/api/notification-preferences` (the `/api/support/**` route already exists from Task 31). **Flag as a real risk to verify, not silently assume works**: `GET /api/notifications/stream` needs to be confirmed live with `curl -N` to actually stream through Spring Cloud Gateway's Netty-based reactive proxy without being buffered by the existing `JwtAuthFilter`/rate-limit `GlobalFilter`s. Fallback if it doesn't stream cleanly: client-side polling of `unread-count` instead of true SSE (Task 42 builds this fallback into the frontend client regardless).

**Tests:** announcement audience resolution per `targetType`, recipient-count dry-run matching a real publish's fan-out, the scheduled-publish cron's "already published" guard, high-priority triggering `EmailProvider.send` while normal/low don't, the new consumer bindings' routing (both exchanges).

**Demo:** a manual `liveclass.session.reminder` RabbitMQ message produces a real row in `GET /api/notifications`. A manual `subscription.expired` message produces a real "class access ended" notification + email. Admin creates a `high`-priority "all" announcement → logged simulated send per matched user, shows up for a test student. `curl -N` against `/api/notifications/stream` through the gateway (authenticated) receives a live event while the connection is open.

---

**Task 41: Student Frontend — Live Classes, Classroom & Join Flow**

> **Status: see [`PHASE4.md`](./PHASE4.md).** Short version: done and live-verified
> (2026-08-19), with one deliberate deviation from the guidance below — class chat uses real
> Socket.IO sockets, not polling, per explicit later user direction. Three real backend bugs
> found and fixed along the way (no student-enrollment-listing endpoint existed at all, a
> pre-existing gateway route collision with course-enrollment-service, and a missing invitation-
> preview endpoint), plus a fourth found building the socket work (`ChatService.post()`
> returned a raw Mongo document instead of the public shape `list()` returns). Full detail in
> `PHASE4.md`'s own Task 41 Update Log entry — don't duplicate it here.

**Objective:** Let students browse/enroll in classes (free, one-time-paid, or subscription), accept private-class invitations, live inside a class's persistent classroom (moderated chat + materials), and join the actual video call only when a session is live and only through the embedded, never-exposed-link flow — all backend-enforced per `PHASE4.md`'s Domain Model, not just gated in the UI.

**Implementation guidance:**
- `lib/classes.api.ts` — `listClasses(filters)`, `getClass(id)`, `enrollInClass(id)`, `acceptInvitation(token)`, `getMyClasses()`, `cancelEnrollment(id)` (for `RECURRING` enrollments, surfaces the `accessUntil` date from the response so the UI can say "access continues until <date>", not just "cancelled"). Paid enrollment (`ONE_TIME`): extend `/checkout/[courseId]`'s pattern with an `itemType='live-class'` param or build a thin variant — decide once both exist, same open-call precedent as Task 29's `/students`-vs-`/users` reuse decision. `RECURRING` enrollment goes through Task 38's `POST /api/subscriptions` via the class-service enroll endpoint, which returns the same kind of authorization URL the one-time flow already does.
- `/live-classes` — Upcoming | Past | Mine tabs, filters (date range/instructor/class type/search), card grid: banner, title, `classType` badge (Group/Private), schedule summary (from `schedules[]`, not a single date/time), instructor, price/Free/Subscription badge, capacity indicator for `GROUP` classes, Enroll/Buy/Subscribe/Enter Classroom button per the class's actual state. `INVITE_ONLY` classes never appear in this public list — they're only reachable via `/live-classes/invitations/[token]`.
- `/live-classes/invitations/[token]` — shows the inviting instructor/subject/schedule/price, Accept button that follows the same `FREE`/`ONE_TIME`/`RECURRING` branching `enrollInClass` uses.
- **`/live-classes/[id]` — the classroom** (this is the core new UI, not in the original draft): persistent view for any student with an active enrollment. Contains: (1) a chat panel — message list (paginated/infinite-scroll), an input disabled with a "locked by instructor" message when `chatLocked`, read access always available regardless of lock state; (2) a materials panel — class-level materials always visible, session-level materials visible once that session has occurred (supports the late-joiner catch-up rule); (3) a session status strip showing the next/current session's time and a **"Join Live Class" button that is only enabled when the backend's room endpoint says the session is actually `LIVE`** — polling that endpoint on an interval rather than trusting a client-side countdown alone, since the countdown is UX only and the backend call is the real gate.
- **Video join** — clicking the enabled button calls `GET /api/classes/{id}/sessions/{sessionId}/room`, then mounts Jitsi's IFrame API (`https://meet.jit.si/external_api.js`, `new JitsiMeetExternalAPI(domain, {roomName, parentNode, ...})`) in a modal/panel over the classroom — the only place the room identifier is ever used, never rendered as a link/URL anywhere in the DOM or passed through routing. Session end (either the instructor ending it, or the countdown running out) unmounts the Jitsi instance and returns to the classroom view; the classroom itself never navigates away.
- Dashboard widget (extends Task 24's explicitly-deferred live-classes panel): horizontal card list of the student's enrolled classes with next-session time, sharing the "is a session live right now" polling logic with the classroom view as one hook rather than duplicating it.
- No custom timezone picker beyond browser auto-detect + a display override, no payment-method selector (Paystack's own popup still handles that) — same scoping precedent as Task 23.

**Tests:** Logic tests for schedule-summary formatting, the capacity-indicator text, and the session-live-polling state machine (not-live/live/ended transitions). Component test for the chat input's locked/unlocked disabled state.

**Demo:** Logged-in student enrolls free in a `GROUP` class, sees it on the dashboard, opens its classroom, reads instructor messages with posting disabled while locked, posts once the admin unlocks it. A `PRIVATE` `INVITE_ONLY` class: student receives and accepts an invitation link, pays if priced, lands in a classroom no uninvited student can reach. Within a real test session's live window, the Join button enables and opens a real embedded Jitsi call with no bare room link ever visible in the DOM or network tab; after the instructor ends the session, the button disables again and the classroom (chat/materials) remains reachable.

---

**Task 42: Student Frontend — Notification Center & Preferences**

**Objective:** Give students the bell-icon notification center (student-frontend.md §4.2/§5.4) and a preferences tab wired to `user_notification_preferences`, closing the loop on every event type Tasks 39/40 now emit — including subscription and session lifecycle events, not just the original enrollment/payment/reminder set.

**Implementation guidance:**
- `lib/notifications.api.ts` — `listNotifications`, `markRead`, `markAllRead`, `deleteNotification`, `getUnreadCount`, `getPreferences`/`updatePreferences`, and `subscribeToStream(onMessage)` wrapping the browser `EventSource` pointed at `/api/notifications/stream` — falls back to polling `unread-count` after repeated stream errors, the concrete mitigation for Task 40's own flagged gateway-streaming risk.
- `NotificationItem` component in `apps/utilities` (§4.2) — icon colored by type (Course blue, Payment green, Live Class purple, Subscription teal, Announcement orange, System gray), title + message preview + relative timestamp + unread dot, actions mark-read/delete/click-to-navigate (built from the notification's `data` JSONB deep-link payload — a live-class notification deep-links straight into that class's classroom from Task 41). RTL test covering the type→color/icon mapping and the route-builder helper.
- Bell icon + dropdown panel in the student nav (latest 5, "View All" link, inline mark-read, unread badge sourced from `getUnreadCount()`/the live stream).
- `/notifications` page — no dedicated design spec exists for this route (only referenced in the IA, never detailed in §5); design it from the `NotificationItem` spec plus implementation-phases.md's "grouped by category filters; unread dot; infinite scroll; mark-all-read." Category filter tabs, unread-only toggle, infinite scroll, "Mark all read."
- Dashboard "Notifications Panel" (§5.4, extends Task 24): latest 5 + "View All" + inline mark-read, reusing `NotificationItem`.
- Profile → Notifications tab (§5.8): toggle list per notification type × delivery preference (in-app only / email / both), reading and writing Task 40's preferences endpoint.

**Tests:** `NotificationItem`'s type→color/icon mapping and route-builder as logic tests; any pure grouping/filter helper for `/notifications`.

**Demo:** A live event (enrollment/payment/live-class reminder/subscription-expired) appears in the bell dropdown within seconds via SSE (or the polling fallback) with the correct icon/color; clicking a live-class notification navigates straight into that class's classroom and marks it read; `/notifications` shows full history with working filters. Explicitly confirm whether Task 40's consumer actually checks `user_notification_preferences` before delivering — if it doesn't, that's a Task 40 gap to flag back, not something to paper over with a UI toggle that quietly does nothing.

---

**Task 43: Admin Frontend — Live Class Scheduler & Class Management**

**Objective:** Give admins/instructors the real calendar-based scheduling workflow from admin-frontend.md §6.6 — month/week/day views with drag-to-reschedule and conflict detection — plus the class-management surface the new domain model actually needs: creating group vs. private classes, negotiated pricing, invitations, materials, and chat moderation, none of which existed in the original single-session draft of this task.

**Implementation guidance:**
- `lib/classes.api.ts` (admin variant — needs internal fields like `schedules[]` templates and conflict data the student-facing client deliberately omits, so this is a separate thin client over overlapping-but-not-identical endpoints, not a shared one).
- **Calendar view via FullCalendar** (`@fullcalendar/react` + `@fullcalendar/daygrid` + `@fullcalendar/timegrid` + `@fullcalendar/interaction`) — **first external UI library in this codebase**, a deliberate exception to the "hand-roll everything visual" convention `BarChart`/`LineChart`/`DonutChart`/`DataTable` otherwise follow (decided with the user: a hand-rolled month/week/day grid + drag-and-drop + conflict UI was judged too large and bug-prone relative to a well-maintained, officially-supported library that already covers this exact feature set). The calendar renders individual **`live_sessions`** (not classes directly) — a recurring class shows every generated occurrence. `dayGridMonth`/`timeGridWeek`/`timeGridDay` views map directly onto the spec; `interaction` plugin provides `eventClick` (→ session detail sidebar, with a link out to the parent class) and `eventDrop`/`eventResize` (→ `PATCH` the session, reverting via `dropInfo.revert()`/`resizeInfo.revert()` and toasting on a 409 conflict response, rather than committing optimistically — dragging one occurrence does not move the whole recurring schedule). Event color driven by `eventColor`/`classNames` keyed off session `status`. Wrap it in a thin `apps/utilities/src/components/Calendar/Calendar.tsx` adapter (maps this project's own event/props shape to FullCalendar's props) so call sites don't depend on FullCalendar's API directly — same "thin wrapper over the third-party piece" shape as `LessonFileUpload` wrapping the raw upload flow. No RTL test for FullCalendar's own rendering (out of scope) — test the adapter's own prop-mapping function instead.
- `/live-classes` (admin) — Calendar/List view toggle sharing one filter bar (date range/instructor/class type/status); List is a `DataTable` of **classes** (title/type/schedule summary/instructor/capacity/price/status/enrolled count/actions), separate from the calendar's session-level view; "+ Schedule Class" quick-create modal for the common case, linking out to the full create page for everything else.
- `/live-classes/create`/edit — one sectioned form: title\*, description, `classType`\* (Group/Private), `accessMode`\* (Open/Invite-only), instructor\* (dropdown filtered by real-time availability via `GET /api/instructors/{id}/availability`), `paymentModel`\* (Free/One-time/Recurring — Recurring shows amount+interval, and for `PRIVATE` classes an explicit "negotiated price" framing rather than a fixed catalog price), capacity (Group only), recurring schedule builder (day-of-week + time + timezone, add/remove rows — this is what generates `live_sessions`, not a single date/time picker), meeting platform selector (defaults to `jitsi`; `zoom`/`google_meet` shown but disabled since nothing backs them yet — never accept a config that silently does nothing), cover image, real-time conflict banner (calls `instructor-availability`, blocks submit on overlap).
- **Class detail page** (`/live-classes/[id]`, admin) — beyond the create form's fields: session list with individual start/end/cancel controls, a **materials manager** (upload class-level or session-scoped files, reusing the existing upload component), a **chat moderation panel** (message history + the lock/unlock toggle from `PATCH /api/classes/{id}/chat-lock`), an **enrollments tab** (list of students, their `status`/`accessUntil`, manual remove), and — for `INVITE_ONLY` classes — an **invitations tab** (send new invite by email with an optional negotiated price, see status of pending/accepted invites). A "Mark Class Ended" action (`POST /api/classes/{id}/end`) with a confirmation explaining the retention-window behavior from `PHASE4.md`.

**Tests:** The `Calendar` adapter's event/prop-mapping function, the conflict-banner's debounce/comparison logic, `DataTable` column formatters, the create form's conditional-field logic (Group vs Private, Free/One-time/Recurring).

**Demo:** Admin creates a recurring `GROUP` class (Mon/Wed/Fri) — the calendar shows all three weekly occurrences correctly positioned and color-coded. Dragging one occurrence into conflict with another of that instructor's sessions shows the conflict inline and reverts; dragging to a genuinely free slot persists across a reload — the other two weekly occurrences are unaffected. Admin creates a `PRIVATE` `INVITE_ONLY` class with a negotiated recurring price, sends an invitation, and later locks/unlocks its chat from the class detail page.

---

**Task 44: Admin Frontend — Announcement Manager**

**Objective:** Give admins the announcement creation/targeting/publishing workflow from admin-frontend.md §6.11, closing the loop with Task 40's audience fan-out and email-on-high-priority.

**Implementation guidance:**
- `lib/announcements.api.ts` against Task 40's `AnnouncementsController`.
- `/announcements` (§6.11) — `DataTable` (title, target-audience summary, priority badge, status badge, publish date, author), status/date/author/target filters, bulk delete (plain select-rows→Delete Selected, no floating action bar — same scope-down as Task 26), duplicate action (pre-fills the create form, submits as a new draft).
- `/announcements/create`/edit — title\*, body\* (reuse Task 43's rich-text component if built), target audience (radio: All | Specific Courses [multi-select] | Specific Segments [rendered but disabled with a tooltip explaining it's not backed yet — same "don't accept a config that silently does nothing" principle as Task 43's platform selector]), priority (with a visible "high/critical will also send email" note), scheduling (Publish Now | Schedule for later | Save as Draft), expiry (optional), "Send Test" button (calls Task 40's `send-test`, toast confirms), publish confirmation modal showing the real estimated recipient count from `recipient-count` before the final, irreversible publish.

**Tests:** The target-audience-summary formatter, priority-badge mapping, and status-transition guard (e.g. a published announcement's targeting can't be edited) as logic tests.

**Demo:** Admin creates a `high`-priority "All" announcement, sees an accurate recipient-count estimate, publishes it — appears in a real test student's notification center within seconds, and a simulated email log line appears in Notification Service's console. A scheduled-for-later announcement flips from `scheduled` to `published` automatically once `publish_at` passes, with no manual action.

---

**Task 45: Phase 4 Integration & Verification**

**Objective:** Confirm the full class → enrollment/subscription → session → join → reminder → notification-received loop works end-to-end through the gateway across both frontends, and the announcement fan-out reaches real users, same verification discipline as Task 30 closed out Phase 3.

**Implementation guidance:**
- Full chain (group, free): admin schedules a recurring `GROUP` class (including a deliberately overlapping session first, to prove the conflict check actually fires) → a student enrolls free → sees it on the dashboard widget and `/live-classes` → a sped-up reminder (short-window test session) fires `liveclass.session.reminder` → Notification Service's consumer creates a real `notifications` row → the student sees it via the bell/SSE stream in near-real-time → within the join window, the classroom's Join button authorizes and embeds a live Jitsi room → session ends, classroom remains reachable, class itself stays `ACTIVE`.
- Second chain (private, subscription): admin creates a `PRIVATE` `INVITE_ONLY` recurring class with a negotiated price → invites a specific student → student accepts and subscribes via a real Paystack test-mode subscription → a simulated recurring `charge.success` extends their `accessUntil` → student cancels → `accessUntil` remains in the future and access is provably unaffected until that date → (sped up) `accessUntil` passes → enrollment flips to `EXPIRED` and classroom access is actually revoked, provable by a direct request.
- Third chain: admin publishes a `high`-priority "All" announcement → the recipient-count estimate matches the actual fan-out count → a real student receives the notification and a simulated email log line appears.
- Chat: admin locks a class's chat → student post attempt 403s → admin unlocks → post succeeds → admin locks again → subsequent post 403s again.
- Auth-boundary checks via `backend/integration-tests`: add `liveclass-notification-flow.integration.spec.ts` covering 401/403 on every write/admin-gated endpoint across all three touched services (payment-service's new subscription endpoints, live-class-service, notification-service), plus real assertions on the room-reveal endpoint's four-way authorization (too-early / not-enrolled / ended / invite-not-accepted vs. success) and the `accessUntil`-vs-`subscription.status` divergence case.
- Re-verify Task 40's flagged SSE-through-gateway risk for real now that the full stack is up — record the actual outcome (true SSE vs. polling fallback) in this task's own status note, the same way Phase 2's gateway-whitelist bug got recorded in its own integration task rather than silently patched.
- Update `PLAN.md`/`implementation-phases.md`/`PHASE4.md` status notes for Tasks 38–44 and the Phase 4 header as each is actually verified, same convention as every prior phase's own integration task.

**Tests:** The integration/unit tests specified in Tasks 38–44, run together against a single running stack, plus the new `liveclass-notification-flow.integration.spec.ts`.

**Demo:** Same shape as Task 30's own exit criteria — a real, unscripted end-to-end pass through all three touched services and both frontends, with any real deviations found during integration recorded rather than silently patched over.
