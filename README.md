# Grammarcetamol

Digital learning platform — English language courses, live classes, and student/admin portals. This repository is a plain container folder, **not** an npm or Maven project in its own right: there is no root `package.json` and nothing should be installed or built from here. Each app and service under `apps/` and `backend/` is independently installable and buildable — see its own README.

## Layout

```
Grammarcetamol/
├── apps/
│   ├── student/       Next.js 16 — public/student-facing frontend
│   ├── admin/          Next.js 16 — internal admin/staff frontend
│   └── utilities/      Shared React component/hook library (@grammarcetamol/utilities)
├── backend/
│   ├── shared-java/        Not a service — shared library (ApiResponse, header-trust CurrentUser) for header-trust services, `mvn install`ed locally
│   ├── auth-service/       Spring Boot — auth, profiles, RBAC (Java 21)
│   ├── course-service/     Spring Boot — categories, courses, modules, lessons, catalog (Java 21)
│   ├── enrollment-service/ Spring Boot — free/paid enrollment, lesson progress, prerequisite gating (Java 21)
│   ├── payment-service/    NestJS — checkout, pluggable payment provider (Paystack), refunds (Node 20+)
│   ├── review-service/     Spring Boot — course reviews, 50%-completion gate, moderation (Java 21)
│   ├── upload-service/     NestJS — resumable chunked upload, pluggable object-storage provider (MinIO/S3) (Node 20+)
│   ├── gateway-service/    Spring Cloud Gateway — single entry point, JWT validation (Java 21)
│   └── integration-tests/  Cross-service Jest suite — hits the real running stack through the gateway, not mocks (Node 20+)
├── docker/
│   └── docker-compose.dev.yml   Local Postgres, Redis, RabbitMQ, MinIO
├── PLAN.md                          Task-by-task implementation plan
├── implementation-phases.md         Phase roadmap and exit criteria
├── admin-frontend.md                Admin UI/UX design spec
├── student-frontend.md              Student UI/UX design spec
├── database-schema-and-migrations.md Full target schema for every planned service
└── user-stories.md                  Full product backlog
```

## Current state (Phase 1 & 2 done; actively in Phase 3)

**Phase 1 — Identity, Access & User Management** is implemented and working end-to-end for both portals:

- **Backend**: registration, email verification, login/logout, refresh, forgot/reset password, gRPC token validation, profile management, admin user (moderator/support) provisioning. Google OAuth is **intentionally deferred** — see `PLAN.md`.
- **Frontend**: both portals have working login/register/forgot-password/reset-password flows, and the admin portal has a working `/users` list + `/users/create` page. Cross-portal login is rejected — a student's credentials don't grant access to the admin site and vice versa.

**Phase 2 — Course Content & Discovery** is implemented and verified end-to-end, live: `course-service` (categories, courses with draft/review/published/archived lifecycle + versioning, modules, lessons, public catalog with search/filter/sort), the student catalog/detail pages + landing hero, and the admin course-management pages (list, create, per-course Overview/Edit/Content/Versions tabs). `upload-service` (Task 16) is now done and live-verified (2026-08-06) — resumable chunked upload as real S3/MinIO multipart uploads, presigned PUT URLs, a pluggable `StorageProvider` abstraction supporting MinIO and S3 at once; lessons still take a plain admin-pasted `video_url` for now since the admin upload UI itself hasn't been built. Media Service (Task 17) remains **intentionally deferred** — no MongoDB is provisioned yet.

**Phase 3 — Enrollment, Payments & Learning Loop**: backend (`enrollment-service`, `payment-service` — the repo's first NestJS service, `review-service`) and the student frontend (checkout, dashboard, my-courses, the learning interface) are done and live-verified — including a real browser-driven loop: register → enroll free → watch → mark complete → cross the 50% review-eligibility threshold → see it reflected on "My Courses", all against the real running stack, not mocks. Two known gaps, deliberately not fixed yet: the Paystack test account only supports NGN, not the USD all seeded courses are priced in (the user's actual plan is geo/currency-based pricing, explicitly deferred — checkout renders correctly and fails gracefully rather than silently); and `course-service`'s denormalized `enrollment_count`/`avg_rating`/`review_count` columns aren't incremented by the new services yet. Admin frontend now has a real shell (`Sidebar`/`TopHeader`/`Breadcrumb`, replacing the bare `<div>` since Phase 1), new shared `DataTable`/chart primitives in `apps/utilities`, and working `/revenue` + `/transactions` pages — all live-verified in the browser, including two real bugs found and fixed along the way (the sidebar collapse toggle scrolling out of view, and the collapsed sidebar showing truncated text instead of icons). `/revenue`/`/transactions` needed new `payment-service` admin endpoints that didn't exist before (`GET /api/payments` + a `RevenueService` for summary/trend/best-sellers/by-method). Review moderation and the student directory pages are next (`PLAN.md` Tasks 28–30).

**Not yet built**: live classes, and everything else past what's listed above (`implementation-phases.md`).

See `PLAN.md` and `implementation-phases.md` for the authoritative, up-to-date status of every task and phase.

## Running everything locally

### 1. Infrastructure (Postgres, Redis, RabbitMQ, MinIO, MongoDB)

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

**Every Grammarcetamol container — app services and infra alike — lives in one dedicated `9000`-series port block**, gateway first at `9000`, so nothing here can collide with some other project's own Postgres/Redis/RabbitMQ/MinIO/Mongo running on the same machine on their own nonstandard ports. Infra: Postgres on `9009`, Redis on `9010`, RabbitMQ on `9011` (management UI on `9012`), MinIO on `9013` (S3 API) / `9014` (console), and a dedicated MongoDB on `9015` (for Live Class Service, `liveclass_db` — see `PLAN.md` Task 31). Default credentials: Postgres `platform`/`platform` (db `auth_db`), RabbitMQ `guest`/`guest`, MinIO `platform`/`platform12345`, Mongo `platform`/`platform12345`, Redis has no auth. These are local-only dev defaults — see the compose file before using them anywhere else. All services run with `restart: always`.

Note: the dedicated `mongo` service above (container `grammarcetamol-mongo`, port `9015`) is deliberately **separate** from a pre-existing standalone `mongo:7` container (`platform-mongo`, started outside this compose file, holding an unrelated pre-existing `notifications` database) that may already be running on the default `27017` in some environments — nothing in this project connects to that one; it's left untouched.

**App service ports** (each service's own `application.yml`/`.env` — see §2 below): gateway `9000`, auth `9001`, course `9002`, enrollment `9003`, review `9004`, payment `9005`, upload `9006`. (Live Class Service and Notification Service, once built per `PLAN.md` Tasks 31-32, will take `9007`/`9008`.) auth-service's internal gRPC port (used only by the gateway's token-validation client) stays at `9091`, outside this block — it's an implementation detail, not a port anything external ever hits directly.

> **Windows + WSL2 note:** if you're running Docker inside WSL2, the VM can idle-shut-down between commands and take the containers with it, which shows up as intermittent `Connection refused` errors from the backend. Keep a long-lived process attached to the WSL distro (e.g. `wsl -d <distro> -- sleep infinity` in a background terminal) to keep it resident.

### 2. Backend

`auth-service` needs an RSA keypair for JWT signing before it'll start — see `backend/auth-service/README.md`. `course-service` and `enrollment-service` (and every Phase 3+ header-trust service) need `backend/shared-java` installed to the local Maven repo first, and their own database to exist — see each service's README if you're on a Postgres volume that predates it. Then, in order (gateway depends on auth-service's gRPC endpoint being reachable; enrollment-service calls out to course-service):

```bash
cd backend/shared-java && mvn install
cd backend/auth-service && mvn spring-boot:run
cd backend/course-service && mvn spring-boot:run
cd backend/enrollment-service && mvn spring-boot:run
cd backend/review-service && mvn spring-boot:run
cd backend/gateway-service && mvn spring-boot:run
```

`payment-service` and `upload-service` are Node/NestJS, not Maven — see each one's own README for `.env` setup (`payment-service` needs real Paystack test-mode keys; `upload-service`'s defaults already match the compose file's MinIO credentials) before `npm install && npm run start:dev`. `upload-service` also needs its own `upload_db` created first, same as the Java services (see its README). Both keep their unit-test specs in their own `test/` directory mirroring `src/` (e.g. `backend/payment-service/test/payments/payments.service.spec.ts` tests `src/payments/payments.service.ts`), same convention as the Java services' `src/test/java/` vs. `src/main/java/` split — run with `npm test` (each service's own `package.json` points Jest at `test/` via `roots`). `upload-service`'s `e2e/upload-flow.e2e.ts` is separate again — a real end-to-end script, not a unit spec, run via `npm run test:e2e`.

Auth service seeds a super admin on first boot — check `SuperAdminSeeder.java` / the `app.super-admin-email` and `app.super-admin-password` properties for the default credentials (change them for anything beyond local dev).

### 3. Frontends

```bash
npm --prefix apps/student install && npm --prefix apps/student run dev   # http://localhost:3000
npm --prefix apps/admin install && npm --prefix apps/admin run dev      # http://localhost:3001
```

`apps/utilities` needs its own `npm install` too (for standalone typechecking/testing — see `apps/utilities/README.md` for why it's a sibling with its own `node_modules` rather than a workspace dependency):

```bash
npm --prefix apps/utilities install
```

### 4. Integration tests

`backend/integration-tests` is a real Jest suite (59 tests, 6 files) that hits the running
stack through the gateway (not mocks) to prove cross-service concerns actually hold: the
auth boundary (every write/admin-gated endpoint correctly 401s/403s), full course authoring
(draft → module → lesson → publish, public-catalog visibility), the enrollment/learning
loop (idempotent free enrollment, no lesson locking, real completion tracking), real
Paystack test-mode payment calls, and the review 50%-completion gate + moderation. Needs
the full backend up plus a seeded `SUPER_ADMIN` account — see its own `README.md`. Runs
serially (`--runInBand`) deliberately: parallel spec files hitting a shared live stack
causes real contention, not just slower CI.

```bash
cd backend/integration-tests && npm install && npm test
```

### 5. Frontend component/integration tests

`apps/admin` and `apps/student` each have three layers of frontend test now: pure-logic
unit tests (`lib/*.api.test.ts`), component tests (`*.test.tsx`, React Testing Library,
API mocked at the module boundary), and integration tests (`*.integration.test.ts(x)`,
only `global.fetch` mocked — the real API-client code runs). `apps/utilities` has the same
layers plus its own component library tests. All three apps share one gotcha worth knowing
if you add a new component test: `apps/utilities` is a sibling project with its own
`node_modules` (see its `README.md`), so admin/student's vitest configs need
`resolve.dedupe: ['react', 'react-dom']` or you'll hit "Invalid hook call" from two React
copies in the same render tree.

**Tests live in their own `test/` tree, not next to the source they test** — every frontend
app's `test/` directory mirrors its source layout 1:1 (e.g.
`apps/admin/test/app/(dashboard)/courses/[id]/ContentTab.test.tsx` tests
`apps/admin/app/(dashboard)/courses/[id]/ContentTab.tsx`; `apps/utilities/test/hooks/useFetch.test.ts`
tests `apps/utilities/src/hooks/useFetch.ts`), matching how the Java services already
separate `src/test/java/` from `src/main/java/`. The two NestJS backend services follow the
same convention — see the next section.

```bash
npm --prefix apps/admin test
npm --prefix apps/student test
npm --prefix apps/utilities test
```

## Known environment gotchas (Windows)

- **`Selector.open()` / "Unable to establish loopback connection"** when starting any Spring Boot service (or, as seen in `enrollment-service`, any code path that opens an NIO `Selector` — including the JDK's `java.net.http.HttpClient`, not just Tomcat's connector): a JDK-level Windows NIO issue, most often caused by security/endpoint-protection software (Acronis Active Protection and Windows Defender's Network Inspection Service have both been observed causing this) intercepting the loopback socket. Add a process exclusion for `java.exe` if you hit this. It appears more reliable from an IDE launch than from an automated/scripted `mvn spring-boot:run`.
- Java backend services need Java 21 and Maven on `PATH`. `payment-service` needs Node 20+ instead (same requirement as both frontends, Next.js 16's minimum) — it wasn't affected by the loopback-socket issue above in this environment.

## Documentation map

| Doc                                                                                                                                                                                                                                                                                                                                                        | What it's for                                                                                                                                              |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `PLAN.md`                                                                                                                                                                                                                                                                                                                                                  | Task-by-task build plan, updated as work lands                                                                                                             |
| `implementation-phases.md`                                                                                                                                                                                                                                                                                                                                 | Phase-level roadmap, sprint grouping, exit criteria                                                                                                        |
| `admin-frontend.md` / `student-frontend.md`                                                                                                                                                                                                                                                                                                                | Full target UI/UX design spec per portal — describes where the product is headed, not just what's built today                                              |
| `database-schema-and-migrations.md`                                                                                                                                                                                                                                                                                                                        | Target schema for every planned service — see the note at the top for where it currently diverges from the real, implemented `auth_db`/`course_db` schemas |
| `user-stories.md`                                                                                                                                                                                                                                                                                                                                          | Full product backlog                                                                                                                                       |
| `backend/auth-service/README.md`, `backend/course-service/README.md`, `backend/enrollment-service/README.md`, `backend/payment-service/README.md`, `backend/review-service/README.md`, `backend/upload-service/README.md`, `backend/gateway-service/README.md`, `backend/integration-tests/README.md`, `backend/shared-java/README.md`, `apps/*/README.md` | Per-project setup and reference docs                                                                                                                       |
