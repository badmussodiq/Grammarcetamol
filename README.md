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
│   ├── auth-service/    Spring Boot — auth, profiles, RBAC (Java 21)
│   └── gateway-service/ Spring Cloud Gateway — single entry point, JWT validation (Java 21)
├── docker/
│   └── docker-compose.dev.yml   Local Postgres, Redis, RabbitMQ
├── PLAN.md                          Task-by-task implementation plan
├── implementation-phases.md         Phase roadmap and exit criteria
├── admin-frontend.md                Admin UI/UX design spec
├── student-frontend.md              Student UI/UX design spec
├── database-schema-and-migrations.md Full target schema for every planned service
└── user-stories.md                  Full product backlog
```

## Current state (Phase 1: Identity, Access & User Management)

The auth module is implemented and working end-to-end for both portals:

- **Backend**: registration, email verification, login/logout, refresh, forgot/reset password, gRPC token validation, profile management, admin user (moderator/support) provisioning. Google OAuth is **intentionally deferred** — see `PLAN.md`.
- **Frontend**: both portals have working login/register/forgot-password/reset-password flows, and the admin portal has a working `/users` list + `/users/create` page. Cross-portal login is rejected — a student's credentials don't grant access to the admin site and vice versa.
- **Not yet built**: everything past auth (courses, enrollment, payments, live classes, etc. — Phases 2 onward in `implementation-phases.md`).

See `PLAN.md` and `implementation-phases.md` for the authoritative, up-to-date status of every task and phase.

## Running everything locally

### 1. Infrastructure (Postgres, Redis, RabbitMQ)

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

This exposes Postgres on `5433`, Redis on `6380`, and RabbitMQ on `5673` (management UI on `15673`) — nonstandard ports, chosen to avoid colliding with anything you might already have running locally. Default credentials: Postgres `platform`/`platform` (db `auth_db`), RabbitMQ `guest`/`guest`, Redis has no auth. These are local-only dev defaults — see the compose file before using them anywhere else.

> **Windows + WSL2 note:** if you're running Docker inside WSL2, the VM can idle-shut-down between commands and take the containers with it, which shows up as intermittent `Connection refused` errors from the backend. Keep a long-lived process attached to the WSL distro (e.g. `wsl -d <distro> -- sleep infinity` in a background terminal) to keep it resident.

### 2. Backend

Both services need an RSA keypair for JWT signing before they'll start — see `backend/auth-service/README.md`. Then, in order (gateway depends on auth-service's gRPC endpoint being reachable):

```bash
cd backend/auth-service && mvn spring-boot:run
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

- **`Selector.open()` / "Unable to establish loopback connection"** when starting either Spring Boot service: a JDK-level Windows NIO issue, most often caused by security/endpoint-protection software (Acronis Active Protection and Windows Defender's Network Inspection Service have both been observed causing this) intercepting the loopback socket. Add a process exclusion for `java.exe` if you hit this.
- Both backend services need Java 21 and Maven on `PATH`.
- Node 20+ is required for both frontends (Next.js 16's minimum).

## Documentation map

| Doc | What it's for |
|---|---|
| `PLAN.md` | Task-by-task build plan, updated as work lands |
| `implementation-phases.md` | Phase-level roadmap, sprint grouping, exit criteria |
| `admin-frontend.md` / `student-frontend.md` | Full target UI/UX design spec per portal — describes where the product is headed, not just what's built today |
| `database-schema-and-migrations.md` | Target schema for every planned service — see the note at the top for where it currently diverges from the real, implemented `auth_db` schema |
| `user-stories.md` | Full product backlog |
| `backend/auth-service/README.md`, `backend/gateway-service/README.md`, `apps/*/README.md` | Per-project setup and reference docs |
