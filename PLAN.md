Good clarifications. Let me update the plan with those constraints before continuing.

**Frontend changes:**
- No TanStack Query, no Zustand — use React `useContext` + `useReducer` for global state, native `fetch` for API calls, custom hooks for data fetching patterns
- Minimize external packages — `react-hook-form` and `zod` are out too; native form validation + custom hooks

**Gateway change:**
- No Eureka service discovery — service URLs are configured statically/programmatically in `application.yml` or a `RouteConfig` bean. Services register their host/port via environment variables, not a registry

Let me now complete the full plan with these corrections applied throughout.

---

# Implementation Plan — Grammarcetamol Digital Learning Ecosystem

> **Status as of 2026-08-05:** Tasks 1–10 below (Phase 0 + Phase 1) are implemented, with real divergences from this original plan noted inline per task — most notably: no root npm workspace (the repo root is a plain container folder, not a project; `apps/utilities` — renamed from `packages/ui` — is a sibling each app reaches via a `tsconfig.json` path + `turbopack.root`, not an npm dependency), Google OAuth deferred, and gateway CORS handled via Spring Cloud Gateway's native `globalcors` config instead of a hand-rolled `CorsWebFilter` bean (the two conflicted and produced duplicate CORS headers that browsers reject). See `implementation-phases.md` for the phase-level exit-criteria view of the same status.
>
> **Phase 2 planning added 2026-08-05** (Tasks 11–18 below). Backend-first, dependency-first ordering, same as Phase 1: Course Service (Java/Spring Boot, same stack as auth-service) lands before either frontend touches courses. **Tasks 11–12 (Course Service backend) are done as of 2026-08-05** — see their status notes below. Tasks 13–15 (both frontends' course pages, integration) are next. Upload Service and Media Service (Tasks 16–17) are **deferred from the start** — no MinIO/S3 or MongoDB is provisioned in `docker/docker-compose.dev.yml` yet, and the phase's own soft-dependency note explicitly allows stubbing media ("accept file, return mock URL"). Lessons carry a plain admin-supplied `video_url` string until that lands. Course Service also denormalizes `instructor_name`/`instructor_bio`/`instructor_avatar_url` directly onto `courses` — there's no instructor directory or role yet (`admin-frontend.md` lists "Instructor Management" as **Future**), so `instructor_id` is just the creating admin/moderator's user id for audit purposes, not a foreign key into a real instructor entity.

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

> **Status: ⚠️ Partial — only `auth_db` exists**, since no other service has been built yet. Migrations live inside `backend/auth-service/src/main/resources/db/migration/` (Flyway, auto-run on startup) rather than a top-level `migrations/` folder, so there's no `run-postgres.sh`/`run-mongo.sh`. No MongoDB databases exist yet either (nothing needs one until Phase 2+). `users.status` is a native Postgres `ENUM`, not the `VARCHAR + CHECK` this plan describes — see `database-schema-and-migrations.md`'s status note and `backend/auth-service/README.md`'s schema-notes section for why that distinction matters (JDBC can't implicitly cast a string bind parameter into a custom enum column on insert).

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

> **Status: ✅ Mostly done.** All five auth pages built (login, register, forgot-password, reset-password, verify-email), `AuthContext` + `useFormState` + `apiFetch`-with-refresh-retry implemented per the no-external-state-library constraint. Additionally now rejects login if the account isn't a `STUDENT` role (cross-portal guard, not in the original scope). Not built: the `Navbar` component (transparent-on-scroll, guest-vs-authenticated) — the landing page is still a placeholder — and `/profile`. `middleware.ts` is now `proxy.ts` (Next.js 16 renamed the convention).

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

> **Status: ⚠️ Partial.** Auth pages (login, forgot-password, reset-password — no register, by design) and `AuthContext` (with `hasPermission`) are built and working, plus the same cross-portal login rejection as the student app. The dashboard shell is minimal — a bare wrapper `div` and a dashboard page with stat-card placeholders, **not** the specified `Sidebar`/`TopHeader`/`Breadcrumb` components or a dedicated `UIContext` for sidebar/toast state (toasts use the shared `ToastContext` from `apps/utilities` instead). **Known bug, not yet fixed:** `hasPermission` checks `roles === 'super_admin'` (lowercase) but the backend returns roles uppercase (`SUPER_ADMIN`), so the blanket super-admin permission grant never actually triggers. `middleware.ts` is now `proxy.ts` (Next.js 16 renamed the convention), and additionally checks role from the JWT payload, not just cookie presence.

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

> **Status: ✅ Done**, verified live (not via an automated E2E suite): gateway → auth-service gRPC header injection confirmed, `returnUrl` redirect on the student route guard implemented, `fetchWithRefresh`-equivalent (401-triggered single retry) implemented in `apiFetch`. Beyond the original scope: cross-portal login rejection was added this phase after being flagged as a gap — a student's valid credentials no longer grant access to the admin portal (and vice versa), enforced both at login time (`AuthContext`) and via the route guard reading role from the JWT (defense-in-depth, not cryptographically verified — the real enforcement remains the backend's `@PreAuthorize` checks).

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

**Task 16: Upload Service — Deferred**

> **Status: ⏸️ Deferred.** No object storage is provisioned — `docker/docker-compose.dev.yml` has Postgres/Redis/RabbitMQ only, no MinIO/S3. Chunked resumable upload (US-ADM-007) needs real storage to be worth building; building it against nothing would just be a NestJS app that writes to local disk and calls that "resumable." Revisit once MinIO is added to the compose file (a `docker/` change, not a `course-service` one) — until then, admins provide plain `video_url` values directly on lessons via Task 14's Content tab, per the Phase 2 doc's own "Media Service can be stubbed" allowance.

**When resumed, implementation guidance is unchanged from `implementation-phases.md` §2.1** (5MB chunks, SHA-256 checksum, 3 retries, session recovery) **and `database-schema-and-migrations.md` §3.9** (`upload_db` schema is already fully specified and ready to migrate as-is).

---

**Task 17: Media Service — Deferred**

> **Status: ⏸️ Deferred.** Depends on Task 16 (nothing to transcode without an upload pipeline) and on MongoDB, which also isn't provisioned yet. The transcoding pipeline (ffprobe + HLS) additionally needs `ffmpeg` available in whatever runs the service — a real infrastructure decision (container image, or a managed transcoding API) that's out of scope for "no Kubernetes/infra work." Revisit alongside Task 16.

**When resumed, implementation guidance is unchanged from `implementation-phases.md` §2.1** and **`database-schema-and-migrations.md` §4.1** (`media_db` Mongo schema is already fully specified).

---

**Task 18: Extract `backend/shared-java` — Deferred (follow-up, not blocking)**

> **Status: 🔲 Not started, deliberately deferred.** `course-service` (Task 11) duplicates `ApiResponse`, the `GlobalExceptionHandler` pattern, and the `CurrentUser`/header-auth resolver that `auth-service` and the gateway already established. That duplication is real but small (~150 lines) and not worth pausing Task 12 mid-flight to fix — **decided 2026-08-05:** extract into a shared Maven module once a **third** Java service exists and the duplication pattern is fully proven out, not guessed at in advance. Cross-stack sharing (with the future NestJS services) isn't in scope for this — there's no runtime in common between a `@RestControllerAdvice` and a NestJS exception filter; the only thing crossing that boundary is JSON over HTTP, which the frontends already handle stack-agnostically via `apiFetch`.

**When resumed:** create `backend/shared-java/` (own `pom.xml`, `mvn install`ed to the local repo, versioned — not a multi-module Maven reactor, since the existing service poms are deliberately standalone), move `ApiResponse`, `GlobalExceptionHandler`'s common exception mappings, and `CurrentUser`/`CurrentUserArgumentResolver`/`WebConfig` into it, then update `auth-service` and `course-service` to depend on it and delete their local copies.