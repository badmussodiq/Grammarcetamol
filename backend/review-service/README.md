# review-service

Spring Boot 3 / Java 21. Phase 3 (`PLAN.md` Task 22). Owns course reviews and moderation. Reachable
through the gateway at `/api/reviews/**` and `/api/courses/{courseId}/reviews`, or directly on `:9004`
in dev.

Built on `backend/shared-java` (fourth consumer) — same header-trust pattern as `course-service`/
`enrollment-service`: no JWT parsing, `CurrentUser` read off the gateway's `X-User-Id`/`X-User-Role`
headers.

## The 50%-completion gate

`POST /api/reviews` calls `enrollment-service`'s `GET /api/enrollments/completion` live (`EnrollmentServiceClient`,
plain REST, same "trusted internal caller" convention as `enrollment-service`'s own `CourseServiceClient`
— presents `X-User-Role: SUPER_ADMIN` so it can check *any* user's completion, not just its own). No
event subscription, no denormalized flag — always fresh. Duplicate-submission is checked first (a
cheap DB lookup before the REST call), returning 409 pointing at the edit endpoint instead of creating
a second row. `enrollment-service`'s completion response also carries the enrollment's own id, stamped
onto `reviews.enrollment_id` for audit/lineage — added as a small extension to Task 20's already-shipped
`CompletionResponse` DTO during this task, not a new endpoint.

## Gateway routing gotcha

`GET /api/courses/{courseId}/reviews` lives under the `/api/courses/**` path prefix that already routes
to `course-service` — the gateway's `RouteConfig` registers a more specific `course-reviews` route
(`/api/courses/*/reviews` → this service) **before** the general `course-service` route, since Spring
Cloud Gateway matches routes in registration order and the broader pattern would otherwise swallow this
one first. No `JwtAuthFilter` whitelist change was needed — the path already matches the existing
`GET /api/courses/**` entry in `OPTIONALLY_AUTHENTICATED_ROUTES`.

## Not built (spec exists, nothing consumes it yet)

- `review_votes` table exists in the migration (matching `database-schema-and-migrations.md` §3.6) but
  has no JPA entity/controller — nothing in this task's scope writes "helpful" votes yet, same
  "don't add entities for unused tables" call `course-service` made for `resources`/`tags`.
- Editing a review doesn't reset it to `pending` for re-moderation — an approved review stays approved
  after an edit. Not specified either way in the docs; kept simple rather than guessing at a
  re-moderation policy.
- **`courses.avg_rating`/`courses.review_count` (in `course_db`, owned by `course-service`) are never
  updated by this service.** Same shape of gap as `enrollment-service` never incrementing
  `courses.enrollment_count` — both are cross-service denormalized counters that the original
  `database-schema-and-migrations.md`/Task 12 notes expected a later phase to start maintaining, and
  neither Task 20 nor this task actually wired that up. Worth a dedicated follow-up (likely a small
  internal endpoint on `course-service`, or an event consumer there) rather than scope-creeping it into
  either service unprompted.

## How to run locally

Same pattern as `enrollment-service`: infra up, `backend/shared-java` installed, `review_db` created
(`docker/postgres-init/01-create-databases.sh` handles it on a fresh volume; on an existing volume,
`CREATE DATABASE review_db;` once), `enrollment-service` and `course-service` reachable, then
`mvn spring-boot:run`.

## Endpoints

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/reviews` | any authenticated user | body `{courseId, rating, title?, comment?}`; 403 if not enrolled or under the completion threshold; 409 if already reviewed |
| `PATCH /api/reviews/{id}` | owner, within 7 days | 403 past the edit window or if not the owner |
| `GET /api/courses/{courseId}/reviews` | public | approved only, paginated |
| `GET /api/reviews` | SUPER_ADMIN/MODERATOR | all statuses, filterable by `status`/`courseId`/`rating` |
| `PATCH /api/reviews/{id}/moderate` | SUPER_ADMIN/MODERATOR | body `{status, note?}` |

## Events

Publishes to `review.exchange`: `review.submitted`, `review.approved` (in addition to `review.moderated`
when the new status is specifically `approved`), `review.moderated` (every moderation transition).
Publish-only — no consumer, since the completion check is a live call rather than an event subscription.

## Config

| Property | Default | |
|---|---|---|
| `server.port` | `9004` | |
| `spring.datasource.url` | `jdbc:postgresql://localhost:9009/review_db` | |
| `app.enrollment-service-url` | `http://localhost:9003` | |
| `app.review-completion-threshold-pct` | `50` | |
| `app.review-edit-window-days` | `7` | |

## Tests

`mvn test` — Mockito unit tests (`ReviewServiceTest`, 10 tests): the 50% gate's exact boundary (49%
blocked, exactly 50% allowed), not-enrolled rejection, duplicate-submission conflict, the 7-day edit
window's boundary (day 3 allowed, day 8 blocked), ownership check, and moderation's audit-field/event
behavior (approve publishes both `review.moderated` and `review.approved`; reject publishes only the
former). Live-verified end-to-end against the real running `enrollment-service` (a real cross-service
REST call correctly returned "not enrolled" for a test user genuinely not enrolled in the target
course) and auth boundaries (401/403) via curl.
