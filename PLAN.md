Good clarifications. Let me update the plan with those constraints before continuing.

**Frontend changes:**
- No TanStack Query, no Zustand — use React `useContext` + `useReducer` for global state, native `fetch` for API calls, custom hooks for data fetching patterns
- Minimize external packages — `react-hook-form` and `zod` are out too; native form validation + custom hooks

**Gateway change:**
- No Eureka service discovery — service URLs are configured statically/programmatically in `application.yml` or a `RouteConfig` bean. Services register their host/port via environment variables, not a registry

Let me now complete the full plan with these corrections applied throughout.

---

# Implementation Plan — Grammarcetamol Digital Learning Ecosystem

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