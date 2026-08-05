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
│   ├── shared-java/      Not a service — shared library (ApiResponse, header-trust CurrentUser) for header-trust services, `mvn install`ed locally
│   ├── auth-service/       Spring Boot — auth, profiles, RBAC (Java 21)
│   ├── course-service/     Spring Boot — categories, courses, modules, lessons, catalog (Java 21)
│   ├── enrollment-service/ Spring Boot — free/paid enrollment, lesson progress, prerequisite gating (Java 21)
│   └── gateway-service/    Spring Cloud Gateway — single entry point, JWT validation (Java 21)
├── docker/
│   └── docker-compose.dev.yml   Local Postgres, Redis, RabbitMQ
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

**Phase 2 — Course Content & Discovery** is implemented and verified end-to-end, live: `course-service` (categories, courses with draft/review/published/archived lifecycle + versioning, modules, lessons, public catalog with search/filter/sort), the student catalog/detail pages + landing hero, and the admin course-management pages (list, create, per-course Overview/Edit/Content/Versions tabs). Upload Service and Media Service are **intentionally deferred** — no object storage or MongoDB is provisioned yet; lessons take a plain admin-pasted `video_url` in the meantime, per the phase's own "Media Service can be stubbed" allowance.

**Phase 3 — Enrollment, Payments & Learning Loop** is in progress: `enrollment-service` (free/paid enrollment, per-lesson progress, prerequisite gating, at-risk query) is implemented — see `PLAN.md` Task 20. Payment Service (Paystack, pluggable for Stripe/Flutterwave later) and Review Service, plus both frontends' checkout/dashboard/learning-interface/revenue/moderation/student-directory pages, are next (`PLAN.md` Tasks 21–30).

**Not yet built**: payments, reviews, live classes, and everything else past what's listed above (`implementation-phases.md`).

See `PLAN.md` and `implementation-phases.md` for the authoritative, up-to-date status of every task and phase.

## Running everything locally

### 1. Infrastructure (Postgres, Redis, RabbitMQ)

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

This exposes Postgres on `5433`, Redis on `6380`, and RabbitMQ on `5673` (management UI on `15673`) — nonstandard ports, chosen to avoid colliding with anything you might already have running locally. Default credentials: Postgres `platform`/`platform` (db `auth_db`), RabbitMQ `guest`/`guest`, Redis has no auth. These are local-only dev defaults — see the compose file before using them anywhere else.

> **Windows + WSL2 note:** if you're running Docker inside WSL2, the VM can idle-shut-down between commands and take the containers with it, which shows up as intermittent `Connection refused` errors from the backend. Keep a long-lived process attached to the WSL distro (e.g. `wsl -d <distro> -- sleep infinity` in a background terminal) to keep it resident.

### 2. Backend

`auth-service` needs an RSA keypair for JWT signing before it'll start — see `backend/auth-service/README.md`. `course-service` and `enrollment-service` (and every Phase 3+ header-trust service) need `backend/shared-java` installed to the local Maven repo first, and their own database to exist — see each service's README if you're on a Postgres volume that predates it. Then, in order (gateway depends on auth-service's gRPC endpoint being reachable; enrollment-service calls out to course-service):

```bash
cd backend/shared-java && mvn install
cd backend/auth-service && mvn spring-boot:run
cd backend/course-service && mvn spring-boot:run
cd backend/enrollment-service && mvn spring-boot:run
cd backend/gateway-service && mvn spring-boot:run
```

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

## Known environment gotchas (Windows)

- **`Selector.open()` / "Unable to establish loopback connection"** when starting any Spring Boot service (or, as seen in `enrollment-service`, any code path that opens an NIO `Selector` — including the JDK's `java.net.http.HttpClient`, not just Tomcat's connector): a JDK-level Windows NIO issue, most often caused by security/endpoint-protection software (Acronis Active Protection and Windows Defender's Network Inspection Service have both been observed causing this) intercepting the loopback socket. Add a process exclusion for `java.exe` if you hit this. It appears more reliable from an IDE launch than from an automated/scripted `mvn spring-boot:run`.
- All backend services need Java 21 and Maven on `PATH`.
- Node 20+ is required for both frontends (Next.js 16's minimum).

## Documentation map

| Doc | What it's for |
|---|---|
| `PLAN.md` | Task-by-task build plan, updated as work lands |
| `implementation-phases.md` | Phase-level roadmap, sprint grouping, exit criteria |
| `admin-frontend.md` / `student-frontend.md` | Full target UI/UX design spec per portal — describes where the product is headed, not just what's built today |
| `database-schema-and-migrations.md` | Target schema for every planned service — see the note at the top for where it currently diverges from the real, implemented `auth_db`/`course_db` schemas |
| `user-stories.md` | Full product backlog |
| `backend/auth-service/README.md`, `backend/course-service/README.md`, `backend/enrollment-service/README.md`, `backend/gateway-service/README.md`, `backend/shared-java/README.md`, `apps/*/README.md` | Per-project setup and reference docs |
