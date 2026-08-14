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

### Option A: one command via Docker Compose

```bash
cp .env.example .env   # fill in PAYSTACK_SECRET_KEY etc. — see comments in the file
docker compose up -d --build
docker compose ps       # watch every service flip to "healthy"
```

This builds and starts the entire stack — infra, all eight backend services, and both
frontends — from the root `docker-compose.yml`. (nginx + TLS are opt-in, gated behind
Compose's `proxy` profile — see [Deploying to a cloud server](#deploying-to-a-cloud-server)
below; plain local dev never touches them, you just hit `gateway:9000` directly.) Each
service has its own `Dockerfile`
(`backend/<service>/Dockerfile`, `apps/<app>/Dockerfile`); the frontends' Dockerfiles use
`apps/` as their build context since they need `apps/utilities/src` as a build-time
sibling. `auth-service`'s Dockerfile generates a throwaway RSA keypair at build time if
`backend/auth-service/src/main/resources/keys/*.pem` isn't already present — rebuilding
the image issues a fresh keypair and invalidates existing sessions, which is fine for
local Docker use but worth knowing.

**Startup order, and why it's deliberately not "everything before everything":**
infra healthy → each backend service (depends only on the infra it actually needs) →
gateway (depends on Redis only) → both frontends (depend on gateway only). Gateway does
**not** wait on the other backend services, and the frontends do **not** wait on them
individually either — gateway proxies to them over HTTP at request time, so if one
microservice crashes or is still starting, only *that* microservice's routes fail; the
gateway, the frontends, and every other microservice stay up. This is the resilience
behavior you'd want in production too: one bad deploy shouldn't take down the whole app.

This is the fastest way to get the whole thing running; the manual per-service steps
below remain the better option for active development (hot reload, debugger attach, etc).

**Same file, local or cloud — nothing to edit.** `IMAGE_PREFIX`/`IMAGE_TAG`/`IMAGE_PULL_POLICY`
(see `.env.example`) control where each service's image comes from. Leave them unset
locally and Compose builds from the Dockerfiles (`pull_policy: build` never attempts a
registry pull). On a cloud server, set `IMAGE_PREFIX=sodmod1999/grammarcetamol-`,
`IMAGE_TAG=latest`, `IMAGE_PULL_POLICY=missing` in that
environment's `.env` and run `docker compose up -d` — it pulls the images your CI already
built and pushed instead of building. The `docker-compose.yml` itself never changes.

**If a container is stuck `Created` and never actually started** (seen after a Docker
daemon hiccup inside WSL2 — the daemon loses track of a just-recreated container's
"should be running" state; WSL itself doesn't need to have restarted, `uptime` inside it
can show days): `docker compose up -d` is always the fix — idempotent, it only touches
containers that aren't already running.

**Auto-recovery watchdog (optional, WSL2):** `docker/scripts/compose-watchdog.sh` runs
that same `docker compose up -d` and logs to `docker/scripts/watchdog.log`, doing nothing
if every container is already running. A user-level systemd timer runs it every 5
minutes:
```bash
mkdir -p ~/.config/systemd/user
cp docker/scripts/grammarcetamol-watchdog.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now grammarcetamol-watchdog.timer
# check it: systemctl --user status grammarcetamol-watchdog.timer
# disable it: systemctl --user disable --now grammarcetamol-watchdog.timer
```
The `.service` file's `ExecStart` path is this machine's absolute repo path — update it
if you clone to a different location. No sudo needed (`systemctl --user`, and this
account is already in the `docker` group).

**WSL2 note if `docker compose build` looks stuck on "load build context":** it's not
hung — enumerating a large local `node_modules` (or `target/`) across the WSL↔Windows
filesystem boundary is slow even when the actual bytes transferred are tiny. Each
service directory has its own `.dockerignore` to prevent this; if you ever add a new
service, give it one too (`node_modules`, `dist`/`target`, `.env`).

### Deploying to a cloud server

Every push to `master` that passes tests and builds+pushes images (see [CI/CD](#cicd)
below) automatically deploys to a cloud server — same Docker, no Kubernetes. **No git on
the server**: it only ever runs pre-built images pulled from the registry. How the deploy
step reaches the server depends on which pipeline you use:
- **GitHub Actions** runs on GitHub-hosted runners, off-server, so it reaches the server
  over SSH: copies `docker-compose.yml` + `docker/` fresh via scp, then runs
  `docker/scripts/deploy.sh <commit-sha>` remotely.
- **Jenkins** is assumed to be installed directly ON the cloud server itself (its job
  just listens for pushes to this branch) — so its `Deploy` stage is a local file copy
  from the build's own checkout into `DEPLOY_DIR`, then runs `deploy.sh` in place. No
  SSH involved.

Either way, `deploy.sh` pulls that exact commit's images and restarts. Rolling back is
re-running that same script by hand with an older commit SHA — every commit's images
stay in the registry under their own tag.

**`.env` is generated by CI on every deploy, not created on the server by hand.** You
maintain ONE secret holding the full file contents, and the deploy step writes it fresh
each run — no SSH-in-and-edit-a-file step, ever:
- **GitHub Actions**: repo secret `PROD_ENV_FILE` (Settings -> Secrets and variables ->
  Actions -> New repository secret; paste the whole file, multi-line values work fine).
- **Jenkins**: a "Secret file" credential named `prod-env-file` (Manage Jenkins ->
  Credentials -> add a Secret file, upload the `.env` content as a file).

Either way the content is the same — see `.env.example` for the full variable list, and
note the **IMPORTANT ORDERING CAVEAT below** about `COMPOSE_PROFILES=proxy`.

**One-time server setup** (there's no real server configured yet — this is what to do
once you have one):
1. Install Docker + the Docker Compose plugin on the server.
2. `mkdir -p /opt/grammarcetamol` (or wherever — update `DEPLOY_DIR` in the Jenkinsfile /
   the `target:` path in the GitHub Actions `deploy` job if you use somewhere else).
3. Set up the `PROD_ENV_FILE` secret / `prod-env-file` credential (see above) with:
   - `IMAGE_PREFIX=sodmod1999/grammarcetamol-`
   - `IMAGE_PULL_POLICY=always`
   - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` (must match `DOMAIN_API`, with scheme)
   - every other real secret (`PAYSTACK_SECRET_KEY`, SMTP creds, `SUPER_ADMIN_*`, `INTERNAL_TOKEN`)
   - **leave `COMPOSE_PROFILES`, `DOMAIN_APP`/`DOMAIN_ADMIN`/`DOMAIN_API`, `CERTBOT_EMAIL`
     OUT for now** — see the TLS bootstrap step below for why; you'll add them and
     redeploy once certs exist, not before.
4. If the images are private, `docker login` once on the server against Docker Hub with
   an access token.
5. **If using GitHub Actions** (runs off-server, needs SSH in): add the deploy user's
   public key to that account's `~/.ssh/authorized_keys`, and add repo secrets
   `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (the matching private key).
   **If using Jenkins** (installed directly on this server): none of the above is
   needed — just point a Jenkins job at this repo with `dockerhub-creds` and
   `prod-env-file` configured, and its `Deploy` stage runs locally.
   Push to `master` now (or trigger the Jenkins job) — this is the first real deploy: it
   writes `.env` (without the proxy/domain vars yet), pulls images, and brings up
   gateway + both frontends on their plain ports. `docker-compose.yml` + `docker/` are
   now present in `/opt/grammarcetamol` for the next step.
6. Point `DOMAIN_APP`/`DOMAIN_ADMIN`/`DOMAIN_API`'s DNS A records at the server's IP.
7. **Bootstrap the first TLS certificates** (one-time, manual — nginx validates its
   `ssl_certificate` files exist at startup, so it can't be the thing that requests them;
   there's a real chicken-and-egg problem here, solved by getting the first cert via
   certbot's `--standalone` mode, which runs its own tiny web server on port 80 for the
   few seconds the ACME challenge needs — nginx isn't running yet at this point, so there's
   no port conflict):
   ```bash
   cd /opt/grammarcetamol   # docker-compose.yml + docker/ already here from step 5's deploy
   docker compose --profile proxy run --rm -p 80:80 --entrypoint certbot certbot \
     certonly --standalone \
     -d app.yourdomain.com -d admin.yourdomain.com -d api.yourdomain.com \
     --email you@yourdomain.com --agree-tos --no-eff-email
   ```
   (Real certs need real DNS + a real publicly-reachable server, so this step is
   documented but not something this repo can verify end-to-end — I confirmed nginx's own
   config is correct by starting it against locally-generated self-signed certs at the
   exact paths this produces, and confirmed subdomain routing works; the actual Let's
   Encrypt ACME handshake itself needs a real domain to test.)
8. **Now** add `COMPOSE_PROFILES=proxy`, `DOMAIN_APP`/`DOMAIN_ADMIN`/`DOMAIN_API`, and
   `CERTBOT_EMAIL` to the `PROD_ENV_FILE` secret / `prod-env-file` credential from step
   3, and push to `master` again (or re-trigger Jenkins). This redeploy writes the
   updated `.env` and runs `docker compose up -d` with the proxy profile now active —
   nginx starts, finds the certs step 7 just issued, and comes up serving real HTTPS.
9. **Schedule renewals** — certs expire in 90 days; `docker/scripts/certbot-renew.sh` runs
    the (much simpler, no port conflict) webroot renewal + reloads nginx, and no-ops if
    nothing's due yet, so it's safe to run often. Same systemd-timer pattern as the
    watchdog (see below):
    ```bash
    # in the .service file's ExecStart, point at certbot-renew.sh instead of compose-watchdog.sh,
    # and use a daily OnUnitActiveSec instead of every 5 minutes
    ```

After that, deploys just happen — no manual steps, and nginx/TLS survive every deploy
untouched (deploys only ever refresh `docker-compose.yml` + `docker/` + `.env`, never
touch the `certbot-certs` volume). To redeploy an older version by hand — on the server directly if
using Jenkins, or over SSH if using GitHub Actions:
```bash
# GitHub Actions setup: ssh <user>@<host> first, then:
cd /opt/grammarcetamol && bash docker/scripts/deploy.sh <commit-sha>
```

### Scaling

The 7 backend microservices (auth, course, enrollment, review, payment, notification,
upload) can each be scaled independently with Compose's built-in `--scale`:
```bash
docker compose up -d --scale course-service=3 --scale enrollment-service=2
```
This works because those 7 services deliberately have **no** `container_name` and **no**
host port mapping (`expose:` instead of `ports:`) — a fixed container name allows only one
container, and a fixed host port mapping means every replica would fight over the same
port. Everything that calls them already does so via Docker's own service-name DNS (e.g.
`http://course-service:9002`), which — confirmed by actually scaling `course-service` to 3
replicas and checking `getent hosts course-service` from another container — resolves to
*all* running replicas' IPs and round-robins across them automatically, no extra
config needed. `notification-service` gets a bonus from this too: its RabbitMQ consumer
binds the same queue names in every replica, so scaling it also gives you competing
consumers (RabbitMQ spreads deliveries across whichever replicas are up).

`gateway-service` and the two frontends are deliberately **not** scaled this way (yet) —
gateway is a reactive/non-blocking Spring Cloud Gateway, much less likely to be the actual
bottleneck than the blocking-I/O business-logic services behind it, and scaling it
introduces a genuinely untested corner case (both frontends' `depends_on: gateway-service:
condition: service_healthy` against a multi-replica target). If you outgrow a single
gateway instance, the identical `expose:`/no-`container_name` pattern applies — just
verify the health-dependent startup ordering still behaves the way you expect before
relying on it.

nginx's own reverse-proxy config (`docker/nginx/templates/*.conf.template`) already
assumes any of its three proxy targets (gateway-service, student-frontend, admin-frontend)
could be scaled or restarted with a new IP: it uses `resolver 127.0.0.11 valid=10s;`
(Docker's embedded DNS) plus a `set $upstream ...; proxy_pass $upstream;` variable instead
of a bare hostname in `proxy_pass`, so it re-resolves every 10 seconds instead of caching
one IP for the life of the nginx worker process — confirmed this is a real, documented
nginx gotcha (bare-hostname `proxy_pass` resolves once, at config load) and verified the
fix by starting nginx and routing real requests through to each backend by subdomain.

nginx also rate-limits at the edge (`docker/nginx/templates/00-rate-limit.conf.template`:
20 req/s per IP with a burst of 40, 20 concurrent connections per IP) as a blunt,
always-on first line of defense against a request flood, on top of — not instead of —
gateway-service's own Redis-backed limiter (currently scoped to `/api/auth/**`).

### Option B: run each service yourself

#### 1. Infrastructure (Postgres, Redis, RabbitMQ, MinIO, MongoDB)

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

**Every Grammarcetamol container — app services and infra alike — lives in one dedicated `9000`-series port block**, gateway first at `9000`, so nothing here can collide with some other project's own Postgres/Redis/RabbitMQ/MinIO/Mongo running on the same machine on their own nonstandard ports. Infra: Postgres on `9009`, Redis on `9010`, RabbitMQ on `9011` (management UI on `9012`), MinIO on `9013` (S3 API) / `9014` (console), and a dedicated MongoDB on `9015` (for Live Class Service, `liveclass_db` — see `PLAN.md` Task 31). Default credentials: Postgres `platform`/`platform` (db `auth_db`), RabbitMQ `guest`/`guest`, MinIO `platform`/`platform12345`, Mongo `platform`/`platform12345`, Redis has no auth. These are local-only dev defaults — see the compose file before using them anywhere else. All services run with `restart: always`.

Note: the dedicated `mongo` service above (container `grammarcetamol-mongo`, port `9015`) is deliberately **separate** from a pre-existing standalone `mongo:7` container (`platform-mongo`, started outside this compose file, holding an unrelated pre-existing `notifications` database) that may already be running on the default `27017` in some environments — nothing in this project connects to that one; it's left untouched.

**App service ports** (each service's own `application.yml`/`.env` — see §2 below): gateway `9000`, auth `9001`, course `9002`, enrollment `9003`, review `9004`, payment `9005`, upload `9006`. (Live Class Service and Notification Service, once built per `PLAN.md` Tasks 31-32, will take `9007`/`9008`.) auth-service's internal gRPC port (used only by the gateway's token-validation client) stays at `9091`, outside this block — it's an implementation detail, not a port anything external ever hits directly.

> **Windows + WSL2 note:** if you're running Docker inside WSL2, the VM can idle-shut-down between commands and take the containers with it, which shows up as intermittent `Connection refused` errors from the backend. Keep a long-lived process attached to the WSL distro (e.g. `wsl -d <distro> -- sleep infinity` in a background terminal) to keep it resident.

#### 2. Backend

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

#### 3. Frontends

```bash
npm --prefix apps/student install && npm --prefix apps/student run dev   # http://localhost:3000
npm --prefix apps/admin install && npm --prefix apps/admin run dev      # http://localhost:3001
```

`apps/utilities` needs its own `npm install` too (for standalone typechecking/testing — see `apps/utilities/README.md` for why it's a sibling with its own `node_modules` rather than a workspace dependency):

```bash
npm --prefix apps/utilities install
```

#### 4. Integration tests

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

#### 5. Frontend component/integration tests

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

## CI/CD

`.github/workflows/ci-cd.yml` runs on every push/PR: `shared-java` installs first, then every
Java/Node/frontend project tests in parallel. On a push to `master`, a second phase builds a
Docker image per service (same Dockerfiles the root `docker-compose.yml` uses) and pushes to
Docker Hub (`sodmod1999/grammarcetamol-<service>`), tagged `:latest` and `:<commit-sha>` — this
needs `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` added as repo secrets first. A third phase then
deploys to a cloud server over SSH (this workflow runs on GitHub-hosted runners, off-server)
— see [Deploying to a cloud server](#deploying-to-a-cloud-server) above for the one-time
server setup and required `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY` secrets.

`Jenkinsfile` (repo root) mirrors the same test/build-push/deploy phases, but is meant to run
on a Jenkins instance installed directly on the cloud server itself — its job just listens
for pushes to this branch, and its `Deploy` stage is a local file copy + `docker compose`
run in the same checkout, no SSH involved. Just point a Jenkins job at this repo and
configure the `dockerhub-creds` credential it references.

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
