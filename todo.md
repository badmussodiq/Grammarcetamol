# Grammarcetamol — Todo / Status Tracker

Quick-scan status. For full detail, decisions, and verification notes on any item, see `PLAN.md`
(task-by-task) and `implementation-phases.md` (phase-level). This file exists just to answer "what's
done, what's next, what's on hold" at a glance — update it as work lands rather than re-deriving it.

**Last updated:** 2026-08-05

---

## ✅ Done

### Phase 0 — Foundation
- Monorepo scaffold (`apps/`, `backend/`, no root npm project — deliberate, see memory)
- `apps/utilities` shared component/hook library
- `backend/gateway-service` — Spring Cloud Gateway, programmatic routes, JWT validation, rate limiting

### Phase 1 — Identity, Access & User Management
- `backend/auth-service` — register/verify/login/logout/refresh/forgot-password/reset-password, gRPC token validation, profile management, super admin seeding
- Both frontends' auth pages (login/register/forgot-password/reset-password/verify-email), `AuthContext`, cross-portal login rejection
- Google OAuth — **not done, see Suspended below**

### Phase 2 — Course Content & Discovery
- `backend/course-service` — categories, courses (draft/review/published/archived + versioning), modules, lessons, public catalog with search/filter/sort
- Student `/courses`, `/courses/[slug]`, landing hero
- Admin `/courses` (list/create/edit), per-course Overview/Edit/Content/Versions tabs
- Upload/Media services — **not done, see Suspended below**

### Phase 3 — Enrollment, Payments & Learning Loop
- **Task 19** — Extracted `backend/shared-java` (plain library, not auto-config; `course-service` migrated onto it)
- **Task 20** — `backend/enrollment-service`: free/paid enrollment, lesson progress, prerequisite gating, at-risk query
- **Task 21** — `backend/payment-service` (first NestJS service): Paystack checkout behind a pluggable `PaymentProvider`, refunds
- **Task 22** — `backend/review-service`: 50%-completion-gated reviews, 7-day edit window, moderation
- **Task 23** — Student checkout flow (`/checkout/[courseId]`, free-enroll CTA on course detail page)
- **Task 24** — Student `/dashboard` and `/my-courses`
- **Task 25** — Student learning interface (`/my-courses/[courseId]`) — live-verified full loop: enroll → watch → complete → review-eligible
- **Task 26** — Admin shell (`Sidebar`/`TopHeader`/`Breadcrumb`, with icons), `hasPermission` bug fixed, `DataTable`/chart primitives added to `apps/utilities`
- **Task 27** — Admin `/revenue` and `/transactions` (needed new `payment-service` read endpoints, built as part of this task)

All of the above is live-verified in the browser against the real running stack (not just unit tests) and committed on `phase2` — see `git log` for the per-task commits.

---

## 🔲 Pending (not started)

- **Task 28** — Admin review moderation: `/reviews` (filtered table, not Kanban — no Kanban spec exists for reviews), `/reviews/[id]` detail + moderate actions
- **Task 29** — Admin student directory: `/students` (filters), `/students/[id]` (Activity/Enrollments/Progress/Transactions tabs) — decide how much this reuses vs. duplicates the existing `/users` page
- **Task 30** — Phase 3 integration & verification pass: full loop end-to-end (paid checkout once currency is sorted, revenue reflecting a real transaction, review → moderation → public display), auth-boundary curl checks, final `PLAN.md`/`implementation-phases.md` status pass

Past Phase 3, nothing is planned yet — Phase 4/5 (live classes, service requests, notifications, analytics) aren't scoped.

---

## ⏸️ Suspended / deferred (deliberate, not forgotten)

| Item | Why | Revisit when |
|---|---|---|
| Google OAuth (Phase 1) | User hasn't set up a Google Cloud OAuth client yet | User has provider credentials |
| Upload Service / Media Service (Phase 2) | No object storage (MinIO/S3) or MongoDB provisioned; lessons use a plain admin-pasted `video_url` instead | Object storage gets provisioned in `docker/docker-compose.dev.yml` |
| Paystack NGN/USD mismatch (Task 21) | Test account only supports NGN; all seeded courses are priced in USD. User's actual plan is geo/currency-based course pricing — explicitly not to be solved by a quick fix | User specifies the geo/currency-pricing design (see memory: `project_multicurrency_deferred`) |
| Stripe / Flutterwave providers | Only Paystack is registered today | User asks to add another gateway — `PaymentProvider` interface already supports it as a new class + registry entry |
| `course-service.enrollment_count` / `avg_rating` / `review_count` never incremented | Cross-service denormalized counters that neither `enrollment-service` nor `review-service` write back to `course_db` yet — found live (course list still shows 0 students despite real enrollments) | Worth one combined follow-up, not two separate patches — likely a small internal endpoint on `course-service` or an event consumer there |
| `backend/shared-java` not adopted by `auth-service` | Different exception set, real JWT identity vs. header-trust — not real duplication, just same-shaped coincidence | Only if `auth-service`'s own exception/response handling genuinely converges with the others later |
| Review `review_votes` table (helpful/not-helpful) | Table exists in the migration, no JPA entity/controller — nothing reads/writes it yet | If "mark review helpful" becomes an actual feature |
| Editing a review doesn't reset it to `pending` | Not specified either way in the docs; kept simple rather than guessing at a re-moderation policy | If moderators flag this as a real gap in practice |
| `/my-courses/[courseId]` right pane (instructor bio, downloads, discussion, bookmarks) | No backing data/services for any of it (no discussion/comments system, no resource signed-URLs) | Those sub-systems get built |
| Live classes, service requests, notifications, analytics (Phase 4/5) | Not started, not yet planned in detail | After Phase 3 wraps (Task 30) |
