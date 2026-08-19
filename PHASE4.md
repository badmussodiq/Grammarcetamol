# Phase 4 Tracker — Live Classes & Notifications

**Purpose:** the single place Phase 4 status lives. `PLAN.md` (Tasks 38–45) still holds the
full implementation guidance for each task — that doesn't move — but this file is now the
one source of truth for *status*: what's done, what's in progress, what's blocked, and what
was found along the way. `PLAN.md`/`implementation-phases.md`/`todo.md` each carry a
one-line pointer back here instead of their own separately-maintained status prose, so the
three-way drift this project hit going into Task 37 (docs saying "in progress" for work that
had actually shipped weeks earlier) can't happen again for this phase.

**Update discipline:** when a task's status changes, edit the table below and add a dated
entry to the Update Log. Don't let a task's status go stale here the way it did in the old
docs — if you're not sure a status line is still accurate, verify against the code before
trusting it, same rule as everywhere else in this project.

**Full task specs:** `PLAN.md` Tasks 38–45 (implementation guidance, tests, demo criteria).
**User stories / acceptance criteria / exit criteria:** `implementation-phases.md` §Phase 4.

---

## Status at a glance

| #  | Task                                                                                              | Status                                          | Depends on                           |
|----|---------------------------------------------------------------------------------------------------|-------------------------------------------------|--------------------------------------|
| 38 | **Payment Service — Subscription Billing** (new, split out 2026-08-19)                            | ✅ Done (2026-08-19), live-verified              | Phase 3.5 (done)                     |
| 39 | Live Class Service — classes, sessions, enrollments, chat, scheduling, join-room                  | ✅ Done (2026-08-19), live-verified              | Task 38 (for RECURRING classes only) |
| 40 | Notification Service — in-app center, SSE, Announcements, class/session/subscription events       | ✅ Done (2026-08-19), live-verified              | Phase 3.5 Task 31 (done)             |
| 41 | Student frontend — live classes, classroom (chat + materials), join flow, subscription management | 🔲 Not started                                  | Task 39                              |
| 42 | Student frontend — notification center & preferences                                              | 🔲 Not started                                  | Task 40                              |
| 43 | Admin frontend — live class scheduler (FullCalendar), class/materials/chat management             | 🔲 Not started                                  | Task 39                              |
| 44 | Admin frontend — announcement manager                                                             | 🔲 Not started                                  | Task 40                              |
| 45 | Phase 4 integration & verification                                                                | 🔲 Not started                                  | Tasks 38–44                          |

Legend: 🔲 not started · 🟡 partially done / in progress · ✅ done · ⛔ blocked

**Renumbered 2026-08-19** (old → new): 38→39 (Live Class Service), 39→40 (Notification ext),
40→41 (student live classes), 41→42 (student notifications), 42→43 (admin scheduler), 43→44
(admin announcements), 44→45 (integration). New Task 38 (Subscription Billing) inserted ahead
of Live Class Service since group/private recurring classes depend on it existing first. Safe
to renumber now — nothing in Phase 4 has been built yet, so no code references the old numbers.

---

## What's already there (found during Task 37, 2026-08-19 — not built as Phase 4 work)

Before any Phase 4 task was started, a real head start already existed from earlier
Notification Service work (Task 31):

- **Backend** — `backend/notification-service/src/notifications/` is a complete, working
  in-app notification inbox: `GET /api/notifications`, `GET .../unread-count`,
  `PATCH .../read-all`, `PATCH .../{id}/read`, `DELETE .../{id}`. Real, gateway-routed
  (`/api/notifications/**`), auth-gated.
- **Frontend** — `apps/student/components/Navbar.tsx` has a real bell icon + unread-count
  badge; `apps/student/app/(main)/notifications/page.tsx` (103 lines) is a working
  `/notifications` page consuming the above.
- **The actual gap**: nothing populates the `notifications` collection.
  `NotificationConsumerService` only calls `sender.send()` (email) — it never writes an
  in-app notification document, so the inbox is real but permanently empty. No SSE endpoint
  either; the controller's own comment already flags this as "Phase 4/v2 work."

**What this changes about Tasks 40 and 42** (old 39/41, renumbered above): both are re-scoped
from "build the in-app center" to "wire the consumer to populate it, add SSE, add
preferences, add Announcements" (Task 40) and "build the polish — grouping, filters,
preferences UI — around an inbox that already lists/reads/deletes" (Task 42). Don't re-build
the list/read/delete plumbing from scratch. See `PLAN.md` Task 40's own status note for the
full detail.

---

## Domain Model — Classes, Sessions, Enrollments, Subscriptions

**Source:** a full domain/business-rule spec the user wrote out directly (2026-08-19),
superseding the lighter "Classroom" sketch this file originally had. This section is the
canonical reference other docs point to — don't re-derive or duplicate it elsewhere.

### The one rule everything else follows

**A class is not a live session.** A `Class` is the persistent container (chat, materials,
membership, billing config, lifecycle). A `LiveSession` is one scheduled occurrence inside
it. A single public workshop has exactly one session in its class. A recurring private
tutoring arrangement has *many* sessions in the same class over months. **A session ending
never means the class ended** — those are two independent lifecycles (see below).

### Entities

**`classes`** (`backend/live-class-service`, MongoDB — reuses Task 31's `DatabaseModule` shape)
| Field | Notes |
|---|---|
| `title`, `description`, `coverImageUrl` | |
| `classType` | `GROUP` \| `PRIVATE` — pedagogical shape (one:many vs one:one-or-few), independent of `accessMode` below |
| `accessMode` | `OPEN` (self-enroll, browsable) \| `INVITE_ONLY` (instructor/admin sends a specific invitation link to specific student(s)) — commonly `GROUP`+`OPEN` and `PRIVATE`+`INVITE_ONLY` pair together, but not hard-coupled (a small invite-only friend group is valid) |
| `instructorId` | the educator; conflict-checked against (see Scheduling below) |
| `paymentModel` | `FREE` \| `ONE_TIME` \| `RECURRING` — **recurring is not private-only**: a 50-student group class can bill monthly too, each student with their own independent subscription (§22 of the user's spec) |
| `defaultPrice`, `currency`, `billingInterval` | used as-is for `GROUP`; for `PRIVATE`, these are just the *default* — actual price can be overridden per-enrollment (negotiated) |
| `capacity` | nullable = unlimited; `PRIVATE` classes typically small/1 but not hard-locked to exactly 1 |
| `status` | class lifecycle: `DRAFT` → `PUBLISHED` → `ACTIVE` → `PAUSED`/`ENDED` → `ARCHIVED` |
| `chatLocked` | boolean, admin-toggled, default `true` — gates student POSTs to `class_chat_messages`, independent of any session being live |
| `materialsRetentionDays` | default 14 — see Retention & Archival below |
| `videoProvider` | `jitsi` today; pluggable, same registry pattern as `PaymentProvider`/`EmailProvider`/`StorageProvider` |
| `schedules[]` | embedded array: `{dayOfWeek, startTime, endTime, timezone, effectiveFrom, effectiveUntil}` — templates that generate `live_sessions` |
| `createdBy`, timestamps | |

**`live_sessions`**
| Field | Notes |
|---|---|
| `classId`, `startTime`, `endTime`, `timezone` | |
| `status` | session lifecycle: `SCHEDULED` → `LIVE` → `ENDED` \| `CANCELLED` — fully independent of the class's own status |
| `roomId` | **never included in any list/detail projection** — only the room-reveal endpoint returns it, same rule as the original Task 38 draft |
| `actualStartedAt`, `actualEndedAt`, `recordingUrl` | |
| `createdFrom` | `schedule` (auto-generated by the rolling-window cron below) \| `manual` (one-off, e.g. a single private session) |

**`enrollments`**
| Field | Notes |
|---|---|
| `classId`, `studentId` | unique index `{classId, studentId}` |
| `status` | `PENDING_PAYMENT` \| `ACTIVE` \| `PAUSED` \| `CANCELLED` \| `EXPIRED` \| `REMOVED` \| `COMPLETED` |
| `negotiatedPrice` | nullable override, used for `PRIVATE` classes with a teacher/parent-agreed price different from `defaultPrice` |
| `subscriptionId` | nullable, set only when `paymentModel = RECURRING` — foreign reference into `payment-service`'s `subscriptions` table (see below), not stored here |
| `paymentId` | nullable, set only when `paymentModel = ONE_TIME` |
| `accessUntil` | **the field that makes §24 of the user's spec work**: enrollment `status` and billing state are deliberately separate concepts. A student who cancels mid-cycle keeps `status = ACTIVE` with `accessUntil = <period end>` until that date, then a cron flips it to `EXPIRED`. Access checks always read `accessUntil`, never infer it from subscription status directly. |
| `enrolledAt`, `endedAt`, `endedReason` | |

**`class_materials`**
| Field | Notes |
|---|---|
| `classId`, `sessionId` | `sessionId` nullable — null means class-level (always visible per §17), set means session-specific (§19, lets late-joiners see what they missed) |
| `title`, `fileUrl`, `uploadedBy`, `visibleFrom` | reuses `upload-service`'s existing pattern for the actual file, same as lesson resources in `course-service` |

**`class_chat_messages`**
| Field | Notes |
|---|---|
| `classId`, `senderId`, `senderRole`, `body`, `createdAt` | own collection (potential volume), indexed `{classId, createdAt}`. Posting checks `classes.chatLocked` + the sender's `enrollments.status`/`accessUntil` — students always **read**, only **post** when unlocked |

**`subscriptions`** — **lives in `payment-service`'s existing Postgres `payment_db`, not live-class-service's Mongo.** Subscription billing is a payment-provider concern, same boundary as the existing one-time-payment flow; live-class-service only holds a `subscriptionId` reference and reacts to lifecycle *events* payment-service publishes (mirrors how `enrollment-service` already reacts to `payment.completed` for one-time course purchases — same established pattern, not a new one).
| Field | Notes |
|---|---|
| `userId`, `itemType`, `itemId` | generic — `itemType='live-class'`, `itemId=classId`, same `itemType`/`itemId` shape already needed for one-time paid-class registration |
| `paystackSubscriptionCode`, `paystackCustomerCode`, `planCode` | |
| `status` | **`PENDING`** (added during Task 38's real implementation, not in the original five-state list here — Paystack's initialize-with-plan flow is asynchronous, so a row legitimately exists before the `subscription.create` webhook confirms it's real, same async gap the `payments` table already bridges with its own `pending` status) → `ACTIVE` → (renewal charge fails) → `PAYMENT_FAILED` → (Paystack's own retries succeed) → back to `ACTIVE`, or (retries exhausted) → `PAST_DUE` (short grace window, 3 days) → `EXPIRED`. Separately, `ACTIVE` → (student cancels) → `CANCELLED` immediately, but **enrollment access doesn't end until `accessUntil`** — see above. |
| `amount`, `interval`, `currentPeriodEnd` | `currentPeriodEnd` is what `enrollments.accessUntil` gets set from on cancellation |

### Scheduling conflict detection

The **generated `live_sessions` collection is the single source of truth for conflict-checking** — not the `schedules[]` templates directly. When a schedule is created/edited, immediately generate a rolling window of upcoming sessions (e.g. next 8–12 weeks) from it; a cron extends the window forward over time. This avoids two separate conflict-detection code paths (one for templates, one for one-off sessions) — every check is just "does `instructorId` have another non-cancelled session whose `[startTime, endTime)` overlaps this one." Adjacent-but-not-overlapping (ends exactly when the next starts) is allowed; any real overlap is rejected with the conflicting session's own detail in the error, same shape as the original Task 38 draft's 409 response.

### Retention & archival — reconciling two things the user said

Worth flagging explicitly rather than silently picking one: an earlier message in this same
conversation described classrooms as fully **disposable** ("permanently removing them... after
that, classroom clear or deleted"). The detailed spec above says the opposite for the
underlying data — "should not be physically deleted," "generally be archived rather than
physically deleted" (§16, rule 20). Reading both together, the reconciliation is: **the
*data* is never hard-deleted; what expires is the student's *access/visibility* to it.**

- A class moving to `ENDED` starts a `materialsRetentionDays` (default 14) countdown on
  **student-facing access** — after it, enrollments tied to that class flip toward
  `EXPIRED`/`REMOVED` and stop appearing in the student's active class list.
- The `classes`/`live_sessions`/`class_materials`/`class_chat_messages`/`enrollments`/
  `subscriptions` records themselves move to `ARCHIVED`, never get deleted. Admin retains
  full historical visibility indefinitely (payment history especially must never disappear).
- If literal hard-deletion after the retention window really is wanted (not just access
  revocation), say so explicitly — as designed here it isn't, since it would conflict with
  "historical payments, enrollments, sessions, and class records should not be physically
  deleted" from the newer, more detailed spec.

### Class lifecycle vs. session lifecycle (independent)

```
Class:    DRAFT → PUBLISHED → ACTIVE → (PAUSED ⇄ ACTIVE) → ENDED → ARCHIVED
Session:  SCHEDULED → LIVE → ENDED
                    ↘ CANCELLED
```
A class stays `ACTIVE` while its sessions independently cycle through their own states —
Monday's session can be `ENDED`, Wednesday's `LIVE`, Friday's still `SCHEDULED`, all under one
`ACTIVE` class. Ending a session never touches the class's status; only an explicit admin
action (or the subscription-expiry path above) moves the class itself to `ENDED`.

### Join-button + chat gating (backend-enforced, not just UI)

The "Join Live Class" button is only actionable when **all** of: (1) caller has an
`enrollments` row for this class, (2) that enrollment's `status` is `ACTIVE` (or `PAUSED` within
grace) and `accessUntil` hasn't passed, (3) the target `live_sessions.status = LIVE`, (4) — for
`INVITE_ONLY` classes — the enrollment actually originated from an accepted invite. All four
are backend-checked on the room-reveal endpoint itself, per the user's explicit instruction
that the frontend must not be the only access-control layer. Chat posting is gated separately
on `classes.chatLocked`, independent of whether a session is currently live.

---

## Resolved scope decisions (do not revisit)

Carried from `PLAN.md`'s Phase 4 header — these were already settled with the user before
Task 38 was written:

1. **Email stays pluggable** — `EmailProvider` abstraction, not a hardcoded SendGrid/SES
   integration. (Note: this environment's local `.env` has `EMAIL_PROVIDER=smtp` pointing at
   a real Gmail account, so local dev already sends real email — see Phase 3.5 status notes.)
2. **Admin live-class scheduler builds the real calendar** (month/week/day, drag-to-reschedule,
   conflict detection) via **FullCalendar** — the first external UI library in this codebase,
   a deliberate exception to the "hand-roll everything visual" convention. Judged too
   large/bug-prone to hand-roll versus a well-maintained library that already covers this
   exact feature set.
3. **Video conferencing embeds Jitsi Meet's free public server** (`meet.jit.si`) via their
   IFrame API — room identifier only ever revealed to a verified registered student within
   the join window, and only via the backend-enforced room-reveal endpoint above, never as a
   visible link anywhere in the DOM/network tab. Not a self-hosted Jitsi + JWT auth server
   (explicitly declined as larger-scope than needed right now). Pluggable so Zoom/Loom/etc.
   can be added later as a new provider class + registry entry, zero call-site changes.
4. **Task 40 (old Task 39) is an extension, not a bootstrap** — Phase 3.5's Task 31 already
   built Notification Service; Phase 4 only adds SSE, the in-app center's missing write path,
   Announcements, and now the class/session/subscription notification events above.
5. **Recurring billing is not private-class-only** — group classes can bill recurring too,
   each enrolled student with their own independent subscription (one student cancelling
   doesn't affect the others or the class itself).

---

## Real risks flagged ahead of time (verify, don't assume)

- ~~**SSE through the gateway**~~ — **Resolved 2026-08-19, confirmed live.** `GET
  /api/notifications/stream` streams cleanly through Spring Cloud Gateway with no buffering:
  response headers show `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
  `X-Accel-Buffering: no`, chunked transfer-encoding, and a real event (published via an
  admin-fired announcement, and separately via a live-class session `start()`) arrived on an
  authenticated `curl -N` connection within ~2 seconds of being triggered. No polling fallback
  needed at the backend level; Task 42 can still build one client-side as defense-in-depth.
- ~~**Notification preferences enforcement**~~ — **Resolved 2026-08-19, confirmed live** —
  and a real bug was caught doing it. `NotificationSenderService.send()` does check
  `PreferencesService.isEnabled()` per channel before writing the in-app row / sending email
  (`system`-type notifications always bypass this, by design — disabling OTP/lockout emails
  would be a real lockout risk). But `PUT /api/notification-preferences` itself rejected any
  partial update (`{"announcement":{"inApp":false,"email":true}}` alone) with a 400 — the four
  `UpdatePreferencesDto` fields were validated as required despite being typed `?:` optional,
  because `@IsOptional()` was missing from each. Fixed in
  `backend/notification-service/src/preferences/dto/update-preferences.dto.ts`; added
  `test/preferences/update-preferences.dto.spec.ts` (3 new tests) to lock it in. Re-verified
  live end-to-end: disabled in-app announcement notifications for a test student, published a
  second announcement, confirmed no new in-app row was created for that student while the
  earlier one was still there — gating works correctly once the DTO bug was fixed.
- **Paid live-class registration** needs a new `itemType`/`itemId` pair added to
  `payment-service`'s initialize DTO (Task 39) — touches a service outside Live Class Service
  itself, worth sequencing early rather than discovering the coupling late.
- **Paystack subscription webhooks** (Task 38) — `subscription.create`, `subscription.disable`,
  `invoice.create`, `invoice.payment_failed`, `charge.success` (recurring) all need real
  end-to-end verification against Paystack's test mode, not just code review — subscription
  webhook payload shapes are a common source of "worked in my head, not against the real API"
  bugs. Budget real time for this in Task 38, same discipline as every other "verify against
  the real stack, not mocks" rule in this project.
- **Access-vs-billing divergence is the trickiest part of the whole model** — `enrollments.
  accessUntil` must be the *only* thing access checks read; if any code path checks
  `subscriptions.status` directly instead, a cancelled-but-still-paid-through student loses
  access early, silently contradicting §24 of the domain spec. Worth a dedicated test.

---

## Suggested order

Dependency-first, matching how every prior phase in this project was built:

1. **Task 38** (Payment Service — Subscription Billing) — `FREE`/`ONE_TIME` classes don't need
   it, but nothing `RECURRING` can be built or tested without it existing first.
2. **Task 39** (Live Class Service — classes/sessions/enrollments/chat/scheduling) — the core
   of this phase; nothing else can start for real without it.
3. **Task 40** (Notification Service extension) — can start in parallel with Task 39 once its
   event shapes are settled (Task 40 needs to bind a new `liveclass.exchange` routing key), or
   immediately given it's largely independent otherwise.
4. **Tasks 41 & 43** (student/admin live-class frontends) — depend on Task 39.
5. **Tasks 42 & 44** (student notification center polish / admin announcement manager) —
   depend on Task 40.
6. **Task 45** (integration & verification) — same discipline as Task 37: bring the real
   stack up, live-verify every chain including a real Paystack test-mode subscription
   create→charge→cancel round-trip, extend `backend/integration-tests` with
   `liveclass-notification-flow.integration.spec.ts`, update statuses here and in `PLAN.md`.

---

## Update Log

- **2026-08-19** — Tracker created. Phase 3.5 (Tasks 31–37) fully closed out immediately
  before this (see `PLAN.md`/`todo.md`). Found and recorded the Task 39/41 head start above
  while wrapping up Task 37 — nothing in Phase 4 itself has been started yet.
- **2026-08-19 (later same day)** — User supplied a full domain/business-rule spec for the
  live-class system (Class vs. Session, enrollment/subscription lifecycles, scheduling
  conflict rules, materials, retention). Added the full **Domain Model** section above as the
  canonical reference. Split the old Task 38 into a new Task 38 (Payment Service —
  Subscription Billing, since recurring billing turned out not to be private-class-only —
  group classes need independent per-student subscriptions too) and renumbered everything
  after it by one. Flagged one real tension between this conversation's two descriptions of
  what happens after a class ends (disposable/deleted vs. archived/retained) and resolved it
  as "access expires, data is archived, never hard-deleted" — see the Domain Model's
  Retention & Archival note; revisit if that reading is wrong.
- **2026-08-19 (Task 38 built)** — Payment Service Subscription Billing done and live-verified
  against the real Paystack test-mode API and a real running instance of the service (not just
  unit tests): arbitrary-amount Plan creation, initialize-with-plan, real HMAC-signed
  `charge.success`/`subscription.create` webhook simulation correctly activating and
  backfilling a subscription by exact `gateway_ref` match, and the cancel error path. Added a
  `PENDING` status not in the original Domain Model list (see the `subscriptions.status` row
  above) — a real, necessary adaptation to how Paystack's async subscription creation actually
  works, not a scope guess. 41/41 tests pass, `tsc --noEmit` clean. Full detail in `PLAN.md`
  Task 38's own status note. Next up: Task 39 (Live Class Service).
- **2026-08-19 (Task 39 built)** — Live Class Service done and live-verified against the real
  running stack: conflict detection (single + bulk recurring-generated sessions), the
  four-way room-authorization chain, chat lock/unlock/re-lock, capacity boundary, and a full
  `PRIVATE`/`INVITE_ONLY`/`RECURRING` round-trip including a real Paystack subscription,
  a real HMAC-signed webhook, and cross-service enrollment activation via RabbitMQ — all
  proven with real requests against real running services, not mocks. 33/33 unit tests pass.
  Found and fixed three real bugs during verification: a `roomId` leak in the manual
  session-creation response, a Postgres `UUID`-vs-Mongo-ObjectId type mismatch on `item_id`
  in `payment-service` (new `V4__item_id_as_string.sql` migration — a real, necessary
  correction to Task 38's own schema, not scope creep), and a missing idempotency check in
  `EnrollmentsService.createEnrollment` that the type-mismatch bug's retry exposed. Full
  detail in `PLAN.md` Task 39's own status note. Next up: Task 40 (Notification Service
  extension) or Tasks 41/43 (student/admin live-class frontends), both now unblocked.
- **2026-08-19 (Task 40 built)** — Notification Service extension done and live-verified
  against the real running stack (not just unit tests). Rather than teaching the consumer to
  understand raw `liveclass`/`subscription` domain events itself (PLAN.md's literal wording),
  reused the existing generic `<domain>.notification` pattern already proven by Task 31/38:
  `live-class-service` and `payment-service` both publish through their own
  `publishNotification()` helper onto `liveclass.exchange`/`subscription.exchange`
  (`payment-service` reuses the *existing* `payment.exchange` it already had), so only one new
  binding (`liveclass.notification`) was actually needed on the consumer side — a documented,
  deliberate deviation, not scope drift. Built: `PreferencesModule` (per-user in-app/email
  channel gating, `system`-type always bypasses it), `AnnouncementsModule` (full CRUD,
  audience resolution for `all`/`courses` via two new minimal internal endpoints —
  `GET /api/internal/users/students` on auth-service, `POST /api/enrollments/course-users` on
  enrollment-service — `segments` stays a documented no-op), SSE (`GET
  /api/notifications/stream` via RxJS `Subject`), 6 new email templates, and the
  `EnrolledStudentNotifier` shared fan-out helper in live-class-service wiring
  session-start/reminder/class-end into real notifications. Added gateway routes for
  `/api/announcements/**` and `/api/notification-preferences` (missing from the original
  Task 39 pass) — both fully authenticated by default, role-gated inside their own
  controllers, no `JwtAuthFilter` public/optional-auth entries needed.
  **Live-verified end-to-end against the real stack**, not just the 57/57 (notification-service)
  + 44/44 (payment-service) + 38/38 (live-class-service) passing unit tests: published a real
  `all`-targeted announcement and watched it fan out to a real activated test student
  (`auth-service.listActiveStudents()` → 5 real recipients); confirmed the SSE stream
  delivers a live event through the gateway with no buffering (see the resolved risk above);
  created/published/started a real live class + session end-to-end and watched the
  `live-class-starting` notification travel `live-class-service` → `liveclass.exchange` →
  `notification-service`'s consumer → in-app write → SSE push, all live, in the resolved-risks
  section above. **Found and fixed one real bug** during this pass: `UpdatePreferencesDto`
  rejected partial preference updates because `@IsOptional()` was missing on all four fields
  despite the code's own comment claiming partial updates were supported — see the resolved
  risk entry above for the fix and live re-verification. Next up: Tasks 41–44 (student/admin
  live-class + notification frontends) — none started yet, no explicit instruction received.
