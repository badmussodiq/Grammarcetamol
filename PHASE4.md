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
| 41 | Student frontend — live classes, classroom (chat + materials), join flow, subscription management | ✅ Done (2026-08-19), live-verified              | Task 39                              |
| 42 | Student frontend — notification center & preferences                                              | ✅ Done (2026-08-19), live-verified              | Task 40                              |
| 43 | Admin frontend — live class scheduler (FullCalendar), class/materials/chat management             | ✅ Done (2026-08-20), live-verified              | Task 39                              |
| 44 | Admin frontend — announcement manager                                                             | ✅ Done (2026-08-20), live-verified              | Task 40                              |
| 45 | Phase 4 integration & verification                                                                | ✅ Done (2026-08-20), live-verified              | Tasks 38–44                          |

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

The **generated `live_sessions` collection is the single source of truth for conflict-checking** — not the `schedules[]` templates directly. When a schedule is created/edited, immediately generate a rolling window of upcoming sessions (e.g. next 8–12 weeks) from it; a cron extends the window forward over time. This avoids two separate conflict-detection code paths (one for templates, one for one-off sessions) — every check is just "does `instructorId` have another `SCHEDULED`/`LIVE` session whose `[startTime, endTime)` overlaps this one." Adjacent-but-not-overlapping (ends exactly when the next starts) is allowed; any real overlap is rejected with the conflicting session's own detail in the error, same shape as the original Task 38 draft's 409 response. **Both `CANCELLED` and `ENDED` sessions are excluded** — not just `CANCELLED` as originally written here (fixed 2026-08-19, see PHASE4.md's Update Log): `endTime` isn't updated when a session ends early, only `actualEndedAt` is, so a session ended 10 minutes into a scheduled 2-hour block would otherwise keep blocking new bookings against its original, now-vacated window indefinitely.

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
6. **Class chat uses real sockets, not polling** — overrides PLAN.md Task 41's original "No
   WebSocket in this task... polling is fine for chat" note. Explicit user direction
   (2026-08-19) during Task 41's build. Writes still go through the existing REST endpoint
   (`POST /api/classes/{id}/messages`) so `ChatService`'s validation/locking logic stays in one
   place; a new `ChatGateway` (Socket.IO, `backend/live-class-service/src/chat/chat.gateway.ts`)
   broadcasts the created message to everyone in that class's room. See Task 41's Update Log
   entry below for the full implementation and the routing details this required.

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
- **2026-08-19 (Task 40 — automated integration coverage added, one more real bug found)** —
  the manual `curl`-based verification above was real but not regression-proof: nothing kept
  it proven. Added `backend/integration-tests/liveclass-notification-flow.integration.spec.ts`
  (9 tests) following the project's established `*.integration.spec.ts`-against-the-real-stack
  pattern: the preferences partial-update regression, announcement fan-out + a real SSE capture
  (not just header inspection), preference-gating suppression, and a full live-class
  create→publish→enroll→session→start round-trip asserting the `live-class-starting`
  notification actually lands. **Found and fixed a second real bug** while writing it:
  `SessionsService.findConflict()` (`backend/live-class-service/src/sessions/sessions.service.ts`)
  only excluded `CANCELLED` sessions from conflict detection, not `ENDED` — matching this
  file's own Scheduling section as originally written, which turns out to have been wrong.
  Since `endTime` is never updated when a session ends early (only `actualEndedAt` is), an
  instructor who ends a session ahead of schedule stays "conflicted" against that session's
  original, now-vacated time window forever, blocking any new booking in it. Fixed to
  `status: { $in: ['SCHEDULED', 'LIVE'] }`; the Scheduling section above is corrected to match;
  added a unit test asserting the actual query sent to Mongo (`test/sessions/sessions.service.spec.ts`)
  since the bug is only observable in the query shape, not in a mock's return value. 39/39
  live-class-service tests, 57/57 notification-service tests, and — after the fix — 9/9 new +
  91/91 full `backend/integration-tests` suite all pass together against the real stack.
  **Also found (not a code bug):** the full integration suite's cumulative email volume this
  session (many real registrations/OTPs/announcements sent through Gmail SMTP across today's
  manual verification and automated tests) got Gmail's SMTP server to throttle and drop
  connections (`Unexpected socket close`), failing several pre-existing, unrelated
  `notification-flow.integration.spec.ts` assertions and one of this file's own SSE tests when
  run as part of the full suite — confirmed by re-running the same specs in isolation
  immediately after (still failing) versus after switching providers (all passing). Per the
  user's direction, `backend/notification-service/.env`'s `EMAIL_PROVIDER` is temporarily set
  to `log` instead of `smtp` (config-only change, `SMTP_*` credentials untouched) until Gmail's
  throttling cools down — revert that one line, not any code, when ready to send real email
  again.
- **2026-08-19 (Task 41 built)** — Student Frontend for live classes done and live-verified
  against the real running stack. `lib/classes.api.ts` (types + API client + pure helpers:
  `formatScheduleSummary`, `formatCapacity`, `formatClassPrice`, `resolveClassCardAction`),
  `hooks/useSessionLiveStatus.ts` (the shared "is a session live right now" polling hook — a
  pure `classifyRoomError()` maps the room-reveal endpoint's four denial-message strings to a
  state machine, since the shared `AllExceptionsFilter` doesn't serialize a machine-readable
  `reason` field, only `message`), `/live-classes` (Upcoming/Past/Mine tabs — "Upcoming" reads
  the class's own lifecycle `status` since the list endpoint has no session-date filtering),
  `/live-classes/invitations/[token]`, `/live-classes/[id]` (the classroom: session strip,
  chat, materials, Jitsi join via a bespoke full-bleed `VideoCallOverlay` rather than the
  shared `Modal` component, which isn't built for chrome-less full-bleed content), and a
  dashboard widget reusing the same live-status hook. Paid enrollment (`ONE_TIME`/`RECURRING`)
  redirects to the `authorizationUrl` the enroll endpoint already returns — Paystack's hosted
  checkout page, not the course flow's inline popup, since `enrollInClass`/`acceptInvitation`
  never return a `publicKey`/`amount`/`reference` triple to build a popup from.

  **Found and fixed three real backend bugs building this, all live-class-service/gateway
  issues no prior task's testing had exercised:**
  1. **No endpoint existed to list a student's own class enrollments at all.** `GET
     /api/classes?mine=true` filters by *instructor*, not student — genuinely a different
     feature. Added `EnrollmentsService.listMine()` + `GET /api/classes/enrollments/mine`
     (resolves each enrollment's class and soonest upcoming/live session in parallel).
  2. **A real gateway route collision, pre-existing since Task 39.** Adding that endpoint
     surfaced that `enrollment-service`'s `/api/enrollments/**` catch-all was registered before
     live-class-service's own `/api/enrollments/**`, so Spring Cloud Gateway's first-match
     routing silently swallowed everything live-class-service had there — including the
     already-shipped `DELETE /api/enrollments/{id}` cancel endpoint, which had likely never
     been reachable through the real gateway at all. Worse, the natural endpoint name
     (`GET /api/enrollments/mine`) collides with course-enrollment-service's own already-shipped
     endpoint of the same name — a genuine domain collision, not just an ordering bug. Fixed by
     nesting live-class-service's enrollment endpoints under `/api/classes/enrollments/**`
     (a prefix it already exclusively owns), verified with a new
     `backend/integration-tests/liveclass-enrollments.integration.spec.ts` (6 tests) proving
     both routes now resolve to the correct service and neither shadows the other.
  3. **No way to preview an invitation before accepting it**, despite PLAN.md's own spec
     calling for exactly that. Added `GET /api/invitations/:token` (public, no auth — a visitor
     must see the class/instructor/schedule/price before logging in — but deliberately never
     exposes the invited student's identity), classified as optionally-authenticated in
     `JwtAuthFilter` since `POST :token/accept` under the same prefix still needs a real
     session. Covered by the same integration spec above (3 more tests).

  **Then, mid-build, the user gave explicit new direction: class chat uses real sockets, not
  polling** (overriding PLAN.md's original "no WebSocket in this task" note — see Resolved
  Scope Decisions above). Added a Socket.IO `ChatGateway` to live-class-service (writes stay
  REST, the gateway only broadcasts), a new `ws://` gateway route for `/socket.io/**`
  (Spring Cloud Gateway needs a scheme-switched route for WebSocket proxying, distinct from the
  `http://` one — confirmed live that `JwtAuthFilter`'s injected `X-User-Id`/`X-User-Role`
  headers *do* survive the WS upgrade proxy, same as any other route), and a
  `useClassChat`/`socket.io-client` hook on the frontend replacing the polling `ChatPanel` had
  before. Building this surfaced a fourth real bug: `ChatService.post()` returned the *raw*
  Mongo document (`_id`, an ObjectId `classId`) instead of the same public shape `list()`
  already returns, so a freshly-posted message's `id` was silently `undefined` — caught via a
  real React "list should have a unique key prop" warning during live browser verification, not
  by any test. Fixed to call `toPublicMessage()` like `list()` does; added a regression test
  asserting the exact shape and that `broadcastMessage()` is called with it. Also live-verified
  and initially misdiagnosed as a bug: Socket.IO's "WebSocket is closed before the connection is
  established" console warning turned out to be React 19 Strict Mode's expected dev-mode
  double-invoke of `useEffect` (mount → cleanup → remount) discarding the first of two socket
  connections — confirmed benign by checking the server only ever logs one successful
  `handleConnection` per real page load, and by verifying an actually-sent chat message arrives
  correctly via the second (surviving) connection.

  44/44 live-class-service tests, 92/92 student-app tests, and `tsc --noEmit` clean across both
  pass. Live-verified end-to-end in a real browser against the real stack: enrolled free in a
  `GROUP` class, saw it on the dashboard widget, opened the classroom, read instructor messages
  while locked, posted after an admin unlocked chat — delivered live via the socket, not a
  manual page refresh — and separately accepted a real `PRIVATE`/`INVITE_ONLY` invitation
  end-to-end into its classroom. The live join-a-real-Jitsi-call portion of the demo criteria
  was not exercised (would need a session actually in its live window, not just built and
  code-reviewed) — flagged here rather than silently claimed as verified.
- **2026-08-19 (Task 42 built)** — Student Frontend Notification Center done and live-verified.
  Most of the plumbing already existed from Task 31 (list/mark-read/mark-all-read/delete, a bell
  link, a `/notifications` page) — this task closed the real gaps: a proper bell **dropdown**
  (previously just a bare link to `/notifications`, no inline preview) showing the latest 5 with
  live SSE updates and inline mark-read; `getPreferences`/`updatePreferences`/`subscribeToStream`
  added to `lib/notifications.api.ts`; a `subscribeToStream()` wrapper around the Task 40 SSE
  endpoint with a real polling fallback after repeated reconnect failures; a `resolveNotificationRoute()`
  pure helper (shared by the bell and the `/notifications` page, so the two can't drift on what
  clicking a given type means) that deep-links `live_class` notifications into that class's
  classroom and `payment` ones into their transaction; a missing `Live Class` filter tab and
  infinite-scroll pagination added to `/notifications`; and a new **Notifications tab** on
  `/profile` (per-type × per-channel checkboxes, partial updates, persists across reload).

  **Found and fixed one real bug that blocked the whole deep-linking requirement**:
  `NotificationSenderService.send()` — the single funnel almost every notification in this
  system goes through — hardcoded `relatedId: null` unconditionally, so PLAN.md's explicit
  "a live-class notification deep-links straight into that class's classroom" requirement was
  silently unbuildable no matter what the frontend did. Worse, this wasn't Task 42-only: it also
  broke deep-linking for high/critical-priority announcements specifically (the low/normal
  branch, which bypasses the sender entirely, already set `relatedId` correctly — the two
  branches had quietly drifted). Fixed by adding an optional `relatedId` to the
  `NotificationRequestedEvent` envelope, threading it through `NotificationSenderService.send()`,
  both `LiveClassEventPublisher.publishNotification()` and the `EnrolledStudentNotifier` call
  site (now passes the real `classId`), and the announcement service's high-priority branch (now
  passes the real `announcementId`, matching what the low/normal branch already did). Added a
  dedicated `EnrolledStudentNotifier` unit test file (none existed before, despite it being
  shared by `SessionsService`/`ClassesService` since Task 40) plus regression tests in both
  `notification-sender.service.spec.ts` and `announcements.service.spec.ts`.

  60/60 notification-service tests (was 57), 47/47 live-class-service tests (was 44), 101/101
  student-app tests (was 92), `tsc --noEmit` clean across all three. Live-verified end-to-end
  against the real stack, not just unit tests: triggered a real live-class-starting notification
  and a real high-priority announcement, confirmed both carried the correct `relatedId` via the
  real API, then confirmed clicking each in both the bell dropdown and the `/notifications` page
  navigated to the right place in the real browser. Also live-verified the preferences tab:
  toggled a channel off, reloaded the page fresh, confirmed it stayed off (real persistence, not
  just optimistic local state) — and incidentally re-discovered, live, that Task 40's own
  preference-gating fan-out test data (`announcement.inApp: false` set on the shared test
  account during Task 40's own verification) was still in effect, which is exactly the kind of
  cross-task state leakage worth calling out rather than silently working around.

- **2026-08-20 (Task 43 built)** — Admin Frontend Live Class Scheduler & Class Management done
  and live-verified. `lib/classes.api.ts` (separate admin-facing client, not shared with the
  student app — needs `schedules[]` templates and conflict data the student client omits), a
  `Calendar` adapter in `apps/utilities` wrapping FullCalendar (`@fullcalendar/react` +
  `daygrid`/`timegrid`/`interaction` — **first external UI library in this codebase**, a
  pre-approved deliberate exception to the "hand-roll everything visual" convention, agreed with
  the user), `/live-classes` (List/Calendar toggle, filters), `/live-classes/create`, and
  `/live-classes/[id]` with all six tabs (Overview, Edit, Sessions, Materials, Chat,
  Enrollments) plus a seventh Invitations tab shown only for `INVITE_ONLY` classes. `ClassForm`
  is shared between create and edit via a `mode` prop that disables the five fields
  `UpdateClassDto` doesn't actually accept (`classType`/`accessMode`/`paymentModel`/
  `instructorId`/`videoProvider`) with explanatory helper text, rather than silently letting an
  edit of those fields do nothing on save.

  **Scope decision, not a gap**: materials use a plain `fileUrl` text input (matching the
  existing `coverImageUrl`/`avatarUrl` precedent), not the chunked-upload flow — the existing
  `uploadsApi.createSession()` is hardcoded to a `courseId` field validated against
  course-service, and reusing it for live-class materials would need a genuine upload-service
  backend change out of scope for this task.

  **Found and fixed one real bug, live**: the admin edit form's real-time conflict check
  (`GET /api/instructors/{id}/availability`, called on every schedule-row change) had no way to
  exclude the class actually being edited from its own busy-period lookup — so editing *any*
  class with an active recurring schedule always flagged a self-conflict against its own
  already-generated sessions and permanently disabled Save. Caught live opening the Edit tab on
  a real class (`Saturday Revision`), not by any unit test, since the existing test suite only
  ever exercised the conflict check with a class that had no schedule yet. Fixed by adding an
  optional `excludeClassId` query param to `GET /api/instructors/{id}/availability`
  (`InstructorsController` → `SessionsService.getInstructorAvailability()`, filters
  `classId: { $ne: ... }` in the Mongo query), threading it through the admin `classesApi` and
  `ClassForm`'s new `classId` prop (passed only from `EditTab`, so create-mode behavior is
  unchanged). Two regression tests added to `sessions.service.spec.ts`.

  61/61 live-class-service tests (was 59), 66/66 admin-app tests (unchanged — the fix didn't
  touch anything under test), `tsc --noEmit` clean on both. Live-verified end-to-end against the
  real running stack (backend Node services restarted to pick up the fix, admin dev server on
  :3001): logged in as the seeded super-admin, exercised list/calendar views against real
  pre-existing test data, opened `Saturday Revision`'s Edit tab and confirmed the self-conflict
  bug live before and after the fix, edited and saved its description, posted an admin chat
  message and toggled chat lock/unlock, added a class-level material, confirmed the Enrollments
  tab lists a real enrolled student, and on `Private English Tutoring` (an existing
  `INVITE_ONLY` class) searched a real student by email and sent a negotiated-price invitation
  that appeared correctly in the Invitations list. Created a brand-new recurring `GROUP` class
  end-to-end (draft → publish), confirmed its weekly Monday occurrences appeared correctly
  positioned and color-coded on the calendar; dragged one occurrence to a genuinely free slot and
  confirmed the move persisted across a reload with the other occurrence unaffected; dragged
  another occurrence onto a slot that now conflicted with the first and confirmed it reverted in
  place with an inline error surfacing the real backend conflict detail. Not exercised live: the
  Zoom/Google Meet platform options (both intentionally disabled, nothing backs them yet) and
  actually joining a live Jitsi room from the admin side (out of this task's scope — join-flow
  was Task 41's).

- **2026-08-20 (Task 44 built)** — Admin Frontend Announcement Manager done and live-verified.
  `lib/announcements.api.ts` against Task 40's `AnnouncementsController`; `/announcements` (status
  filter — the only one actually backed server-side; date/author/target filters from PLAN.md's
  own text were never implemented since nothing in `AnnouncementsController` accepts them, same
  "never accept a config that silently does nothing" principle as Task 43's platform selector and
  segments-targeting option), a hand-rolled checkbox-column + "Delete Selected" bulk-delete (no
  reusable component existed to copy — `DataTable` has no selection support and no other admin
  page has row-selection, confirmed by a dedicated Explore pass before building; PLAN.md's "same
  scope-down as Task 26" reference turned out to be about design philosophy, not an existing
  pattern to mirror), `/announcements/create` (also handles `?duplicate=<id>` — refetches the
  source announcement and pre-fills a fresh draft, resetting schedule/expiry rather than copying
  them), and `/announcements/[id]` (single page, no tabs — the form doubles as a read-only view
  via a `canEditAnnouncement(status)` guard that disables all 10 fields and hides the submit
  button once a draft is scheduled/published/expired, mirroring `AnnouncementsService.update()`'s
  own server-side guard so a rejected PATCH is never the first sign something changed).

  The publish-confirmation-with-real-recipient-count requirement (`GET
  .../recipient-count` needs an existing announcement id, so it can't run before anything is
  saved) is resolved as: submitting the form with "Publish Now"/"Schedule for later" always saves
  a draft first, then opens a shared `PublishConfirmModal` that fetches the real count and only
  calls the actually-irreversible `publish()` on explicit confirmation — same component reused by
  the detail page's own "Publish"/"Schedule" button for a draft saved earlier without publishing.

  No real bug found this task, unlike 41/42/43 — `AnnouncementsController`/`AnnouncementsService`
  already had every endpoint the frontend needed (`recipient-count`, `send-test`, the
  draft-only-editable guard, the scheduled/published cron sweeps) fully working from Task 40,
  including the cron itself, so this was a pure frontend build against a solid, unchanged backend.

  83/83 admin-app tests (was 66; +17: `formatTargetAudience`, `validateAnnouncementForm`,
  `toAnnouncementRequestBody`, `canEditAnnouncement`, `PRIORITY_BADGE_VARIANT`/
  `STATUS_BADGE_VARIANT`, `announcementToFormValues`), `tsc --noEmit` clean. Live-verified
  end-to-end against the real running stack: created a `high`-priority "All Students" announcement,
  confirmed the modal showed the real recipient count (38, the actual active-student count),
  confirmed it, and confirmed the status flipped to `published` with a real "Sent to 38 recipients"
  timestamp (this one took longer than an instant check to reflect — 38 real sequential SMTP sends
  via Gmail is not instant, worth noting as a fan-out-latency characteristic for high volumes, not
  a bug — a `normal`-priority in-app-only publish to the same 38 updated within ~3s). Verified
  `Send Test` (real 201 to the caller's own email), `Delete` and bulk "Delete Selected", a
  `Specific Courses` announcement targeting a real course (list correctly showed "Specific Courses
  (1)"), `Duplicate` (pre-filled title/body/targeting from the source, fresh draft state), and the
  scheduled-for-later → cron auto-publish path end-to-end: scheduled an announcement ~90s out,
  confirmed status showed `scheduled` with editing disabled, watched the real
  `AnnouncementsService.sweepScheduled()` cron fire and flip it to `published` in the actual
  service log with no manual action taken — the exact PLAN.md demo criterion. Also confirmed the
  read-only guard at the DOM level on an existing published announcement (10/10 fields genuinely
  `disabled`, no submit button rendered), not just visually implied.

- **2026-08-20 (Task 45 built)** — Phase 4 Integration & Verification done. All three chains
  live-verified end-to-end against the real running stack (both frontends, all backend
  services), plus 67 new automated tests (56 integration across two new spec files and
  extensions to two existing ones, 11 unit) closing gaps individual-task verification had left.

  **Chain 1 (free GROUP class)** — `backend/integration-tests/liveclass-full-chain.integration.spec.ts`
  (new): admin creates a recurring-eligible `GROUP`/`OPEN`/`FREE` class, the schedule-conflict
  check is proven to actually fire on a genuinely overlapping session (409, not silently
  double-booked), a student free-enrolls and sees it via `GET .../enrollments/mine`, and a
  sped-up reminder (a session ~14.5 minutes out — inside `sendReminders()`'s real 1-minute cron
  window on the very next tick, not a real 15-minute wait) produces a real in-app notification.
  Live-browser-verified beyond what the integration test covers: created the same shape of
  class through the real admin UI, scheduled a session via the real Sessions tab, then confirmed
  it appeared **on the student dashboard's Live Classes widget within one page load** — the
  actual cross-frontend wiring Tasks 41/43 each verified their own half of but never verified
  together — and that `/live-classes/[id]` on the student side correctly showed "Not Live Yet"
  (the room-reveal endpoint's real `too-early` denial, not a stub) and "Chat is locked by the
  instructor" for the freshly-created class.

  **Chain 2 (private, subscription)** — `backend/integration-tests/liveclass-subscription-lifecycle.integration.spec.ts`
  (new, 8 tests): the full invite → accept → real `POST /api/subscriptions` → real
  HMAC-SHA512-signed simulated `charge.success` + `subscription.create` webhooks (via a new
  `sendPaystackWebhook()` helper in `helpers.ts`) → real RabbitMQ hop into live-class-service →
  `accessUntil` extends → cancel leaves `accessUntil` untouched (access continues) → once
  `accessUntil` passes, room access is denied again, proven **immediately via a direct request**
  rather than waiting on `expireLapsedEnrollments`' hourly cron (`hasAccess()` re-checks
  `accessUntil` live on every call — the `status` field lags behind until the cron catches up,
  proven separately and instantly via a new direct unit test rather than a real hour-long wait).
  This closes the exact gap `SubscriptionsService.handleWebhookEvent`'s own doc comment named
  Task 45 as responsible for: "neither [the first-activation nor renewal path] has been
  exercised against a real webhook delivery yet." **Not exercised, a real external sandbox
  constraint**: a genuinely successful cancel against a real Paystack subscription — Paystack's
  own cancel API needs a subscription that actually exists on their side, which needs a
  completed hosted checkout, which needs a publicly-reachable webhook callback URL for Paystack
  to deliver to; this local stack has none. Task 38/39's own status notes already reached the
  same conclusion for the same reason. The *error* path (cancel against a fabricated
  subscription code, correctly rejected cleanly rather than crashing) is exercised instead.

  **Chain 3 (announcement fan-out)** — added the one assertion the existing Task 40 coverage was
  missing: a new test in `liveclass-notification-flow.integration.spec.ts` confirms the
  pre-publish `GET .../recipient-count` estimate exactly equals `publish()`'s own resolved
  `recipientCount` (both call the same `resolveRecipients()`, so this proves they haven't
  drifted apart) — PLAN.md's own "the recipient-count estimate matches the actual fan-out count"
  demo criterion, not previously asserted directly (the existing tests only checked
  `recipientCount >= 1`).

  **Auth-boundary sweep** — `auth-boundary.integration.spec.ts` grew from 24 to 65 checks,
  adding every admin-gated endpoint on live-class-service (Task 43's whole admin scheduler
  surface — class/session/material/invitation/enrollment CRUD) and notification-service's
  announcements (Task 44) — neither had ever been swept before this task. All passed on the
  first real run; no boundary gaps found. Chat lock/unlock (the PLAN.md-specified
  lock→403→unlock→succeeds→lock→403-again sequence) and the room-reveal endpoint's full
  four-way authorization (`not-enrolled`/`too-early`/`session-ended`/`invite-not-accepted`) were
  confirmed already exhaustively unit-tested in `chat.service.spec.ts`/`sessions.service.spec.ts`
  rather than duplicated here.

  **Three real bugs found and fixed, all via live exploration before writing any test** (not
  reported by the user — found by directly probing the system the way an admin/student
  genuinely would):
  1. **`instructorId` silently ignored on class creation.** `ClassesController.create()` always
     passed `user.id` as the instructor, never reading anything from the request body —
     confirmed live by creating a class with a different real user's id explicitly set and
     watching the stored `instructorId` come back as the caller's own id instead. This meant the
     admin `ClassForm`'s "Instructor" picker had **zero effect** on class creation the whole
     time Task 43 was live — invisible during that task's own verification because only one
     `SUPER_ADMIN` account existed in the seed data, so picking "the only option" always looked
     correct by coincidence. Fixed by adding an optional, `@IsUUID()`-validated `instructorId` to
     `CreateClassDto` and using `dto.instructorId ?? user.id` in the controller — same
     "audit-trail field, not a foreign key" trust model as every other cross-service id in this
     system (no live lookup against auth-service to confirm the id is really an admin/moderator).
  2. **`enroll()`/`acceptInvitation()` leaked the raw Mongo document.** Both returned
     `{enrollment: <raw EnrollmentDocument>, authorizationUrl}` instead of running it through
     `toPublicEnrollment()` like every other list/get endpoint in this service — confirmed live,
     the response's `enrollment` object had `_id` (a bare ObjectId-shaped string, no `id` field
     at all) with `classId` still an unconverted ObjectId. Same bug class as Task 41's chat-message
     bug and Task 43's own invitation bug — a recurring pattern in this codebase worth naming: a
     freshly-inserted Mongo doc returned directly instead of through its `toPublicX()` helper.
     Fixed by changing `EnrollResult.enrollment`'s type to `ReturnType<typeof toPublicEnrollment>`
     and wrapping all four return sites inside `createEnrollment()`.
  3. **The admin form's conflict-hint endpoint diverged from the real booking check.**
     `GET /api/instructors/:id/availability`'s own doc comment claims "same conflict-detection
     logic [as] when actually booking" — but its filter was `status: { $ne: 'CANCELLED' }` while
     the real `findConflict()` used by actual booking is `status: { $in: ['SCHEDULED', 'LIVE'] }`
     (fixed for booking back in Task 40's own "both CANCELLED and ENDED excluded" fix, which this
     sibling endpoint never received). Found live while cleaning up leftover test sessions: an
     already-`ENDED` session kept showing up as a "busy" conflict in the availability check,
     which the admin `ClassForm` uses to disable Save — a false-positive capable of blocking a
     legitimate schedule change over a slot that was actually free. Fixed by matching
     `findConflict`'s exact filter.

  Also flipped `notification-service/.env`'s `EMAIL_PROVIDER` back to `log` (was `smtp`,
  reverted from Task 40's original fix at some point outside this session) — this environment
  has accumulated 150 real test student accounts, and a `high`/`critical`-priority announcement
  publish's real sequential Gmail SMTP sends were routinely exceeding Jest's 30s test timeout
  (and re-risking the exact Gmail throttling the original `log` switch was meant to prevent).

  **Final counts**: `enrollments.service.spec.ts` (live-class-service) 33/33 (was 23, +10 for
  the four billing-event consumer handlers and `expireLapsedEnrollments`), `sessions.service.spec.ts`
  +1 regression test for the availability-filter fix, live-class-service full suite 72/72,
  `backend/integration-tests` 153/153 across all 11 spec files, `tsc --noEmit` clean. Two
  pre-existing integration tests (in `liveclass-notification-flow.integration.spec.ts`) also had
  their own near-term session-time collision risk fixed while investigating unrelated 409s during
  this task's own test runs — a real, repeatedly-observed flakiness source from every spec file
  in this suite sharing one `SUPER_ADMIN` instructor account, now using the same randomized
  far-future offset this task's own new files established.
