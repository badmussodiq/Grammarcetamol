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
├── PHASE4.md                        Phase 4 (Live Classes & Notifications) status tracker
├── admin-frontend.md                Admin UI/UX design spec
├── student-frontend.md              Student UI/UX design spec
├── database-schema-and-migrations.md Full target schema for every planned service
└── user-stories.md                  Full product backlog
```

## Current state (Phases 0–4 done; Phase 5 not started)

**Phase 0 — Foundation** is done: the gateway, `apps/utilities` shared component/hook library, and the monorepo layout (deliberately no root npm project — see `PLAN.md` Task 1).

**Phase 1 — Identity, Access & User Management** is done end-to-end for both portals: registration, email verification (now OTP-based, see Phase 3.5), login/logout/refresh, forgot/reset password, gRPC token validation, profile management, admin user (moderator/support) provisioning, and a real `/profile` page on the student side. Cross-portal login is rejected — a student's credentials don't grant access to the admin site and vice versa. Google OAuth is **intentionally deferred** — see `PLAN.md`.

**Phase 2 — Course Content & Discovery** is done: `course-service` (categories, courses with draft/review/published/archived lifecycle + versioning, modules, lessons, public catalog with search/filter/sort), the student catalog/detail pages + landing hero, and the admin course-management pages (list, create, per-course Overview/Edit/Content/Versions tabs, plus a real chunked-upload UI driving `upload-service` end-to-end). Media Service (Task 17) remains **intentionally deferred** — no MongoDB was provisioned when Phase 2 shipped (Phase 3.5 later provisioned one for Notification Service — Media Service just hasn't been revisited since).

**Phase 3 — Enrollment, Payments & Learning Loop** is done: `enrollment-service`, `payment-service` (the repo's first NestJS service), `review-service`, the full student learning loop (checkout → enroll → watch → complete → review), and the full admin side (shell, `/revenue`, `/transactions`, review moderation, student directory). The old NGN/USD pricing mismatch is resolved — all courses are NGN-only by explicit user decision, not deferred. `backend/integration-tests` (7 spec files, 82 tests) proves the whole loop against the real running stack, not mocks.

**Phase 3.5 — MVP Completion** is done: a real Notification Service (`backend/notification-service`, NestJS + MongoDB) sends real email via SMTP in this environment, not just logs it; OTP-based email verification and password reset; account lockout after 5 failed logins (a real bug here — the lockout never actually persisted due to a `@Transactional` rollback issue — was found and fixed during this phase's own integration pass); a support-ticket flow; a real admin `/dashboard` with live numbers; and the `#F44336` brand color across both apps. See `PLAN.md` Tasks 31–37 for the full per-task detail, including the other bugs found and fixed along the way.

**Phase 4 — Live Classes & Notifications** is done: `payment-service` subscription billing (recurring Paystack charges, group and negotiated-price private billing), `backend/live-class-service` (persistent Classes with independent live Sessions, moderated real-time chat over Socket.IO, materials, backend-enforced join-room authorization, instructor scheduling conflict detection, invitations), Notification Service extended with an in-app center (SSE-pushed, polling fallback) and Announcements, both frontends' live-class and notification UIs, and the admin scheduler (FullCalendar) + announcement manager. Task 45's integration pass live-verified all three end-to-end chains (free group class, private subscription-billed class, announcement fan-out) against the real running stack and closed three real bugs found only at the integration layer. See [`PHASE4.md`](./PHASE4.md) for the full task-by-task tracker.

**Not yet built**: everything past Phase 4 — Service Requests, Support & Business Operations (Phase 5) onward (`implementation-phases.md`).

See `PLAN.md` and `implementation-phases.md` for the authoritative, up-to-date status of every task and phase, `PHASE4.md` for Phase 4 specifically, and `todo.md` for a quick-scan summary.

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

Every push to `master` OR `development` that passes tests and builds+pushes images (see
[CI/CD](#cicd) below) automatically deploys — same Docker, no Kubernetes. **No git on the
server**: it only ever runs pre-built images pulled from the registry. `master` deploys to
the **production** GitHub Environment, `development` to the **development** one — see
[Deploying a second environment to the same server](#deploying-a-second-environment-to-the-same-server)
below for what a GitHub Environment is and how the two stay isolated from each other on
one host. If you only ever push to `master`, the rest of this section works exactly as a
single-environment setup — just create the one "production" environment and skip that
subsection. How the deploy step reaches the server depends on which pipeline you use:
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
maintain ONE secret per environment holding the full file contents, and the deploy step
writes it fresh each run — no SSH-in-and-edit-a-file step, ever:
- **GitHub Actions**: an `ENV_FILE` secret inside each GitHub Environment (Settings ->
  Environments -> `production` (or `development`) -> Add secret; paste the whole file,
  multi-line values work fine — see
  [Deploying a second environment to the same server](#deploying-a-second-environment-to-the-same-server)
  for how to create the environment itself before this step). Not a repo-level secret —
  this is the whole point of using an Environment here: `production` and `development`
  each get their own `ENV_FILE` value under the same secret *name*, and the workflow's
  `environment:` key picks the right one automatically based on which branch triggered it.
- **Jenkins**: a "Secret file" credential named `prod-env-file` (Manage Jenkins ->
  Credentials -> add a Secret file, upload the `.env` content as a file). Jenkins isn't
  wired up for a second environment yet — this pipeline still only tracks `master`.

Either way the content is the same — see `.env.example` for the full variable list, and
note the **IMPORTANT ORDERING CAVEAT below** about `COMPOSE_PROFILES=proxy`.

**What's automatic vs. what genuinely can't be:** directory creation (`DEPLOY_DIR`,
`DATA_DIR`'s five subdirectories) and TLS cert issuance both happen automatically as part
of every deploy now — `deploy.sh` sources `.env` and calls
`docker/scripts/certbot-bootstrap.sh`, which checks each configured domain for an existing
cert and only issues the ones missing (a fast no-op once everything already has one — see
that script's own comments). The only things that can't be automated are the ones outside
this repo's control entirely: installing Docker on a fresh server, and pointing DNS at it
(no DNS provider API integration here — do that by hand once, in your registrar/DNS host).

**One-time server setup** (there's no real server configured yet — this is what to do
once you have one):
1. Install Docker + the Docker Compose plugin on the server.
2. **Create the GitHub Environment** (if using GitHub Actions): Settings -> Environments
   -> New environment -> name it `production`. Then set up its `ENV_FILE` secret (Add
   secret, inside that environment) — see `.env.production` in the repo root for a
   filled-in starting point (real Paystack test-mode keys, real SMTP creds, a freshly
   generated `INTERNAL_TOKEN`, the real `grammarcetamol.com` domain scheme — not
   committed, copy its contents in directly). It already has everything needed for BOTH
   the first plain deploy and the TLS bootstrap that follows it — nothing needs to be
   added or removed between the two, unlike the old two-phase flow.
   (Using Jenkins instead: set up the `prod-env-file` credential with the same content —
   no GitHub Environment involved. Jenkins isn't wired up for the automatic directory/cert
   bootstrap flow below yet, only the GitHub Actions path is.)

   **Also add `NEXT_PUBLIC_API_URL` as an Environment *variable*** (Settings -> Environments
   -> `production` -> Environment variables -> Add variable — not a secret, it's a public
   URL), same value as the `ENV_FILE` line. This is the one that actually matters:
   `ci-cd.yml`'s `build-and-push` job passes it as a Docker build-arg when building the
   frontend images, which is what's actually baked into the bundle — the `ENV_FILE` copy
   only matters if you ever run `docker compose build` by hand directly on the server
   (`deploy.sh` never does). Skipping this step doesn't error, it just silently ships an
   image still pointed at `http://localhost:9000`.
3. If the images are private, `docker login` once on the server against Docker Hub with
   an access token.
4. **If using GitHub Actions** (runs off-server, needs SSH in): add the deploy user's
   public key to that account's `~/.ssh/authorized_keys`, then add `DEPLOY_HOST`,
   `DEPLOY_USER`, `DEPLOY_SSH_KEY` (the matching private key) as secrets **inside the
   `production` environment** you just created — not repo-level secrets.
   **If using Jenkins** (installed directly on this server): none of the above is
   needed — just point a Jenkins job at this repo with `dockerhub-creds` and
   `prod-env-file` configured, and its `Deploy` stage runs locally.
5. Point DNS A records at the server's IP — this has to happen before the deploy below,
   since cert issuance needs it to already resolve: `grammarcetamol.com` (the bare root —
   the student frontend lives at the apex, not a subdomain), `admin.grammarcetamol.com`,
   `api.grammarcetamol.com`.
6. Push to `master` (or trigger the Jenkins job). This one deploy does everything: creates
   `/opt/grammarcetamol` and its `data/` subdirectories if they don't exist, pulls images,
   issues all three TLS certs (one `certonly` call per domain, not one call with three
   `-d` flags — each `server{}` block's `ssl_certificate` path is
   `/etc/letsencrypt/live/<that domain>/...`, see `docker/nginx/templates/*.conf.template`,
   and a single call with multiple `-d` flags would instead bundle them into one
   multi-SAN certificate stored under just the *first* domain's name, leaving the other
   two server blocks pointed at directories that don't exist — `certbot-bootstrap.sh`
   already does this correctly, one call per domain), and brings the whole stack up
   including nginx now serving real HTTPS.
   (Real certs need real DNS + a real publicly-reachable server, so this step is
   documented but not something this repo can verify end-to-end — I confirmed nginx's own
   config is correct by starting it against locally-generated self-signed certs at the
   exact paths this produces, and confirmed subdomain routing works; the actual Let's
   Encrypt ACME handshake itself needs a real domain to test.)
7. **Schedule renewals** — certs expire in 90 days; `docker/scripts/certbot-renew.sh` runs
   the (much simpler, no port conflict) webroot renewal + reloads nginx, and no-ops if
   nothing's due yet, so it's safe to run often. Same systemd-timer pattern as the
   watchdog (see below):
   ```bash
   # in the .service file's ExecStart, point at certbot-renew.sh instead of compose-watchdog.sh,
   # and use a daily OnUnitActiveSec instead of every 5 minutes
   ```

After that, deploys just happen — no manual steps, and nginx/TLS survive every deploy
untouched (deploys only ever refresh `docker-compose.yml` + `docker/` + `.env`, never
touch the `certbot-certs` volume, and `certbot-bootstrap.sh` no-ops once every configured
domain already has a cert). To redeploy an older version by hand — on the server directly
if using Jenkins, or over SSH if using GitHub Actions:
```bash
# GitHub Actions setup: ssh <user>@<host> first, then:
cd /opt/grammarcetamol && bash docker/scripts/deploy.sh <commit-sha>
```

### Deploying a second environment to the same server

**What a GitHub Environment is:** a named scope (Settings -> Environments -> New
environment) that groups its own secrets and variables, separate from repo-level secrets
and from any other environment's. A workflow job opts in with `environment: <name>` (see
`.github/workflows/ci-cd.yml`'s `deploy` job — it resolves to `production` or
`development` based on which branch triggered the run), and every `secrets.X` in that job
then resolves from that environment's own secret store. Two environments can have a secret
with the identical *name* (`ENV_FILE`, `DEPLOY_HOST`, ...) holding completely different
*values* — that's the mechanism this whole section relies on. You can also add protection
rules per environment (required reviewers, wait timers, restrict which branches may
deploy to it) — not required for what follows, but worth knowing it's there.

This project's `development` GitHub Environment deploys to the **same physical server**
as `production`, in a separate directory, running alongside it rather than replacing it.
That only works because every service that binds a host port, every explicit
`container_name`, the Docker network name, and the Compose project name are all
overridable via env vars with defaults that reproduce the original single-environment
setup exactly (see `docker-compose.yml`, `docker/docker-compose.dev.yml`, and
`.env.example`'s "running a second environment on the same server" section) — an existing
production `.env` needs zero changes for any of this.

**One-time setup, once `production` is already deployed per the steps above:**
1. `mkdir -p /opt/grammarcetamol-dev /opt/grammarcetamol-dev/data` on the server (a
   second, independent directory — `docker-compose.yml` + `docker/` get copied here fresh
   on every `development` deploy, same as `/opt/grammarcetamol` for production; `data/`
   holds this environment's own bind-mounted database files, separate from production's).
2. Settings -> Environments -> New environment -> name it `development`.
3. Add its `ENV_FILE` secret — see `.env.development` in the repo root for a filled-in
   starting point. The values that must actually differ from production's (not
   placeholders — required for both stacks to coexist on this host):
   - `DATA_DIR=/opt/grammarcetamol-dev/data`
   - `COMPOSE_PROJECT_NAME=grammarcetamol-dev`
   - `CONTAINER_PREFIX=grammarcetamol-dev`
   - `GATEWAY_HOST_PORT=9100`, `STUDENT_HOST_PORT=3100`, `ADMIN_HOST_PORT=3101`
   - `POSTGRES_HOST_PORT=9109`, `REDIS_HOST_PORT=9110`, `RABBITMQ_HOST_PORT=9111`,
     `RABBITMQ_MGMT_HOST_PORT=9112`, `MINIO_API_HOST_PORT=9113`,
     `MINIO_CONSOLE_HOST_PORT=9114`, `MONGO_HOST_PORT=9115`
   - `NEXT_PUBLIC_API_URL=https://api-dev.grammarcetamol.com`,
     `STUDENT_FRONTEND_URL=https://dev.grammarcetamol.com`,
     `CORS_ALLOWED_ORIGINS=https://dev.grammarcetamol.com,https://admin-dev.grammarcetamol.com`
     (only correct once the shared-nginx setup below is live — use the plain
     `http://<server-ip>:3100`-style URLs temporarily if this environment goes live first)
   - leave `COMPOSE_PROFILES` unset here — this environment never runs its own nginx; its
     public domains are served by *production's* nginx instead, see below.
   - real secrets can be shared with production (`PAYSTACK_SECRET_KEY` etc., still
     Paystack *test*-mode either way) or swapped for dev-specific ones — your call.

   Also add `NEXT_PUBLIC_API_URL` as an Environment *variable* here too (same value as
   above) — see the note in the production setup steps above for why this one, not the
   `ENV_FILE` copy, is what CI actually bakes into the built image.
4. Add `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` to the `development` environment
   too — identical values to `production`'s (same server), but GitHub Environment secrets
   don't inherit from each other, so they need to be entered again here.
5. Push to `development` — first deploy writes `/opt/grammarcetamol-dev/.env`, pulls
   images tagged for that commit, and brings up a fully separate stack (its own Postgres/
   Redis/RabbitMQ/MinIO/Mongo, its own gateway/frontends) reachable at
   `http://<server-ip>:3100` (student) and `:3101` (admin) immediately — real public HTTPS
   domains need the shared-nginx step below first.

Rolling back development works the same way as production: SSH in, `cd
/opt/grammarcetamol-dev && bash docker/scripts/deploy.sh <commit-sha>`.

#### Serving the development domains through the same nginx

Only one nginx can ever bind 80/443 on this host, and that's production's — so
`dev.grammarcetamol.com` / `admin-dev.grammarcetamol.com` / `api-dev.grammarcetamol.com`
are served by *production's* nginx, proxying to development's containers via its
published host ports (`GATEWAY_HOST_PORT`/`STUDENT_HOST_PORT`/`ADMIN_HOST_PORT` from step 3
above) rather than Docker service-name DNS — development's own containers live in a
completely separate compose project/network that production's nginx can't otherwise reach.
See `docker-compose.yml`'s nginx service (the `extra_hosts: host.docker.internal` mapping)
and `docker/nginx/templates-dev/*.conf.template` for the mechanism.

These three templates are **not** mounted by default — copying them in before their certs
exist would make nginx refuse to start (same chicken-and-egg problem the original three
domains have, and it would take production's already-working nginx down with it, since all
`.template` files under `docker/nginx/templates/` load into the same nginx config). Do this
only once development is already deployed per the steps above:

1. Point DNS: `dev.grammarcetamol.com`, `admin-dev.grammarcetamol.com`,
   `api-dev.grammarcetamol.com` A records at the same server IP.
2. Bootstrap certs for these three domains the same way as production's (one `certonly`
   call per domain — see step 7 above for why not one call with three `-d` flags):
   ```bash
   cd /opt/grammarcetamol
   for domain in dev.grammarcetamol.com admin-dev.grammarcetamol.com api-dev.grammarcetamol.com; do
     docker compose --profile proxy run --rm -p 80:80 --entrypoint certbot certbot \
       certonly --standalone -d "$domain" \
       --email horluwatosin1999@gmail.com --agree-tos --no-eff-email
   done
   ```
3. Copy the dev templates into the active directory and reload:
   ```bash
   cp /opt/grammarcetamol/docker/nginx/templates-dev/*.template /opt/grammarcetamol/docker/nginx/templates/
   ```
4. Add `DOMAIN_APP_DEV=dev.grammarcetamol.com`, `DOMAIN_ADMIN_DEV=admin-dev.grammarcetamol.com`,
   `DOMAIN_API_DEV=api-dev.grammarcetamol.com`, `DEV_GATEWAY_HOST_PORT=9100`,
   `DEV_STUDENT_HOST_PORT=3100`, `DEV_ADMIN_HOST_PORT=3101` to **production's** `ENV_FILE`
   (not development's — nginx belongs to production's compose project) and push to
   `master` again. This redeploy also re-copies `docker/` fresh from the repo, which would
   overwrite step 3's manual copy — **re-run step 3 after every subsequent production
   redeploy**, or fold it into `deploy.sh` yourself if this becomes routine; it's a manual
   step here deliberately, not automated, so a template still mid-bootstrap can never
   silently take a production redeploy down with it.

### Scaling

The 8 backend microservices (auth, course, enrollment, review, payment, notification,
upload, live-class) can each be scaled independently with Compose's built-in `--scale`:
```bash
docker compose up -d --scale course-service=3 --scale enrollment-service=2
```
This works because those 8 services deliberately have **no** `container_name` and **no**
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

**App service ports** (each service's own `application.yml`/`.env` — see §2 below): gateway `9000`, auth `9001`, course `9002`, enrollment `9003`, review `9004`, payment `9005`, upload `9006`, live-class `9007`, notification `9008`. auth-service's internal gRPC port (used only by the gateway's token-validation client) stays at `9091`, outside this block — it's an implementation detail, not a port anything external ever hits directly.

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

`payment-service`, `upload-service`, `notification-service`, and `live-class-service` are Node/NestJS, not Maven — see each one's own `.env.example` for setup (`payment-service` needs real Paystack test-mode keys; `upload-service`'s defaults already match the compose file's MinIO credentials; `notification-service`/`live-class-service` point at the dedicated `grammarcetamol-mongo` instance, port `9015`) before `npm install && npm run start:dev`. `upload-service` also needs its own `upload_db` created first, same as the Java services. All four keep their unit-test specs in their own `test/` directory mirroring `src/` (e.g. `backend/payment-service/test/payments/payments.service.spec.ts` tests `src/payments/payments.service.ts`), same convention as the Java services' `src/test/java/` vs. `src/main/java/` split — run with `npm test` (each service's own `package.json` points Jest at `test/` via `roots`). `upload-service`'s `e2e/upload-flow.e2e.ts` is separate again — a real end-to-end script, not a unit spec, run via `npm run test:e2e`.

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
separate `src/test/java/` from `src/main/java/`. The NestJS backend services follow the
same convention — see the next section.

```bash
npm --prefix apps/admin test
npm --prefix apps/student test
npm --prefix apps/utilities test
```

## CI/CD

`.github/workflows/ci-cd.yml` runs on every push/PR: `shared-java` installs first, then every
Java/Node/frontend project tests in parallel. On a push to `master` **or** `development`, a
second phase builds a Docker image per service (same Dockerfiles the root `docker-compose.yml`
uses) and pushes to Docker Hub (`sodmod1999/grammarcetamol-<service>`), tagged with a
branch-specific floating tag (`:latest` for `master`, `:dev` for `development`) plus
`:<commit-sha>` always — this needs `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` added as repo
secrets first (shared across both branches, not environment-scoped — Docker Hub push doesn't
differ per environment). A third phase then deploys to a cloud server over SSH (this workflow
runs on GitHub-hosted runners, off-server), using the `production` GitHub Environment for
`master` and `development` for the `development` branch — see
[Deploying to a cloud server](#deploying-to-a-cloud-server) above for the one-time server
setup and [Deploying a second environment to the same server](#deploying-a-second-environment-to-the-same-server)
for what a GitHub Environment is and how the two deploys coexist.

`Jenkinsfile` (repo root) mirrors the same test/build-push/deploy phases, but is meant to run
on a Jenkins instance installed directly on the cloud server itself — its job just listens
for pushes to `master`, and its `Deploy` stage is a local file copy + `docker compose` run in
the same checkout, no SSH involved. Just point a Jenkins job at this repo and configure the
`dockerhub-creds` credential it references. Jenkins isn't wired up for a second environment —
that's GitHub-Actions-only for now.

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
