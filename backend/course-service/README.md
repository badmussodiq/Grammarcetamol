# course-service

Spring Boot 3 / Java 21. Phase 2 (`PLAN.md` Tasks 11–12). Owns course authoring (categories, courses,
modules, lessons) and the public course catalog. Reachable through the gateway at `/api/courses/**` and
`/api/categories/**`, or directly on `:9002` in dev.

**No JWT parsing here.** The gateway's `JwtAuthFilter` already validated the token and injects
`X-User-Id` / `X-User-Role` before forwarding — this service just reads those headers
(`CurrentUserArgumentResolver` → `CurrentUser`). There's no `spring-boot-starter-security` dependency
and no `Authentication` object; role/ownership checks are plain `if` statements in the service layer
(`CurrentUser.canModify(instructorId)`, `CurrentUser.isAdminOrModerator()`).

**As of Phase 3 (`PLAN.md` Task 19),** `ApiResponse`, `GlobalExceptionHandler`'s common exception
mappings, and `CurrentUser`/`CurrentUserArgumentResolver`/`WebConfig` moved out to
`backend/shared-java/` (`mvn install`ed locally, depended on here as a normal Maven dependency — see
its own README). Only this service's domain-specific exceptions (`ForbiddenException`,
`CoursePublishValidationException`, `CourseDeletionBlockedException`) still get a local
`CourseExceptionHandler`; Spring resolves the most specific `@ExceptionHandler` across both advice
beans automatically, no inheritance needed.

Upload Service and Media Service (chunked video upload + transcoding) are **intentionally deferred** —
no object storage or MongoDB is provisioned yet. Lessons carry a plain admin-supplied `video_url` string
in the meantime. See `PLAN.md` Tasks 16–17.

## How to run locally

1. Start Postgres: `docker compose -f ../../docker/docker-compose.dev.yml up -d`.
2. `course_db` must exist before Flyway can connect. On a **fresh** `postgres-data` volume the
   `docker/postgres-init/01-create-databases.sh` init script creates it automatically. On an
   **existing** volume (e.g. you already had `auth_db` running before this service existed), the init
   script won't retroactively run — create it once yourself:
   ```bash
   docker exec -it grammarcetamol-postgres psql -U platform -d auth_db -c "CREATE DATABASE course_db;"
   ```
3. `mvn spring-boot:run`

Flyway migrations run automatically on startup (`V1__course_initial_schema.sql`) — no separate migration
step, and it seeds five default categories so the catalog isn't empty on first boot.

### Windows-specific gotcha

Same as `auth-service` and `gateway-service` — if startup fails with `Unable to establish loopback
connection` / `Selector.open()`, see `../auth-service/README.md`'s note on this. It's an environment
issue (security software intercepting the loopback socket), not this codebase; Flyway/JPA/Hibernate all
initialize fine before Tomcat's connector hits it.

## Endpoints

REST, via the gateway or directly on `:9002`:

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/categories` | public | flat list, ordered by `sort_order` |
| `POST /api/categories` | SUPER_ADMIN / MODERATOR | |
| `GET /api/courses` | public\* | catalog: `category`, `difficulty`, `price` (free/paid), `q`, `sort`, `page`, `limit`. Non-admins always get `status=published` regardless of what they pass |
| `GET /api/courses/featured` | public | top 6 by `enrollment_count` |
| `GET /api/courses/{slugOrId}` | public\* | full detail incl. modules/lessons; non-preview lesson `video_url` stripped unless caller owns the course or is admin/moderator; unpublished courses 404 for anyone else |
| `POST /api/courses` | SUPER_ADMIN / MODERATOR | creates as `draft`, `instructor_id` = caller |
| `PATCH /api/courses/{id}` | owner or SUPER_ADMIN | snapshots a `course_versions` row first if the course is already published |
| `POST /api/courses/{id}/publish` | owner or SUPER_ADMIN | validates cover image, price, ≥1 module, ≥1 lesson, all video lessons have a `video_url` — returns the full error list (not just the first) on failure |
| `POST /api/courses/{id}/archive` | owner or SUPER_ADMIN | |
| `DELETE /api/courses/{id}` | owner or SUPER_ADMIN | 409 if `enrollment_count > 0` |
| `GET /api/courses/{id}/versions` | owner or SUPER_ADMIN | |
| `POST /api/courses/{id}/versions/{versionId}/restore` | owner or SUPER_ADMIN | snapshots current state first, so a restore is itself undoable |
| `GET/POST/PATCH/DELETE /api/courses/{id}/modules[/**]` | owner or SUPER_ADMIN for writes, public GET | includes `PATCH .../modules/reorder` |
| `GET/POST/PATCH/DELETE /api/courses/{id}/modules/{moduleId}/lessons[/**]` | owner or SUPER_ADMIN for writes, public GET | includes `.../lessons/reorder` |

\* The gateway's public whitelist is a coarse `GET /api/courses/**` / `GET /api/categories/**` match — it
doesn't distinguish `/versions` from the catalog. The service layer is the real enforcement point: an
unauthenticated `GET .../versions` resolves to `CurrentUser.ANONYMOUS` and gets a 403 from
`canModify`, not a 200.

## Known divergences from `database-schema-and-migrations.md` §3.3

- `lessons.type` is `VARCHAR(20) + CHECK`, not a native Postgres enum — the spec's
  `CREATE TYPE lesson_type AS (...)` is invalid syntax (composite-type, not enum), and VARCHAR+CHECK
  avoids the JDBC bind-parameter casting issue already documented for `auth_db`.
- `courses` gains `slug`, `instructor_name`, `instructor_bio`, `instructor_avatar_url` — there's no
  instructor directory/role yet (`admin-frontend.md` lists "Instructor Management" as **Future**), so
  `instructor_id` is just the creating admin/moderator's `auth_db` user id for audit purposes, and slug
  is needed for the student frontend's `/courses/[slug]` route.
- `resources` and `tags`/`course_tags` tables exist (matching the spec) but have no JPA entities or
  controllers yet — nothing in Phase 2's scope writes to them. Add entities when resource attachments or
  catalog tag filtering are actually built.

## Config

| Property | Default | |
|---|---|---|
| `server.port` | `9002` | |
| `spring.datasource.url` | `jdbc:postgresql://localhost:9009/course_db` | |

`/actuator/health` and `/actuator/info` are exposed.

## Tests

`mvn test` — Mockito-based unit tests only (`CourseServiceTest`, `CourseStructureServiceTest`): publish
validation, delete guard, slug collision handling, reorder validation, and ownership/role checks. No
Testcontainers/real-DB integration test yet — the full-text search query (`plainto_tsquery`) needs real
Postgres, not H2, so an integration test would need Testcontainers wired in as its own follow-up.
