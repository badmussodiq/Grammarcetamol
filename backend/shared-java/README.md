# shared-java

Not a service — a plain library jar shared by header-trust Java services (services that never see a
raw JWT, only the gateway's `X-User-Id`/`X-User-Role` headers). Extracted from `course-service` in
Phase 3 (`PLAN.md` Task 19) once Enrollment Service became the third consumer — the trigger condition
`PLAN.md`'s original Task 18 was waiting for.

## What's in here

- `dto.ApiResponse<T>` — the `{success, data, error, timestamp}` envelope every endpoint returns.
- `config.CurrentUser` — record read off `X-User-Id`/`X-User-Role`, with `isAdminOrModerator()`,
  `isSuperAdmin()`, `canModify(resourceOwnerId)` helpers. `CurrentUser.ANONYMOUS` for public routes.
- `config.CurrentUserArgumentResolver` — the `HandlerMethodArgumentResolver` that lets controllers
  just declare a `CurrentUser` parameter and have it populated automatically.
- `config.WebConfig` — registers the resolver.
- `exception.ForbiddenException` — plain 403 signal. Started as a `course-service`-local class in
  Task 19's first pass; moved here once Enrollment Service (Task 20) needed the identical concept —
  unlike `CoursePublishValidationException`/`CourseDeletionBlockedException`, there's nothing
  course-specific about "you don't have permission to do this."
- `exception.GlobalExceptionHandler` — common `@RestControllerAdvice` mappings: bean-validation
  errors, `EntityNotFoundException`, `ForbiddenException`, `IllegalArgumentException`, and a
  `RuntimeException` catch-all. Domain-specific exceptions stay local to each service in their own
  `@RestControllerAdvice` — Spring resolves the most specific handler across **all** advice beans in
  the context, not just the one that declared it, so a service-local advice for a more specific
  `RuntimeException` subtype wins over this class's catch-all without any inheritance between the two.

## Not migrated: `auth-service`

`auth-service` keeps its own local `ApiResponse`/`GlobalExceptionHandler` copy. It has a materially
different exception set (`AccountLockedException`, `EmailAlreadyExistsException`, ...) and real
JWT-based identity via Spring Security, not header-trust — there's nothing header-trust-shaped to
share with it, and migrating its `ApiResponse` would be a same-shape-different-purpose coincidence,
not real duplication.

## Wiring

This is a **plain library jar**, not a Spring Boot auto-configuration module or a starter — no
`META-INF/spring/...AutoConfiguration.imports`, nothing that self-registers "magically." Its classes
just happen to carry ordinary Spring stereotype annotations (`@Component`, `@Configuration`,
`@RestControllerAdvice`), the same as any class living directly inside a consuming service.

Because `com.grammarcetamol.shared` isn't a sub-package of a consumer's own base package
(`com.grammarcetamol.course`, `.enrollment`, `.review`, ...), each consuming service's
`@SpringBootApplication` class needs one explicit line naming both packages:

```java
@SpringBootApplication
@ComponentScan(basePackages = {"com.grammarcetamol.course", "com.grammarcetamol.shared"})
public class CourseServiceApplication { ... }
```

Visible, one line per service, no hidden discovery mechanism.

## How to consume

```xml
<dependency>
  <groupId>com.grammarcetamol</groupId>
  <artifactId>shared-java</artifactId>
  <version>0.0.1-SNAPSHOT</version>
</dependency>
```

Not published anywhere — `mvn install` this module into the local `~/.m2` repo before building a
service that depends on it. Not a multi-module Maven reactor on purpose, matching the existing
standalone-poms convention (`auth-service`/`course-service`/etc. each build independently).

```bash
cd backend/shared-java && mvn install
```

## Tests

No dedicated test suite here — this was a mechanical extraction with no behavior change, verified by
`course-service`'s existing `CourseServiceTest`/`CourseStructureServiceTest` suite (13 tests) passing
unchanged after the migration, only import paths changed. A live end-to-end server boot against a real
Postgres instance (confirming the auto-configuration actually wires `WebConfig`'s argument resolver at
runtime, not just at compile time) wasn't verified in the sandbox this was built in — same pre-existing
constraint noted in `auth-service`/`course-service`'s own READMEs, needs a normal dev machine with
Docker running.
