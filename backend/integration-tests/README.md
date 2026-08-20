# integration-tests

Cross-service integration tests that hit the **real running stack** through the gateway —
not mocks, not a single service in isolation. It's a sibling project rather than living
inside `payment-service`/`enrollment-service`/`review-service` because it doesn't belong to
any one of them; it tests the boundary *and* the business flow *between* them (the
gateway's JWT validation, each service's own role checks, and real cross-service calls like
review-service checking completion against enrollment-service, or payment-service pricing a
course fetched live from course-service).

Compare with `backend/upload-service/e2e/upload-flow.e2e.ts`, which hits the real stack the
same way but is a one-off console script for a single service's happy-path flow. This
project uses real Jest `describe`/`it`/`expect` so failures show up as normal test
failures, and it's meant to grow — more cross-service checks belong here, not as more
one-off scripts.

## What's here (11 files)

- `auth-flow.integration.spec.ts` — register, duplicate-email 409, wrong-password 401,
  login succeeding before email verification (documented behavior, not a bug), fetching
  one's own profile.
- `course-catalog.integration.spec.ts` — admin builds a real course end-to-end (draft →
  module → lesson → publish) through the real API; confirms a draft course is invisible to
  the public catalog and a published one isn't; confirms the publish-validation guard
  actually rejects an incomplete course.
- `enrollment-learning.integration.spec.ts` — free enrollment (idempotent, rejects paid
  courses), the learn endpoint showing every lesson reachable with no locking (Task 30
  removed sequential prerequisite gating), progress tracking, and completion percentage.
- `payment-flow.integration.spec.ts` — real calls to Paystack's test-mode API (not mocked):
  `initialize` correctly rejects a free/unpublished course before ever calling Paystack, and
  succeeds for a real paid NGN course; `confirm` correctly reports "not completed" for an
  unpaid reference and 404s for an unknown one. Actually *completing* a charge needs
  Paystack's hosted popup + a test card, which isn't automatable headlessly — that part is
  proven manually (see `PLAN.md` Task 30's real completed transaction).
- `review-moderation.integration.spec.ts` — the 50%-completion gate (a real cross-service
  call to enrollment-service, not a mocked flag), duplicate-submission 409, admin moderation
  transition, and confirms a `pending` review never leaks into the public reviews endpoint
  while an `approved` one does.
- `auth-boundary.integration.spec.ts` — every write/admin-gated endpoint on
  `enrollment-service`, `payment-service`, `review-service`, `live-class-service` (Task 43's
  admin scheduler surface), and `notification-service`'s announcements (Task 44): a request
  with no token gets `401`, a request from a real logged-in STUDENT gets `403` on anything
  admin/moderator/SUPER_ADMIN-only, with a same-endpoint `200` sanity check using a real
  SUPER_ADMIN token alongside each `403` where a real resource isn't needed to check it.
- `notification-flow.integration.spec.ts` — the OTP email-verification round-trip (reading
  the real code out of Redis, exactly where `AuthService.checkOtp()` reads it from), the
  account-lockout → locked-email → OTP-reset recovery chain, a support-ticket create→close
  lifecycle with `notification_logs` assertions on every template, and a 401/403 sweep on
  `notification-service`'s own admin-gated endpoints. Added for `PLAN.md` Task 37 — found and
  helped fix two real `auth-service` bugs along the way (account lockout never actually
  persisting, and `resetPassword()` not clearing an existing lockout), see Task 37's own
  status note for the full story.
- `liveclass-enrollments.integration.spec.ts` — the `/api/classes/enrollments/mine` vs.
  `/api/enrollments/mine` route-collision fix (Task 41), and the public invitation-preview
  endpoint (viewable with no auth, never leaks the invited student's identity, 404s for an
  unknown token).
- `liveclass-notification-flow.integration.spec.ts` — notification preferences partial-update
  (a real Task 40 regression), announcement fan-out + SSE delivery (with recipient-count
  parity between the pre-publish estimate and the actual fan-out — Task 45), preference
  gating actually suppressing delivery, and live-class session-start fan-out via the
  `liveclass.exchange` binding.
- `liveclass-full-chain.integration.spec.ts` — Task 45's "first chain": a free `OPEN`/`GROUP`
  class end to end. Covers a real, live-found bug (an explicit `instructorId` on create was
  silently ignored — the admin ClassForm's instructor picker had zero effect), the
  schedule-conflict check actually firing on an overlapping session, free enrollment, and a
  sped-up reminder (a session ~14.5 minutes out lands inside `sendReminders()`'s real 1-minute
  cron window on the very next tick) producing a real in-app notification.
- `liveclass-subscription-lifecycle.integration.spec.ts` — Task 45's "second chain": a
  `PRIVATE`/`INVITE_ONLY`/`RECURRING` class's full subscription-driven access lifecycle —
  invite → accept → a real `POST /api/subscriptions` call → a real HMAC-signed simulated
  `charge.success` + `subscription.create` webhook round trip through the real RabbitMQ hop to
  live-class-service → `accessUntil` extends → cancelling leaves `accessUntil` untouched
  (access continues) → once `accessUntil` passes, room access is denied again, provable
  immediately via a direct request (no cron wait needed — `hasAccess()` re-checks live). Also
  found and fixed a real bug: `enroll()`/`acceptInvitation()` returned the raw Mongo
  enrollment document (`_id`) instead of the public shape (`id`) every other endpoint uses.
  What this file deliberately does *not* cover: a genuinely successful cancel against a real
  Paystack subscription — that needs a publicly-reachable webhook callback URL Paystack can
  deliver to, which this local stack doesn't have; see the file's own header comment.

`helpers.ts` has the shared plumbing every spec file uses: `login`/`api` (cookie-based auth
against the gateway), `registerAndLogin` (fresh throwaway student accounts),
`createPublishedCourse` (builds and publishes a real course via the real admin API, not a
DB seed), `deleteCourse` for cleanup, and `sendPaystackWebhook(event, data)` (Task 45 —
computes a real HMAC-SHA512 signature with `PAYSTACK_SECRET_KEY` and POSTs it to
`/api/payments/webhook`, the same route real Paystack deliveries hit). Test data this suite
creates cleans itself up in `afterAll` hooks — categories are the one exception (no delete
endpoint exists for them, so an existing category is reused rather than creating a new one
every run); live classes and their sessions similarly have no delete endpoint (by design —
same as courses' archive-not-delete convention) and accumulate as harmless leftover DRAFT/
ENDED rows across runs.

## Running it

Needs the full local stack up: `gateway-service`, `auth-service`, `course-service`,
`enrollment-service`, `payment-service`, `review-service`, `notification-service`,
`live-class-service` (see the root `README.md`'s "Running everything locally"), real Paystack
test-mode keys configured in `payment-service/.env`, plus a seeded `SUPER_ADMIN` account.
`notification-flow.integration.spec.ts` also needs a direct connection to Redis
(`REDIS_HOST`/`REDIS_PORT`, default `localhost:9010`, no auth) to read OTP codes the same way
`auth-service` itself does — they're never returned by any API response, only emailed.
`liveclass-subscription-lifecycle.integration.spec.ts` needs `PAYSTACK_SECRET_KEY` to match
whatever `payment-service` was actually started with (defaults to the same local dev test-mode
key `payment-service/.env` already ships with) — a mismatched key means every simulated
webhook 403s on signature verification instead of failing informatively.

**High/critical-priority announcement tests send real notification fan-out** — with
`EMAIL_PROVIDER=smtp` in `notification-service/.env` and a large accumulated pool of real test
student accounts (this environment has passed 150), a `high`/`critical` publish's real
sequential Gmail SMTP sends can exceed Jest's default 30s test timeout. Set
`EMAIL_PROVIDER=log` in `notification-service/.env` (and restart it) when running this suite
repeatedly against a shared dev stack — the `low`/`normal`-priority recipient-count-parity
test deliberately avoids this by never triggering email at all.

```bash
npm install
npm test
```

**Runs serially (`--runInBand`), deliberately** — this isn't a CI-speed optimization
choice, it's correctness: these tests hit a real shared stack with real DB connections and
real shared state (an admin session, a cached category id). Running spec files in Jest's
default parallel-worker mode caused real failures during development — concurrent logins
across 6 workers actually 500'd auth-service under contention, not a flaky-test artifact.

Override the target stack or accounts via env vars if your local setup differs from the
defaults:

```bash
GATEWAY_URL=http://localhost:9000 \
ADMIN_EMAIL=admin@grammarcetamol.com ADMIN_PASSWORD=ChangeMe123! \
STUDENT_EMAIL=checkout.tester@example.com STUDENT_PASSWORD=TestPass123! \
npm test
```

`STUDENT_EMAIL`/`STUDENT_PASSWORD` are only used by `auth-boundary.integration.spec.ts`
(it needs one already-existing STUDENT account); every other spec file registers its own
fresh throwaway student via `registerAndLogin`, so it never depends on your local seed data
being in any particular state.
