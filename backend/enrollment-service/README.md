# enrollment-service

Spring Boot 3 / Java 21. Phase 3 (`PLAN.md` Task 20). Owns free/paid enrollment, per-lesson progress
tracking, prerequisite gating, and the at-risk student query. Reachable through the gateway at
`/api/enrollments/**` and `/api/progress`, or directly on `:9003` in dev.

Built on `backend/shared-java` (see its README) — same header-trust pattern as `course-service`: no
`spring-boot-starter-security`, no JWT parsing, `CurrentUser` read straight off the gateway's
`X-User-Id`/`X-User-Role` headers.

## Cross-service calls

This service calls `course-service` directly over plain REST (`CourseServiceClient`, using
`RestClient` with a classic `SimpleClientHttpRequestFactory` — see the class doc comment for why not
the JDK `HttpClient`-based default), not gRPC — course-service has no gRPC infrastructure, and adding
one just for this would be more new surface area than a call to an already-public endpoint. These
calls never go through the gateway and never carry a real end user's identity: they present as a
trusted internal caller (`X-User-Id: 00000000-0000-0000-0000-000000000000`, `X-User-Role: SUPER_ADMIN`)
so course-service's existing `CurrentUser.canModify`/`isAdminOrModerator` checks reveal the full
curriculum (including non-preview lesson `videoUrl`) regardless of who's enrolled — course-service has
no "enrolled student" concept to check against, since that's what this service is for. Safe because
course-service is never reachable from a browser, only from other backend services.

## Free vs. paid enrollment

`POST /api/enrollments` only accepts free courses (`price == 0`); it 400s otherwise, pointing the
caller at checkout instead. Paid enrollment happens via `payment.completed` (`PaymentEventListener`
consuming `payment.exchange`, published by `backend/payment-service` — Task 21). Both paths funnel
through the same idempotent `(user_id, course_id)`-unique creation logic, so a duplicate free-enroll
click or a redelivered `payment.completed` message are both no-ops, not errors or duplicate rows.

## Prerequisite gating & the "learn" endpoint

`GET /api/enrollments/course/{courseId}/learn` is what the student frontend's learning interface
(Task 25) consumes — it merges course-service's module/lesson tree with this service's own
`lesson_progress` rows into a per-lesson `locked | unlocked | current | completed` state. Gating is
sequential across the **whole course** (not reset per module): a lesson is locked unless the
immediately preceding lesson (in module-then-lesson position order) is completed. The first lesson in
the course is always unlocked. `videoUrl` is stripped from the response for locked lessons.

## Completion percentage

Computed live on every call (`completed lesson_progress rows ÷ total lessons from course-service`), no
caching, no denormalized column. Reused by three call sites: the "learn" endpoint's `completionPct`,
`GET /api/enrollments/completion` (called internally by `review-service`, Task 22, for the 50%-review
gate — or by a student checking their own), and the at-risk query.

## At-risk query

`GET /api/enrollments/at-risk` (SUPER_ADMIN/MODERATOR only) — active enrollments, enrolled more than
`app.at-risk-min-days-since-enrollment` days ago (default 14), with completion strictly below
`app.at-risk-completion-threshold-pct` percent (default 20) — thresholds match the only numbers given
anywhere in the repo's specs (`implementation-phases.md`'s Phase 3 note). Candidate enrollments are
batched by distinct `course_id` for the course-service lookup, not called once per enrollment.

## How to run locally

1. Start infrastructure: `docker compose -f ../../docker/docker-compose.dev.yml up -d` (or, if Docker
   runs inside WSL2, `wsl docker compose -f docker/docker-compose.dev.yml up -d` from the repo root —
   a plain `docker` command from a Windows shell won't see WSL2's Docker at all).
2. `backend/shared-java` must be `mvn install`ed first (`cd ../shared-java && mvn install`).
3. `enrollment_db` must exist before Flyway can connect — same situation as `course_db` in
   `course-service/README.md`. On a fresh `postgres-data` volume,
   `docker/postgres-init/01-create-databases.sh` creates it automatically; on an existing volume:
   ```bash
   docker exec -it grammarcetamol-postgres psql -U platform -d auth_db -c "CREATE DATABASE enrollment_db;"
   ```
4. `course-service` should be running too (`:9002`) — most endpoints call out to it.
5. `mvn spring-boot:run`

### Windows-specific gotcha

Same pre-existing issue as `auth-service`/`course-service` (`Unable to establish loopback connection` /
`Selector.open()`), and it can strike **any** code path that opens an NIO `Selector` on this machine —
not just Tomcat's connector. `CourseServiceClient`'s `RestClient` was deliberately built on
`SimpleClientHttpRequestFactory` (classic `HttpURLConnection`) rather than the JDK's
`java.net.http.HttpClient`-based default specifically because the latter also opens a `Selector` at
construction time and hit the same failure specifically when launched from sandboxed automation
(`mvn spring-boot:run` via a scripted Bash/PowerShell call) — a normal direct run starts cleanly
(`GET :9003/actuator/health` → `UP`, confirmed live). If you hit this from your own terminal, it's the
same fix as `auth-service`: a `java.exe` process exclusion in whatever security software is
intercepting the loopback socket.

## Endpoints

REST, via the gateway or directly on `:9003`. Everything requires authentication — no public/optional
route tier for this service (unlike course-service's catalog reads).

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/enrollments` | any authenticated user | free courses only (400 if `price > 0`); idempotent on `(user_id, course_id)` |
| `GET /api/enrollments/mine` | any authenticated user | |
| `GET /api/enrollments/course/{courseId}/learn` | enrolled user | 404 if not enrolled; per-lesson lock state + overall `completionPct` |
| `PATCH /api/progress` | enrolled user | body `{courseId, lessonId, currentTime, completed}`; upserts `lesson_progress`; completing the last lesson transitions the enrollment to `completed` |
| `GET /api/enrollments/completion?userId=&courseId=` | SUPER_ADMIN/MODERATOR, or the user checking their own | internal — used by review-service's 50% gate |
| `GET /api/enrollments/at-risk` | SUPER_ADMIN/MODERATOR | |

## Events

Publishes to `enrollment.exchange`: `enrollment.created`, `enrollment.completed`,
`lesson.progress.updated`. Consumes `payment.completed` from `payment.exchange` (declared here as a
consumer-side queue/binding, so this service's own migration/config doesn't depend on
`payment-service` having started first).

## Config

| Property | Default | |
|---|---|---|
| `server.port` | `9003` | |
| `spring.datasource.url` | `jdbc:postgresql://localhost:9009/enrollment_db` | |
| `app.course-service-url` | `http://localhost:9002` | |
| `app.at-risk-completion-threshold-pct` | `20` | |
| `app.at-risk-min-days-since-enrollment` | `14` | |

`/actuator/health` and `/actuator/info` are exposed.

## Tests

`mvn test` — Mockito-based unit tests (`EnrollmentServiceTest`, 12 tests): idempotent free/paid
enrollment, prerequisite gating (locked-until-previous-completed, first lesson always unlocked),
enrollment auto-completion on the last lesson, and the at-risk threshold boundary (exactly the
threshold percentage is correctly *not* at-risk). No Testcontainers/real-DB integration test, same
rationale as `course-service`.
