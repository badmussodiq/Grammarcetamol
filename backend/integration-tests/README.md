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

## What's here (59 tests across 6 files)

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
  `enrollment-service`, `payment-service`, and `review-service`: a request with no token
  gets `401`, a request from a real logged-in STUDENT gets `403` on anything
  admin/moderator/SUPER_ADMIN-only, with a same-endpoint `200` sanity check using a real
  SUPER_ADMIN token alongside each `403`.

`helpers.ts` has the shared plumbing every spec file uses: `login`/`api` (cookie-based auth
against the gateway), `registerAndLogin` (fresh throwaway student accounts),
`createPublishedCourse` (builds and publishes a real course via the real admin API, not a
DB seed), and `deleteCourse` for cleanup. Test data this suite creates cleans itself up in
`afterAll` hooks — categories are the one exception (no delete endpoint exists for them, so
an existing category is reused rather than creating a new one every run).

## Running it

Needs the full local stack up: `gateway-service`, `auth-service`, `course-service`,
`enrollment-service`, `payment-service`, `review-service` (see the root `README.md`'s
"Running everything locally"), real Paystack test-mode keys configured in
`payment-service/.env`, plus a seeded `SUPER_ADMIN` account.

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
GATEWAY_URL=http://localhost:8080 \
ADMIN_EMAIL=admin@grammarcetamol.com ADMIN_PASSWORD=ChangeMe123! \
STUDENT_EMAIL=checkout.tester@example.com STUDENT_PASSWORD=TestPass123! \
npm test
```

`STUDENT_EMAIL`/`STUDENT_PASSWORD` are only used by `auth-boundary.integration.spec.ts`
(it needs one already-existing STUDENT account); every other spec file registers its own
fresh throwaway student via `registerAndLogin`, so it never depends on your local seed data
being in any particular state.
