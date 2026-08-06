# integration-tests

Cross-service integration tests that hit the **real running stack** through the gateway —
not mocks, not a single service in isolation. It's a sibling project rather than living
inside `payment-service`/`enrollment-service`/`review-service` because it doesn't belong to
any one of them; it tests the boundary *between* them (the gateway's JWT validation plus
each service's own role check).

Compare with `backend/upload-service/e2e/upload-flow.e2e.ts`, which hits the real stack the
same way but is a one-off console script for a single service's happy-path flow. This
project uses real Jest `describe`/`it`/`expect` so failures show up as normal test
failures, and it's meant to grow — more cross-service checks belong here, not as more
one-off scripts.

## What's here

- `auth-boundary.integration.spec.ts` — for every write/admin-gated endpoint on
  `enrollment-service`, `payment-service`, and `review-service`: confirms a request with no
  token gets `401`, and a request from a real logged-in STUDENT gets `403` on anything
  admin/moderator/SUPER_ADMIN-only. A same-endpoint `200` check with a real SUPER_ADMIN
  token is included alongside each `403` as a sanity check — it proves the negative check
  is actually meaningful (the route works, it's just correctly rejecting the wrong caller),
  not that the route is broken for everyone.

## Running it

Needs the full local stack up: `gateway-service`, `auth-service`, `enrollment-service`,
`payment-service`, `review-service` (see the root `README.md`'s "Running everything
locally"), plus a seeded `SUPER_ADMIN` and one ordinary `STUDENT` account.

```bash
npm install
npm test
```

Override the target stack or accounts via env vars if your local seed data differs from
the defaults (`admin@grammarcetamol.com` / a `STUDENT` test account):

```bash
GATEWAY_URL=http://localhost:8080 \
ADMIN_EMAIL=admin@grammarcetamol.com ADMIN_PASSWORD=ChangeMe123! \
STUDENT_EMAIL=checkout.tester@example.com STUDENT_PASSWORD=TestPass123! \
npm test
```

Every check targets a syntactically valid but nonexistent UUID — these are auth-boundary
checks, not business-logic checks, so the request should never reach the point where the
target resource's existence matters.
