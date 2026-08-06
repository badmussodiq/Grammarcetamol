# payment-service

Node.js / NestJS (the first NestJS service in this repo). Phase 3 (`PLAN.md` Task 21). Owns checkout,
payment-provider integration, and refunds. Reachable through the gateway at `/api/payments/**`, or
directly on `:8086` in dev.

## Conventions established here (first NestJS service, no precedent to copy)

- **No ORM.** A thin `pg` (`node-postgres`) `Pool` (`src/config/database.module.ts`) plus a hand-rolled
  migration runner (`src/config/migration-runner.ts`) that applies `db/migration/V*.sql` files in
  filename order, tracked in a `schema_migrations` table — the same versioned-SQL-file convention as
  every Java service's Flyway migrations, without pulling in a Java-less ORM dependency.
- **Header-trust identity**, same shape as the Java services' `CurrentUser` (`src/common/current-user.decorator.ts`)
  — reads `X-User-Id`/`X-User-Role` directly, no JWT parsing here either.
- **Response envelope** — `src/common/api-response.ts` + `src/common/all-exceptions.filter.ts` reproduce
  the same `{success, data, error, timestamp}` shape as `shared-java`'s `ApiResponse`/`GlobalExceptionHandler`,
  so the frontends' `apiFetch` doesn't need a payment-service-specific special case. Nest's own
  `HttpException` subclasses (`BadRequestException`, `ForbiddenException`, `NotFoundException`, ...)
  already carry the right status code; the global filter only reshapes the body.
- **RabbitMQ** via `amqplib` directly (not `@nestjs/microservices`, which is a heavier full-transport
  abstraction this service doesn't need — it only ever publishes, never consumes). Same
  `TopicExchange` + `<domain>.<event>` routing-key convention as the Java services'
  `RabbitMQConfig`/`EventPublisher` pairs.

## Payment provider abstraction

`src/providers/payment-provider.interface.ts` defines `initialize`/`verify`/`verifyWebhookSignature`.
`PaystackProvider` is the only implementation today, selected via `PAYMENT_GATEWAY` env var through
`PaymentProviderRegistry` (a plain `Map<string, PaymentProvider>`). Adding `StripeProvider`/
`FlutterwaveProvider` later is a new class implementing the interface plus one line in the registry's
constructor — `PaymentsService` never changes. `payments.gateway`/`gateway_ref`/`gateway_response` are
already gateway-agnostic columns, matching `database-schema-and-migrations.md`'s intent.

## Checkout flow

1. `POST /api/payments/initialize` — validates the course is published and actually paid (`price > 0`,
   else 400 pointing at direct enrollment instead), calls the active provider's `initialize` **first**
   (an earlier version wrote the `pending` row before calling the provider; a failed provider call left
   an orphaned row with no error info — found during this task's own live verification against a real
   Paystack test account, see "Known gotcha" below), then writes one `payments` row with the real
   `gateway_ref`/`gateway_response` already attached. Returns `{reference, accessCode, publicKey}` for
   the frontend to open Paystack's Inline Popup.
2. Frontend's popup `onSuccess` calls `POST /api/payments/{reference}/confirm`, which re-verifies
   server-side against Paystack (never trusts the client callback alone) and transitions the payment.
3. Paystack's server-to-server webhook (`POST /api/payments/webhook`, HMAC-SHA512 signature check via
   `x-paystack-signature`) independently re-verifies and transitions the same payment. Both paths
   converge on the same idempotent `markCompleted`/`markFailed` methods (`UPDATE ... WHERE status <>
   'completed'`, checking `rowCount` to detect the race) — whichever arrives first wins, the second is
   a no-op, confirmed by this task's own tests and a live signature-verified webhook call.
4. `enrollment-service` (Task 20) consumes the resulting `payment.completed` event to create the
   enrollment — this service has no enrollment logic of its own.

## Known gotcha found during live verification

The Paystack **test account these dev keys belong to only supports NGN** — `POST .../initialize` with
`currency: "USD"` (every seeded course's currency) fails with `unsupported_currency`. Confirmed this is
a Paystack account-configuration matter, not a code bug, by calling Paystack's API directly with the
same credentials and an NGN amount (succeeded) vs. USD (same `unsupported_currency` error as through
this service). Not fixed here — needs a decision: enable more currencies on the Paystack dashboard (may
need business verification even in test mode), or price test courses in NGN. `initialize()` correctly
propagates whatever currency the course record carries; nothing to change in this service's code either
way.

## How to run locally

1. Start infrastructure (see root README's WSL2 Docker note if applicable).
2. `payment_db` must exist — same situation as `course_db`/`enrollment_db`; on an existing volume:
   ```bash
   docker exec -it grammarcetamol-postgres psql -U platform -d auth_db -c "CREATE DATABASE payment_db;"
   ```
3. `cp .env.example .env` and fill in real Paystack test-mode keys (never commit `.env` — already
   covered by `backend/**/.env` in the root `.gitignore`).
4. `npm install`
5. `npm run start:dev` (or `npm run build && npm run start:prod`)

Unlike the Java services, this one's plain Node HTTP server wasn't affected by the Windows
loopback-socket issue documented for `auth-service`/`course-service`/`enrollment-service` — it bound
and served requests cleanly on the first automated run in this environment.

## Endpoints

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/payments/initialize` | any authenticated user | body `{courseId, email?}`; 400 if free or unpublished |
| `POST /api/payments/{reference}/confirm` | any authenticated user | idempotent |
| `POST /api/payments/webhook` | none (self-authenticates via HMAC signature) | public at the gateway — see `JwtAuthFilter.PUBLIC_ROUTES` |
| `POST /api/payments/{id}/refund` | SUPER_ADMIN only | body `{amount, reason}`; 400 if it exceeds the remaining refundable balance |

## Events

Publishes to `payment.exchange`: `payment.intent.created`, `payment.completed`, `payment.failed`,
`refund.requested`, `refund.completed`. Consumes nothing (invoice generation, the original spec's
reason to consume `enrollment.created`, is out of scope for this task alongside skipping the `invoices`
table entirely).

## Config

See `.env.example` for the full list. Notable: `PAYMENT_GATEWAY` (which provider is active),
`PAYSTACK_PUBLIC_KEY`/`PAYSTACK_SECRET_KEY` (test-mode keys, gitignored `.env` only).

`GET /actuator/health` is exposed (matching the Java services' convention, not Nest's usual `/health`).

## Tests

`npm test` (Jest) — 16 unit tests in `test/` (mirroring `src/`, not co-located with it — see the
root `README.md`'s "Running everything locally"): `PaystackProvider`'s webhook signature
verification (valid/wrong-secret/tampered-body/missing-header), `PaymentsService`'s idempotent
confirm/webhook convergence (already-completed short-circuits before calling the provider at all;
a DB-level race-guard miss re-fetches instead of double-publishing), refund balance validation,
the free/unpublished-course rejections, and `RevenueService`'s bucket-label formatting. No unit
test hits a real Postgres/Paystack — that's covered instead by `backend/integration-tests`'
`payment-flow.integration.spec.ts` (real Paystack test-mode calls) plus this service's own live
verification pass (documented above and in `PLAN.md`'s Task 21 status note).
