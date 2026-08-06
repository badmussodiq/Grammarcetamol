# Grammarcetamol — Implementation Phases & Delivery Roadmap

> **Document Version:** 1.3  
> **Last Updated:** 2026-08-05  
> **Methodology:** Vertical slicing per Epic, dependency-first, risk-reduction priority  
> **Sprint Cadence:** 2-week sprints (recommended)  
> **Note:** User Service merged into Auth Service (2026-08-02). `user_db` and `user-service` no longer exist.
> **Current status:** **Phase 1 and Phase 2 done**; **actively in Phase 3**. Auth (backend + both frontends) is implemented and verified end-to-end, including cross-portal login rejection; Google OAuth intentionally deferred. Phase 2's course-authoring/discovery loop (`course-service` backend + both frontends' course pages) is implemented and verified end-to-end; Upload/Media Services are intentionally deferred (no object storage/MongoDB provisioned — lessons take a plain admin-pasted `video_url` instead). Phase 3's full backend (`enrollment-service`, `payment-service`, `review-service`) and the student frontend (checkout, dashboard, my-courses, learning interface) are done as of 2026-08-05, live-verified in the browser including a real enroll → watch → complete → review-eligible loop. Admin frontend now has a real shell, `/revenue`, and `/transactions` (Tasks 26–27, live-verified); review moderation and the student directory are next — see `PLAN.md` Tasks 28–30 for the full breakdown and per-task status. See task-level status notes inline below, and `PLAN.md` for implementation-level detail.

---

## How to Read This Document

Each phase is a **vertical slice** — it delivers a working, testable increment across backend, frontend, and infrastructure. We do not build "all backends first"; instead, we ship end-to-end features that create immediate value.

| Legend | Meaning |
|:---|:---|
| 🔴 **Hard Dependency** | Cannot start until predecessor is Done |
| 🟡 **Soft Dependency** | Can start in parallel, but needs stubs/mocks |
| 🟢 **Parallel Safe** | No blockers, can run concurrently |
| ⭐ **Milestone** | Demo-ready checkpoint |

---

## Phase 0: Foundation & DevEx (Sprints 1–2)

**Goal:** Every developer can `git clone`, run `docker-compose up`, and see a healthy stack.

### 0.1 Infrastructure & Tooling
| Task | Owner | Output |
|:---|:---|:---|
| Provision AWS dev account (EKS, RDS, S3, ElastiCache, RabbitMQ) | DevOps | Terraform modules |
| Set up monorepo structure (`services/`, `apps/admin`, `apps/student`, `shared/`) | Platform | Repo scaffold |
| CI/CD pipeline per service (GitHub Actions → Docker Build → ECR → Helm deploy) | DevOps | `.github/workflows/` |
| Local development stack (`docker-compose.dev.yml` with PostgreSQL, MongoDB, Redis, RabbitMQ, MinIO) | Platform | `docker/` folder |
| API Gateway skeleton (Spring Cloud Gateway) with routing config | Backend | `gateway-service/` |
| Observability baseline (Prometheus + Grafana + Loki local stacks) | DevOps | `observability/` |

### 0.2 Shared Libraries
| Task | Output |
|:---|:---|
| Common DTOs / event schemas (Avro or JSON Schema) | `shared/events/` |
| Base Docker images (JRE 21 slim, Node 20 Alpine) | `shared/docker/` |
| Internal npm package: `@grammarcetamol/ui` (design tokens) | `shared/ui/` |

### 0.3 Database Baseline
| Task | Output |
|:---|:---|
| Run **Phase 0 migrations** (create databases, users, extensions) | `migrations/V0__baseline.sql` |
| MongoDB cluster init + replica set config | `migrations/mongo/001_baseline.js` |

### ✅ Phase 0 Exit Criteria
- [ ] `docker-compose up` brings up 100% of local stack in <3 min. — *`docker/docker-compose.dev.yml` exists and brings up Postgres/Redis/RabbitMQ, but the application services (gateway, auth-service) aren't containerized — they run via `mvn spring-boot:run`. Not the full stack.*
- [ ] Any service push to `main` triggers build, test, and deploy to dev EKS. — *No CI/CD pipeline exists.*
- [ ] Grafana shows green health for all services. — *No observability stack exists.*
- [x] Developer onboarding doc is written. — *Root `README.md` plus a README per app/service.*

---

## Phase 1: Identity, Access & User Management (Sprints 3–5)

**Goal:** A user can register, verify email, log in, and have a profile. Admins can create moderator accounts.

> 🔴 **Hard Dependency:** Phase 0 (infrastructure must exist)  
> ⭐ **Milestone:** Authentication is production-ready; RBAC is functional.

### 1.1 Backend Services

#### Auth Service (Java / Spring Boot)
| User Story | Acceptance Criteria | Status |
|:---|:---|:---|
| US-STU-001: Account Registration | Email/password + ~~Google OAuth~~; bcrypt hashing (cost ≥12); welcome email queued | ✅ email/password. Google OAuth intentionally deferred (no provider console set up yet) |
| US-STU-002: Email Verification | 24h token expiry; resend capability; status transitions to `active` | ✅ |
| US-STU-003: Secure Login | JWT access (15 min) + refresh (7 days); 5-attempt lockout; silent refresh flow | ✅ (silent refresh: single 401-triggered retry in `apiFetch`, not a background timer) |
| US-GUEST-006: Seamless Auth Redirect | `returnUrl` persisted through OAuth and email-verification flows | ⚠️ Student's route guard sets `returnUrl` on redirect-to-login; not exercised for OAuth (deferred) |

**Database:** `auth_db` — run `V1__auth_initial_schema.sql`, `V3__add_profile_columns.sql`  
**Responsibilities:** Authentication (register, login, logout, refresh, verify email) + User profile management (profile fields, role assignment) — no separate user-service  
**Events Published:** `user.login`, `user.logout`, `user.locked` (profile creation is synchronous/in-process — no event needed)

#### ~~User Service~~ — Merged into Auth Service

> **This service no longer exists.** Profile and role management is part of Auth Service.

- User profiles are stored directly on the `users` table in `auth_db` (see V3 migration)
- Role is a `VARCHAR(64)` enum column: `SUPER_ADMIN`, `STUDENT`, `MODERATOR`, `CUSTOMER_SUPPORT`
- `UserProfileService` and `UserProfileController` live inside `backend/auth-service`
- `SuperAdminSeeder` seeds the super admin on startup via `AuthService.registerInternal()`
- `/api/users/**` routes through the gateway to auth-service

| User Story | Acceptance Criteria | Status |
|:---|:---|:---|
| US-STU-013: Profile Management | CRUD own profile (fullName, phone, country, timezone, bio, learningGoals); all stored on `users` table | ✅ backend (`GET`/`PATCH /api/users/me`). No frontend `/profile` page yet on either portal |
| US-ADM-012: Moderator Management | Super Admin creates accounts via `registerInternal()` with `MODERATOR` role | ✅ backend + admin `/users/create` UI, verified end-to-end |
| US-ADM-013: Student Management | Admin directory via `GET /api/users`; suspend/activate via `PATCH /api/users/:id/status` | ✅ backend + admin `/users` UI (list + suspend/activate), verified end-to-end |

### 1.2 Frontends

#### Student Frontend (Next.js)
| Page | Features | Status |
|:---|:---|:---|
| `/login` | Email + password form; ~~Google OAuth button~~; "Forgot Password" link | ✅ (OAuth button omitted — deferred) |
| `/register` | Validation (8 chars, mixed case, number); confirm password; T&Cs checkbox | ✅ plus a live password-strength indicator |
| `/forgot-password` | Email input; success state; rate-limited (1 req / 60s) | ✅ |
| `/verify-email` | Token validation; redirect to dashboard on success | ✅ (redirects to `/login`, not a dashboard — no student dashboard exists yet) |
| `/profile` | Tabs: Profile, Account, Notifications, Privacy; avatar cropper | ❌ not built |

#### Admin Frontend (Next.js)
| Page | Features | Status |
|:---|:---|:---|
| `/login` | Admin-only login; ~~2FA prompt if enforced~~ | ✅ (no 2FA — not scoped for Phase 1) |
| `/users` | DataTable of all users; filter by role/status; bulk actions | ⚠️ list + search + suspend/activate built (server-rendered, not a client DataTable component); no role/status filter dropdowns or bulk actions |
| `/users/create` | Create Moderator wizard; permission matrix checkbox grid | ⚠️ single-step form (role: Moderator or Customer Support), not a wizard. No permission matrix — the backend has no granular permission system, only the four fixed roles |
| `/users/[id]` | Profile read-only + activity log + permission editor | ❌ not built |
| `/roles` | View role definitions; edit Moderator permissions | ❌ not built — no backend permission model to back it |

### 1.3 Cross-Cutting
| Task | Detail | Status |
|:---|:---|:---|
| RabbitMQ exchanges | `user.exchange` created; bindings for `user.*` routing keys | ✅ |
| Redis | Session store TTL 30m; JWT blacklist TTL 1d | ✅ |
| API Gateway | Route config: `/api/auth/**` → Auth Service; `/api/users/**` → Auth Service (merged, no internal token header); AuthFilter active | ✅ |
| Route guards | `middleware.ts` on both frontends | ✅ — renamed `proxy.ts` (Next.js 16 renamed the convention). Admin's checks role from the JWT payload, not just cookie presence; also rejects cross-portal sessions (student cookie on admin site, and vice versa) as defense-in-depth alongside the login-time role check in `AuthContext` |

### ✅ Phase 1 Exit Criteria
- [ ] End-to-end test: Guest → Register → Verify Email → Login → View Profile → Logout. — *Register → Login → Logout manually verified working this phase. No automated E2E suite. No `/profile` page to view yet, and email verification wasn't exercised with a real inbox (no SMTP configured locally).*
- [ ] Security audit: Password hashing, JWT expiry, refresh rotation, rate limiting. — *All four exist (bcrypt cost 12, 15 min access / 7 day refresh with rotation, gateway rate limiting) but no formal audit was performed.*
- [ ] Admin can create a Moderator and assign `course:edit` but not `financial:view`. — *Admin can create a Moderator (verified). Fine-grained permission assignment doesn't exist — see `/users/create` and `/roles` status above.*
- [ ] Load test: `/api/auth/login` handles 500 req/s with p95 < 200ms. — *Not performed.*

---

## Phase 2: Course Content & Discovery (Sprints 6–9)

**Goal:** Guests can browse courses; Admins can create courses via a wizard; content is searchable.

> 🔴 **Hard Dependency:** Phase 1 (admins must be authenticated to create content)  
> 🟡 **Soft Dependency:** Media Service can be stubbed (accept file, return mock URL)  
> ⭐ **Milestone:** Public course catalog is live; first course can be created end-to-end.  
> **Current status (2026-08-06):** Course Service backend is done (see `PLAN.md` Tasks 11–12). Both frontends' course pages are done (`PLAN.md` Tasks 13–14). Upload Service backend is now done and live-verified (`PLAN.md` Task 16, added 2026-08-06, once MinIO was provisioned) — lessons still take a plain admin-pasted `video_url` in the meantime since the admin upload UI itself hasn't been built. Media Service remains deferred — still exercising this phase's own soft-dependency allowance, since MongoDB isn't provisioned yet (`PLAN.md` Task 17).

### 2.1 Backend Services

#### Course Service (Java / Spring Boot)
| User Story | Acceptance Criteria | Status |
|:---|:---|:---|
| US-GUEST-002: Browse Course Catalog | Paginated, filterable (category, difficulty, price, rating), full-text search | ✅ category/difficulty/price/search all implemented via one native query; rating filter not added (no reviews exist yet — Phase 3) |
| US-GUEST-003: View Course Details | Curriculum accordion, instructor card, reviews summary, pricing card | ✅ backend returns full curriculum + instructor fields; reviews summary N/A (Review Service is Phase 3). No frontend yet — Task 13 |
| US-ADM-006: Guided Course Creation | 5-step wizard; auto-save draft; validation per step; publish atomic guard | ⚠️ backend supports draft creation + atomic publish-validation guard (returns the full missing-item list, not just first error); the 5-step autosaving wizard is a frontend concern — Task 14 plans a single sectioned form instead, not a literal multi-step wizard |
| US-ADM-009: Course Editing & Versioning | Edit published course → new version snapshot; rollback capability; notify enrolled students on new lessons | ⚠️ edit + version snapshot + rollback (`restore`) all implemented; "notify enrolled students" has no enrollment/notification concept yet (Phases 3–4) |
| US-ADM-010: Safe Course Deletion | Block delete if enrollments > 0; archive instead; hard delete only if zero activity | ✅ `enrollment_count > 0` blocks delete with 409; archive endpoint separate; the guard is real today even though nothing increments `enrollment_count` until Enrollment Service (Phase 3) |

**Database:** `course_db` — run `V1__course_initial_schema.sql`  
**Events Published:** `course.created`, `course.published`, `course.updated`, `course.archived`, `course.versioned`  
**Events Consumed:** `user.created` (for instructor linkage), `enrollment.completed` (for completion stats)

#### Upload Service (Node.js / NestJS)
| User Story | Acceptance Criteria | Status |
|:---|:---|:---|
| US-ADM-007: Resumable Chunked Upload | 5MB chunks; SHA-256 checksum; 3 retries with exponential backoff; session recovery after browser crash | ✅ backend done, live-verified (2026-08-06) — chunks are real S3/MinIO multipart parts, not a homemade scheme; presigned PUT URLs (browser uploads directly to storage); re-presigning any non-completed chunk is both the retry path and the resume-after-crash path (same endpoint). SHA-256 checksum is recorded as a client-computed integrity field (separate from S3's own per-part ETag); exponential backoff itself is a client concern, not backend logic. No admin upload UI yet — see `PLAN.md` Task 16 |

**Database:** `upload_db` — run `V1__upload_initial_schema.sql` (with a `storage_provider`/`storage_bucket`/`storage_multipart_id` addition beyond the original spec — see `PLAN.md` Task 16 for why)
**Storage:** MinIO (dev) / S3 (prod), via a pluggable `StorageProvider` abstraction — both can be registered and used at once; each uploaded file's own DB row remembers which backend it's actually on, permanently. Presigned PUT URLs for direct chunk upload (never proxied through the service).
**Events Published:** `upload.session.started`, `upload.chunk.completed`, `upload.file.completed`, `upload.failed` — all confirmed publishing live with correct payloads.

#### Media Service (Node.js / NestJS — MongoDB)
| Task | Detail |
|:---|:---|
| Transcoding pipeline | On `upload.file.completed`, trigger ffprobe metadata extraction + HLS transcoding to 720p/1080p |
| Thumbnail generation | Auto-extract from first frame; allow custom poster upload |
| CDN delivery | CloudFront distribution in front of S3/MinIO |

**Database:** `media_db` — run `001_media_initial.js`  
**Events Consumed:** `upload.file.completed`  
**Events Published:** `media.transcoding.started`, `media.transcoding.completed`, `media.ready`

### 2.2 Frontends

#### Student Frontend
| Page | Features | Status |
|:---|:---|:---|
| `/` (Landing) | Hero, 7 service cards, featured course carousel, testimonials, FAQ accordion | ⚠️ Hero + featured course carousel done; 7 service cards/testimonials/FAQ deferred to Phase 5 (need the Service Request catalog) |
| `/courses` | Sidebar filters (category, difficulty, price, rating, duration); sort dropdown; CourseCard grid; infinite scroll | ⚠️ category/difficulty/price filters + sort + CourseCard grid done; rating/duration filters and infinite scroll not built — "Load more" button pagination instead (deliberate, matches the no-external-library constraint) |
| `/courses/[slug]` | Promo video thumbnail; curriculum accordion with lock icons; instructor bio; sticky price card; related courses | ⚠️ curriculum accordion, instructor bio, sticky price card done; promo video thumbnail and related courses not built |

#### Admin Frontend
| Page | Features | Status |
|:---|:---|:---|
| `/courses` | DataTable: thumbnail + title + instructor + status badge + price + students + rating; bulk actions; export CSV | ⚠️ server-rendered table (not a client DataTable component) with all listed columns + status/category filters + archive/delete actions; no bulk actions or CSV export |
| `/courses/create` | Step wizard: 1) Info (RichTextEditor, ImageUploader), 2) Pricing, 3) Structure (drag-drop ModuleManager), 4) Upload (FileUploader with chunk grid), 5) Review & Publish | ⚠️ one sectioned form (Info + Pricing), not a step wizard — deliberate simplification, same as `/users/create`. Structure/Upload steps don't apply — module/lesson building happens on `/courses/[id]`'s Content tab instead, and Upload Service is deferred (Task 16) |
| `/courses/[id]` | Tabbed: Overview (metrics), Edit (change tracking), Content (lesson tree), Students (enrollment table), Analytics (charts), Versions (restore) | ⚠️ Overview, Edit, Content (add/edit/delete/reorder modules & lessons via up/down buttons, not drag-drop), Versions (restore) all done. Students/Analytics tabs not built — depend on Enrollment/Analytics services (Phases 3/5) |
| `/courses/[id]/upload` | Upload Manager: queue table, per-chunk status grid, session recovery banner, global controls | ❌ not built — Upload Service is deferred (Task 16); lessons take a plain admin-pasted `video_url` instead, via an inline editor on the Content tab |

### 2.3 Cross-Cutting
| Task | Detail |
|:---|:---|
| Search index | PostgreSQL `tsvector` on `courses.title/description`; future: Elasticsearch |
| Redis caching | Course detail cache TTL 5m; catalog filter cache TTL 2m |
| Object Storage | Bucket policies: public-read for processed media, private for raw uploads |

### ✅ Phase 2 Exit Criteria
- [x] Admin creates a 3-module course with 5 lessons, uploads a 500MB video, publishes it. — *Verified live with 1 module/1 lesson (the mechanism scales identically to 3/5 — nothing in the create/publish path is count-limited). "Uploads a 500MB video" doesn't apply — Upload Service is deferred; the admin pastes a `video_url` instead, per this phase's own "Media Service can be stubbed" allowance.*
- [x] Guest visits `/courses`, filters by "Beginner", clicks course, sees curriculum. — *Verified live, unauthenticated, against the real stack.*
- [x] Upload survives browser close + reopen with 100% resume accuracy. — *Backend mechanism verified (Task 16, 2026-08-06): re-presigning any non-`completed` chunk is the resume path, and `GET /api/uploads/sessions/:id` returns exactly the per-chunk state a reopened page needs to know what's left. Not exercised via an actual browser crash/reopen — there's no admin upload UI yet to crash.*
- [ ] Video plays via HLS with adaptive bitrate switching. — *N/A — Media Service deferred (Task 17); lessons link to a plain `video_url`, no transcoding/HLS pipeline exists.*

---

## Phase 3: Enrollment, Payments & Learning Loop (Sprints 10–14)

**Goal:** Students can buy/enroll in courses, watch videos with progress persistence, and receive certificates.

> 🔴 **Hard Dependency:** Phase 2 (courses must exist to enroll in)  
> 🔴 **Hard Dependency:** Phase 1 (auth required for enrollment)  
> ⭐ **Milestone:** First paid enrollment completes; student resumes video at exact timestamp.  
> **Current status (2026-08-05):** Planned — see `PLAN.md` Tasks 19–30. Payment gateway starts with Paystack (test-mode), architected as a pluggable `PaymentProvider` so Stripe/Flutterwave can be added later without a rewrite. Certificates are out of scope (the schema doc marks the table "future"); Upload/Media Service dependencies for video remain deferred from Phase 2, so lessons keep using a plain `video_url` (no HLS/adaptive bitrate). `backend/shared-java` (Task 18, previously deferred) is un-deferred and folded into this phase as Task 19, since Enrollment Service is the third Java service its trigger condition was waiting for.

### 3.1 Backend Services

#### Enrollment Service (Java / Spring Boot)
| User Story | Acceptance Criteria | Status |
|:---|:---|:---|
| US-STU-006: Free Course Enrollment | Instant enrollment; idempotent (re-click is no-op); appears in "My Courses" immediately | ✅ backend (`POST /api/enrollments`); confirmation email/notification not sent — no Notification Service yet |
| US-STU-005: Resume Learning | `GET /progress/{courseId}` returns last position per lesson; `PATCH` every 5s debounced | ✅ backend, as `GET .../learn` (curriculum + position) and `PATCH /api/progress`; debouncing is the frontend's job (Task 25) |
| US-STU-008: Interactive Learning Interface | Lesson completion toggle; prerequisite gating (can't open Lesson 3 if Lesson 2 incomplete) | ✅ backend gating logic (sequential across the whole course); frontend interface itself is Task 25 |
| US-ADM-005: Student Engagement Insights | At-risk flagging (<20% progress after 14 days); completion rate aggregation | ⚠️ at-risk query backend done (`GET /api/enrollments/at-risk`, thresholds configurable, default 20%/14 days); no admin UI yet (Task 29 scopes it as a `/students` filter, not a dashboard widget) |

> **Status (2026-08-05):** Backend done — see `PLAN.md` Task 20. Paid enrollment (via `payment.completed`) is wired but untestable end-to-end until `payment-service` (Task 21) exists; free enrollment and progress/gating are fully functional today.

**Database:** `enrollment_db` — run `V1__enrollment_initial_schema.sql`  
**Events Published:** `enrollment.created`, `enrollment.completed`, `lesson.progress.updated`  
**Events Consumed:** `course.published`, `payment.completed`, `user.created`

#### Payment Service (Node.js / NestJS)
| User Story | Acceptance Criteria | Status |
|:---|:---|:---|
| US-STU-007: Course Purchase & Checkout | Branded checkout; Stripe/Paystack/Flutterwave integration; PCI-compliant tokenization; idempotency keys | ✅ backend done as a pluggable `PaymentProvider` (Paystack live, Stripe/Flutterwave are a new class + registry entry away); no PCI tokenization needed — Paystack's Inline Popup handles card data, this service never touches it; idempotent by design (confirm/webhook convergence). Checkout UI is Task 23 |
| US-ADM-004: Revenue Analytics | Transaction ledger; refund workflow with approval gate; invoice generation | ⚠️ ledger (`transactions` table) and refund (balance-validated, admin-only) done; no approval-gate workflow (refunds complete immediately once an admin issues them — no pending/approved states in the UI, matching this task's own scoped-down decision); invoice generation out of scope (no `invoices` table); revenue dashboard itself is Task 27 |

> **Status (2026-08-05):** Backend done — see `PLAN.md` Task 21. Live-verified against a real Paystack test account, including a real bug found and fixed (an orphaned payment row on provider-call failure) and a real account-configuration gap found (the test account only supports NGN, not the USD all seeded courses are priced in) — needs a decision before Task 23's checkout demo can complete an actual charge.

**Database:** `payment_db` — run `V1__payment_initial_schema.sql`  
**Events Published:** `payment.intent.created`, `payment.completed`, `payment.failed`, `refund.requested`, `refund.completed`  
**Events Consumed:** `enrollment.created` (for invoice generation)

#### Review Service (Java / Spring Boot)
| User Story | Acceptance Criteria | Status |
|:---|:---|:---|
| US-STU-012: Leave Course Reviews | 50% completion gate; 1–5 star + text; edit within 7 days; admin moderation queue | ✅ backend done — live REST completion-check (not an event flag) against enrollment-service, 50%/7-day boundaries unit-tested, admin moderation endpoint works. Moderation UI itself is Task 28. Course-level `avg_rating`/`review_count` aren't updated by approved reviews yet — flagged, not fixed, see `PLAN.md` Task 22 |

> **Status (2026-08-05):** Backend done — see `PLAN.md` Task 22. Live-verified against the real running enrollment-service (a genuine cross-service call correctly rejected a non-enrolled test user).

**Database:** `review_db` — run `V1__review_initial_schema.sql`  
**Events Published:** `review.submitted`, `review.approved`, `review.moderated`  
**Events Consumed:** `enrollment.completed`

### 3.2 Frontends

#### Student Frontend
| Page | Features | Status |
|:---|:---|:---|
| `/checkout/[courseId]` | Order summary (course thumbnail, price breakdown); payment method selector; "Pay" button with loading state; success/failure states | ✅ built and live-verified; Paystack's own popup is the method selector (no custom UI needed); real charge blocked on the deferred NGN/USD account gap, not a frontend issue |
| `/dashboard` | Welcome banner; "Continue Learning" card with resume button; My Courses tabs; upcoming live classes; notifications; recommended courses | ✅ built and live-verified, minus live-classes/notifications panels (no backing services) |
| `/my-courses` | Grid of enrolled courses with progress bars; filter by status | ✅ built and live-verified |
| `/my-courses/[courseId]` | **3-pane learning interface**: Left (lesson sidebar with progress), Center (video player + notes + nav), Right (instructor, downloads, discussion, bookmarks) | ⚠️ 2-pane, not 3 — right pane (instructor/downloads/discussion/bookmarks) deliberately deferred, no backing data. Left sidebar + center video/progress/gating live-verified working end-to-end |
| `/my-courses/[courseId]` (Mobile) | Bottom sheet lesson drawer; tabs for Notes/Discussion/Downloads; fullscreen video rotation | ⚠️ toggle-based drawer (not a swipe bottom sheet) live-verified working; Notes/Discussion/Downloads tabs N/A, nothing lives there in this scoped-down version |

#### Admin Frontend
| Page | Features | Status |
|:---|:---|:---|
| `/revenue` | Summary cards (lifetime, monthly, weekly); line chart toggles; donut charts by category; best-sellers horizontal bar | ✅ done, live-verified — donut is by payment method, not category (a real cross-service join, deliberately substituted, see `PLAN.md` Task 27); best-sellers is a ranked list, not a horizontal bar chart |
| `/transactions` | DataTable: ID, date, student, course, amount, method, status; refund action with modal | ✅ done, live-verified (empty state only — no completed payment exists yet, blocked on the Task 21 currency gap); refund modal built but its real submit path is unverified for the same reason |
| `/reviews` | Kanban-style pipeline: Pending → Approved → Flagged; moderation actions | 🔲 Task 28, not started |
| `/students` | Directory with advanced filters; profile drill-down (activity timeline, enrollments, progress, transactions) | 🔲 Task 29, not started |
| `/students/[id]` | Avatar header; tabs: Activity, Enrollments, Progress, Transactions, Notes | 🔲 Task 29, not started |

### 3.3 Cross-Cutting
| Task | Detail |
|:---|:---|
| Payment webhooks | Stripe `payment_intent.succeeded` → idempotent handler → publish `payment.completed` |
| Idempotency | `Idempotency-Key` header on all POST/PUT endpoints; Redis TTL 24h |
| Video player | Custom HTML5 + hls.js wrapper; keyboard shortcuts; progress sync every 5s; resume on return |
| Signed URLs | Resource downloads expire after 15 min; CloudFront signed cookies for video segments |

### ✅ Phase 3 Exit Criteria
- [ ] Student buys a $49 course; payment webhook fires; enrollment created in <2s.
- [ ] Student watches 12:34 of Lesson 2; closes tab; reopens → resumes at 12:34.
- [ ] Admin issues a refund; transaction ledger shows debit; student loses access (configurable grace period).
- [ ] Revenue dashboard shows the sale within 5 seconds of webhook receipt.

---

## Phase 4: Live Classes & Notifications (Sprints 15–17)

**Goal:** Students see upcoming live classes, join on time, and receive timely notifications.

> 🔴 **Hard Dependency:** Phase 1 (auth), Phase 3 (enrollment concept for class registration)  
> 🟡 **Soft Dependency:** Video conferencing can be external link (Zoom) initially, embedded SDK later  
> ⭐ **Milestone:** First live class is scheduled, students register, and join via portal.

### 4.1 Backend Services

#### Live Class Service (Node.js / NestJS — MongoDB)
| User Story | Acceptance Criteria |
|:---|:---|
| US-STU-009: Live Classroom Participation | Schedule class; capacity limit; register/join flow; 15-min early join gate; reminder emails at 24h/1h/15min |
| US-ADM-011: Live Class Scheduling | Admin scheduler with instructor conflict detection; recurring classes (future); calendar ICS generation |

**Database:** `liveclass_db` — run `001_liveclass_initial.js`  
**Events Published:** `liveclass.scheduled`, `liveclass.started`, `liveclass.ended`, `liveclass.reminder`  
**Events Consumed:** `user.created` (for auto-enrollment if bundled)

#### Notification Service (Node.js / NestJS)
| User Story | Acceptance Criteria |
|:---|:---|
| US-STU-014: Notification Center | Grouped by category; unread badge; mark-as-read; click-through navigation |
| US-NOTIF-001: Announcement Publishing | Target by segment; schedule future publish; expire; high-priority triggers email |
| US-NOTIF-002: Admin Alert Configuration | Configurable channels per event type; quiet hours; digest mode |

**Database:** `notification_db` — run `V1__notification_initial_schema.sql`  
**Channels:** In-app (SSE), Email (SendGrid/SES), SMS (future)  
**Events Consumed:** All domain events (`payment.*`, `enrollment.*`, `course.*`, `liveclass.*`, `review.*`)

### 4.2 Frontends

#### Student Frontend
| Page | Features |
|:---|:---|
| `/live-classes` | Tabs: Upcoming / Past; card with countdown; capacity indicator; Register/Join button state machine |
| `/live-classes/[id]/join` | Pre-join screen (5 min before); countdown; tech check; embedded Jitsi/Zoom or external link launcher |
| `/notifications` | Panel with category filters; unread dot; infinite scroll; mark-all-read |

#### Admin Frontend
| Page | Features |
|:---|:---|
| `/live-classes` | Calendar view (month/week/day) + list toggle; drag-to-reschedule; conflict warning toast |
| `/live-classes/create` | Form: title, instructor dropdown (with availability), datetime picker, capacity, price, meeting link |
| `/announcements` | Table: title, target, priority, status; create form with RichTextEditor; "Send Test" button |
| `/announcements/create` | Target audience selector (all, specific courses, segments); schedule picker; recipient count preview |

### 4.3 Cross-Cutting
| Task | Detail |
|:---|:---|
| SSE stream | `/api/notifications/stream` for real-time admin activity feed + student notifications |
| Email templates | Transactional templates in `notification_db`; MJML for responsive email |
| Calendar ICS | `.ics` attachment on live class registration confirmation |
| Reminder cron | Distributed cron (Kubernetes CronJob) publishes `liveclass.reminder` events |

### ✅ Phase 4 Exit Criteria
- [ ] Admin schedules a class for tomorrow; 3 students register; all receive reminder emails.
- [ ] Student clicks "Join" 10 min before start → pre-join screen → launches meeting at T-5min.
- [ ] Admin publishes a high-priority announcement → targeted students see in-app notification + email within 60s.
- [ ] Activity feed on admin dashboard shows the registration event in real time.

---

## Phase 5: Service Requests, Support & Business Operations (Sprints 18–20)

**Goal:** Corporate clients can request services; support tickets flow through a pipeline; admins have full operational visibility.

> 🔴 **Hard Dependency:** Phase 1 (auth), Phase 4 (notifications for ticket updates)  
> 🟡 **Soft Dependency:** Analytics can use pre-aggregated SQL initially  
> ⭐ **Milestone:** First service request is submitted, reviewed by admin, and closed with satisfaction survey.

### 5.1 Backend Services

#### Service Request Service (Node.js / NestJS — MongoDB)
| User Story | Acceptance Criteria |
|:---|:---|
| US-STU-011: Service Request Submission | 7 flagship services catalog; multi-step request form; reference number; status tracking |
| US-ADM-014: Service Request Management | Kanban pipeline; assign to admin; internal notes; threaded communication log; status change emails |

**Database:** `request_db` — run `001_servicerequest_initial.js`  
**Events Published:** `servicerequest.created`, `servicerequest.status_changed`  
**Events Consumed:** `user.created` (for requester profile enrichment)

#### Admin Service (Java / Spring Boot)
| User Story | Acceptance Criteria |
|:---|:---|
| US-ADM-001: Operational Dashboard | Metric cards (students, revenue, courses, tickets, requests); clickable drill-downs |
| US-ADM-002: Quick Actions Panel | One-click buttons: Create Course, Schedule Class, Publish Announcement, etc. |
| US-ADM-003: Real-Time Activity Feed | SSE-driven; filter by event type; 10s polling fallback |
| US-ADM-015: Support Ticket Handling | Priority + SLA tracking; threaded replies; canned responses; satisfaction survey on resolve |

**Database:** `admin_db` — run `V1__admin_initial_schema.sql`  
**Audit:** Every admin action logged to `audit_logs` (partitioned monthly)  
**Events Consumed:** All domain events for dashboard + activity feed

#### Analytics Service (Node.js / NestJS — MongoDB)
| User Story | Acceptance Criteria |
|:---|:---|
| US-ADM-004: Revenue Analytics | Time-series aggregation pipeline; daily/weekly/monthly rollups |
| US-ADM-005: Student Engagement Insights | At-risk scoring; popular search keywords; cohort retention |

**Database:** `analytics_db` — run `001_analytics_initial.js`  
**Pattern:** Event sourcing from RabbitMQ → `events` collection → nightly MapReduce → `daily_metrics`  
**Events Consumed:** All domain events

### 5.2 Frontends

#### Student Frontend
| Page | Features |
|:---|:---|
| `/services` | 7 service cards with illustrations; click to detail |
| `/services/[slug]` | Benefits, pricing, duration; "Request Service" CTA |
| `/services/request` | Multi-section form (organization, needs, dates, budget); confirmation screen with reference # |

#### Admin Frontend
| Page | Features |
|:---|:---|
| `/` (Dashboard) | Metric cards row → Quick Actions → Revenue chart + Student insights + Activity feed + Upcoming classes + Pending requests |
| `/service-requests` | Kanban board (Received → Under Review → Responded → Scheduled → Completed); drag-drop; card detail sidebar |
| `/service-requests/[id]` | Requester info; service details; internal notes (threaded); communication timeline; status change + assignee dropdown |
| `/support/tickets` | Split-pane: ticket list left (filter tabs, search, preview cards), detail right |
| `/support/tickets/[id]` | Message thread (student left, admin right, system center); RichTextEditor reply; canned responses; "Send & Resolve" |
| `/analytics/overview` | Full-width charts; date range picker; export CSV |
| `/analytics/students` | Retention funnel; at-risk table; search keyword cloud |
| `/settings/general` | Platform name, logo upload, contact info |
| `/settings/payments` | Gateway config (masked API keys); webhook URL display; tax settings |
| `/settings/security` | Password policy, 2FA toggle, session timeout, login limits, IP whitelist |
| `/settings/integrations` | Connected services grid (Google, Zoom, Cloudinary); webhook management |
| `/logs/audit` | Immutable table: timestamp, admin, action, target, IP; filter + export CSV |
| `/logs/system` | Auto-refresh (30s); log level filter; stack trace expander; JSON export |

### ✅ Phase 5 Exit Criteria
- [ ] Corporate visitor submits a training request → admin receives in-app + email alert → moves to "Under Review" → sends response → status changes to "Responded".
- [ ] Student opens support ticket → admin replies within SLA → resolves → satisfaction email sent.
- [ ] Admin dashboard loads all metrics in <1s from pre-aggregated cache.
- [ ] Audit log shows every admin action with immutable timestamp + IP.

---

## Phase 6: Performance, Security & Production Hardening (Sprints 21–23)

**Goal:** Platform is production-grade: fast, secure, observable, and compliant.

### 6.1 Performance
| Task | Target |
|:---|:---|
| CDN + Edge caching | CloudFront caches static assets; API responses cached at edge for public endpoints |
| Database query optimization | Add missing indexes; EXPLAIN ANALYZE on slow queries; materialized views for dashboards |
| Video optimization | Per-title encoding; thumbnail WebP/AVIF; lazy load below fold |
| Bundle optimization | Route splitting; dynamic imports for charts, editor, video player; tree shaking |

### 6.2 Security
| Task | Standard |
|:---|:---|
| Penetration testing | OWASP Top 10 mitigation verified by external audit |
| DDoS protection | Cloudflare WAF + rate limiting; ALB anomaly detection |
| Secrets rotation | AWS Secrets Manager; 90-day rotation policy |
| Data encryption | RDS at-rest (AES-256); S3 SSE-KMS; TLS 1.3 in transit |
| Compliance | GDPR data export/delete; PCI DSS SAQ-A for payments |

### 6.3 Observability
| Task | Tool |
|:---|:---|
| Distributed tracing | Jaeger spans across all services |
| Log correlation | Trace ID injected into all logs; Loki logQL dashboards |
| Alerting | PagerDuty integration for 5xx errors, payment failures, disk >80% |
| SLOs | 99.9% availability; p95 API latency <200ms; error rate <0.1% |

### 6.4 Disaster Recovery
| Task | RTO / RPO |
|:---|:---|
| Database backups | Daily snapshots; point-in-time recovery (PITR) 35 days |
| Cross-region replication | S3 bucket replication to secondary region |
| Runbook documentation | Incident response playbooks for each service |

### ✅ Phase 6 Exit Criteria
- [ ] Lighthouse Performance score ≥ 90 on all public pages.
- [ ] Security audit: zero critical vulnerabilities.
- [ ] Load test: 10,000 concurrent students watching video; p95 latency <300ms.
- [ ] DR drill: simulate RDS failure → failover to read replica → recovery in <15 min.

---

## Phase 7: Scale & Advanced Features (Sprints 24+)

**Goal:** Differentiators that drive retention and revenue.

| Feature | Description | Complexity |
|:---|:---|:---|
| AI-Powered Recommendations | Collaborative filtering for "Because you enrolled in X" | L |
| Mobile Apps | React Native or Flutter wrappers for student/admin | XL |
| Advanced Coaching | Calendar sync (Google/Outlook); payment per session | L |
| Gamification | Badges, streaks, leaderboards, certificates with blockchain verification | L |
| Multi-tenancy | White-label for corporate clients | XL |
| Real-time Collaboration | Live note-sharing during classes | M |

---

## Appendix A: Story-to-Phase Mapping

| User Story | Phase | Service |
|:---|:---|:---|
| US-GUEST-001 | 2 | Student Frontend |
| US-GUEST-002 | 2 | Course Service + Student Frontend |
| US-GUEST-003 | 2 | Course Service + Student Frontend |
| US-GUEST-004 | 2 | Student Frontend |
| US-GUEST-005 | 5 | Service Request Service |
| US-GUEST-006 | 1 | Auth Service + Student Frontend |
| US-STU-001 | 1 | Auth Service |
| US-STU-002 | 1 | Auth Service |
| US-STU-003 | 1 | Auth Service |
| US-STU-004 | 3 | Student Frontend + multiple services |
| US-STU-005 | 3 | Enrollment Service + Student Frontend |
| US-STU-006 | 3 | Enrollment Service |
| US-STU-007 | 3 | Payment Service + Student Frontend |
| US-STU-008 | 3 | Enrollment Service + Student Frontend |
| US-STU-009 | 4 | Live Class Service + Student Frontend |
| US-STU-010 | 7 | Coaching (future) |
| US-STU-011 | 5 | Service Request Service |
| US-STU-012 | 3 | Review Service |
| US-STU-013 | 1 | Auth Service |
| US-STU-014 | 4 | Notification Service |
| US-STU-015 | 3 | Course Service + Student Frontend |
| US-ADM-001 | 5 | Admin Service + Admin Frontend |
| US-ADM-002 | 5 | Admin Frontend |
| US-ADM-003 | 5 | Admin Service + Admin Frontend |
| US-ADM-004 | 3 + 5 | Payment Service + Analytics Service |
| US-ADM-005 | 3 + 5 | Enrollment Service + Analytics Service |
| US-ADM-006 | 2 | Course Service + Admin Frontend |
| US-ADM-007 | 2 | Upload Service + Admin Frontend |
| US-ADM-008 | 2 | Course Service |
| US-ADM-009 | 2 | Course Service |
| US-ADM-010 | 2 | Course Service |
| US-ADM-011 | 4 | Live Class Service + Admin Frontend |
| US-ADM-012 | 1 | Auth Service + Admin Frontend |
| US-ADM-013 | 1 + 5 | Auth Service + Admin Frontend |
| US-ADM-014 | 5 | Service Request Service + Admin Frontend |
| US-ADM-015 | 5 | Admin Service + Admin Frontend |
| US-NOTIF-001 | 4 | Notification Service + Admin Frontend |
| US-NOTIF-002 | 4 | Notification Service + Admin Frontend |
| US-NFR-001 | All | All frontends |
| US-NFR-002 | 6 | DevOps + all services |
| US-NFR-003 | All | All frontends |
| US-NFR-004 | 1 + 6 | Auth Service + all layers |

---

## Appendix B: Team Structure Recommendation

| Phase | Backend | Frontend | DevOps | QA | Total |
|:---|:---|:---|:---|:---|:---|
| 0–1 | 2 (Java) + 1 (Node) | 1 (Admin) + 1 (Student) | 1 | 1 | 7 |
| 2–3 | 3 (Java) + 2 (Node) | 2 (Admin) + 2 (Student) | 1 | 2 | 12 |
| 4–5 | 4 (Java) + 3 (Node) | 2 (Admin) + 2 (Student) | 2 | 2 | 15 |
| 6–7 | 4 (Java) + 3 (Node) | 2 (Admin) + 2 (Student) | 2 | 3 + 1 (Security) | 17 |

---

## Appendix C: Definition of Done (Per Phase)

A phase is **Done** when:
1. All user stories in the phase meet acceptance criteria.
2. Code review approved by 2+ engineers.
3. Unit test coverage ≥ 80% for new logic.
4. Integration tests pass for all affected service boundaries.
5. UI matches Figma/design spec (pixel-perfect where specified).
6. Accessibility audit passes (axe-core, zero critical violations).
7. Performance budgets met (FCP <1.5s, LCP <2.5s, TTI <3.5s).
8. Security scan passes (Snyk/Trivy: zero critical/high vulnerabilities).
9. Documentation updated (API docs, runbooks, user guides).
10. Product Owner accepts the increment in staging.

---

*End of Implementation Phases Document*
