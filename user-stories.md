# Grammarcetamol — User Stories & Acceptance Criteria

> **Document Version:** 1.0  
> **Status:** Draft  
> **Last Updated:** 2026-07-31  
> **Product:** Grammarcetamol Digital Learning Ecosystem  
> **Implementation status:** This is the full backlog — most stories here aren't built yet. As of 2026-08-05, only the Phase 1 auth/identity stories are implemented and verified: US-GUEST-006, US-STU-001 through 003, US-STU-013 (backend only, no `/profile` UI), and US-ADM-012/013. See `PLAN.md` and `implementation-phases.md` for per-story implementation status and known divergences from these acceptance criteria (e.g. Google OAuth deferred, no granular permission system backing role management).

---

## 1. Introduction

This document translates the Grammarcetamol Product Vision into actionable, testable user stories. Each story follows the standard **Connextra format**:

> **As a** [type of user],  
> **I want** [some goal],  
> **So that** [some reason/benefit].

Every story is accompanied by **acceptance criteria** (Given-When-Then), **priority** (MoSCoW), and **estimation complexity** (T-shirt sizing) to guide sprint planning and development.

---

## 2. User Personas

| ID | Persona                | Description                                                          | Primary Goal                                                   |
|----|------------------------|----------------------------------------------------------------------|----------------------------------------------------------------|
| P1 | **Guest Visitor**      | Unauthenticated individual exploring the platform for the first time | Evaluate platform credibility and discover relevant courses    |
| P2 | **Registered Student** | Authenticated learner enrolled in one or more courses                | Master English communication through structured learning       |
| P3 | **Super Admin**        | Platform owner with unrestricted system access                       | Manage the entire business, content, and revenue efficiently   |
| P4 | **Moderator**          | Trusted assistant with configurable permissions                      | Support content publishing, student engagement, and operations |
| P5 | **Instructor**         | Subject matter expert delivering live or recorded content            | Deliver high-quality instruction and interact with learners    |

---

## 3. Epic: Guest Experience & Discovery

### US-GUEST-001: Landing Page Discovery
**As a** Guest Visitor,  
**I want** to understand what Grammarcetamol offers within seconds of landing,  
**So that** I can decide whether the platform is relevant to my learning needs.

**Acceptance Criteria:**
- **Given** I navigate to the homepage,
- **When** the page loads,
- **Then** I see a hero section answering: (a) What is Grammarcetamol?, (b) Why should I care?, (c) What should I do next?
- **And** the primary CTA "Start Learning" and secondary CTA "Explore Courses" are visible above the fold.

**Priority:** Must Have  
**Complexity:** S

---

### US-GUEST-002: Browse Course Catalog
**As a** Guest Visitor,  
**I want** to browse available courses without creating an account,  
**So that** I can evaluate content quality before committing to registration.

**Acceptance Criteria:**
- **Given** I am on the course catalog page,
- **When** I view the listings,
- **Then** each course card displays: thumbnail, title, short description, instructor name, difficulty level, price, rating, and student count.
- **And** I can filter by category, difficulty, and price (free/paid).
- **And** I can search courses by keyword.

**Priority:** Must Have  
**Complexity:** M

---

### US-GUEST-003: View Course Details
**As a** Guest Visitor,  
**I want** to view detailed information about a specific course,  
**So that** I can make an informed enrollment decision.

**Acceptance Criteria:**
- **Given** I click on a course card,
- **When** the course detail page loads,
- **Then** I see: full description, learning objectives, target audience, prerequisites, module outline, instructor profile, testimonials, and pricing.
- **And** premium lesson content is locked with a prompt to enroll/purchase.

**Priority:** Must Have  
**Complexity:** M

---

### US-GUEST-004: Explore Services
**As a** Guest Visitor,  
**I want** to learn about Grammarcetamol's professional services,  
**So that** I can determine if specialized training or consultancy fits my needs.

**Acceptance Criteria:**
- **Given** I navigate to the Services section,
- **When** I view the offerings,
- **Then** I see all seven flagship services with professional illustrations, brief summaries, and "Learn More" buttons.
- **And** clicking a service reveals: benefits, target audience, duration, pricing (if applicable), and registration process.

**Priority:** Must Have  
**Complexity:** M

---

### US-GUEST-005: Submit General Enquiry
**As a** Guest Visitor,  
**I want** to contact Grammarcetamol with questions before registering,  
**So that** I can resolve concerns and build trust.

**Acceptance Criteria:**
- **Given** I am on the contact/enquiry page,
- **When** I fill in the enquiry form with name, email, subject, and message,
- **Then** the enquiry is submitted successfully.
- **And** I receive an auto-confirmation email.
- **And** the admin receives a notification.

**Priority:** Should Have  
**Complexity:** S

---

### US-GUEST-006: Seamless Authentication Redirect
**As a** Guest Visitor,  
**I want** to be redirected back to my intended action after logging in,  
**So that** I don't lose context or have to re-navigate.

**Acceptance Criteria:**
- **Given** I attempt an authenticated action (e.g., enroll, purchase, join live class),
- **When** I am prompted to log in and successfully authenticate,
- **Then** I am automatically returned to the exact action I was attempting.
- **And** a contextual message displays: "Please log in to continue your enrollment."

**Priority:** Must Have  
**Complexity:** S

---

## 4. Epic: Student Authentication & Onboarding

### US-STU-001: Account Registration
**As a** prospective student,  
**I want** to register using email/password or Google OAuth,  
**So that** I can create a secure account quickly.

**Acceptance Criteria:**
- **Given** I am on the registration page,
- **When** I provide valid email, password (min. 8 chars, mixed case, number), and confirm password,
- **Then** my account is created and marked as pending verification.
- **And** a verification email is sent within 60 seconds.
- **And** a welcome email is dispatched.
- **And** a default student profile is initialized.
- **And** notification preferences are set to default values.
- **And** Google OAuth registration creates an account without requiring password setup.

**Priority:** Must Have  
**Complexity:** M

---

### US-STU-002: Email Verification
**As a** newly registered student,  
**I want** to verify my email address,  
**So that** I can unlock full platform access and receive important communications.

**Acceptance Criteria:**
- **Given** I receive a verification email,
- **When** I click the verification link (valid for 24 hours),
- **Then** my account status changes to "verified."
- **And** I am redirected to the student dashboard with a success toast.
- **And** if the link expires, I can request a new verification email.

**Priority:** Must Have  
**Complexity:** S

---

### US-STU-003: Secure Login
**As a** registered student,  
**I want** to log in securely via email/password or Google,  
**So that** I can access my personalized learning environment.

**Acceptance Criteria:**
- **Given** I am on the login page,
- **When** I enter valid credentials,
- **Then** I am authenticated and redirected to the Student Dashboard.
- **And** after 5 failed attempts, the account is temporarily locked for 15 minutes.
- **And** a "Forgot Password" flow allows secure reset via email.
- **And** Google OAuth login bypasses password entry.

**Priority:** Must Have  
**Complexity:** M

---

## 5. Epic: Student Dashboard & Learning Hub

### US-STU-004: Personalized Dashboard Overview
**As a** registered student,  
**I want** to see a dashboard that answers my immediate learning questions,  
**So that** I can quickly resume learning and stay organized.

**Acceptance Criteria:**
- **Given** I log in successfully,
- **When** the dashboard loads,
- **Then** I see:
  - **Welcome Card:** Personalized greeting, learning streak (future), recent achievements.
  - **Continue Learning:** Last watched course with resume button and progress percentage.
  - **My Courses:** Tabbed view of Purchased, Free Enrolled, Completed, and Recently Updated courses.
  - **Upcoming Live Classes:** Date, time, instructor, join button, and countdown timer.
  - **Notifications:** Recent announcements, course updates, payment confirmations, class reminders.
  - **Recommended Courses:** Suggestions based on purchase history, categories, and popularity.

**Priority:** Must Have  
**Complexity:** L

---

### US-STU-005: Resume Learning with Progress Persistence
**As a** student returning to a course,  
**I want** to resume exactly where I left off,  
**So that** I don't waste time re-watching content or losing my place.

**Acceptance Criteria:**
- **Given** I previously watched a video lesson,
- **When** I click "Resume" or return to that course,
- **Then** the video player starts at the exact timestamp where I stopped.
- **And** progress is auto-saved every 5 seconds of watch time.
- **And** if the browser crashes or closes unexpectedly, progress is preserved.
- **And** module and lesson completion status is visually indicated (locked, in-progress, completed).

**Priority:** Must Have  
**Complexity:** M

---

### US-STU-006: Course Enrollment — Free
**As a** registered student,  
**I want** to enroll in free courses instantly,  
**So that** I can begin learning without payment friction.

**Acceptance Criteria:**
- **Given** I am viewing a free course,
- **When** I click "Enroll for Free,"
- **Then** enrollment is created instantly.
- **And** the course appears in "My Courses" immediately.
- **And** I receive an enrollment confirmation notification and email.

**Priority:** Must Have  
**Complexity:** S

---

### US-STU-007: Course Purchase & Checkout
**As a** registered student,  
**I want** to purchase a paid course through a branded, seamless checkout,  
**So that** I can access premium content securely and immediately.

**Acceptance Criteria:**
- **Given** I click "Buy Now" on a paid course,
- **When** the checkout page loads,
- **Then** I see: course title, thumbnail, instructor, price, discount (if applicable), taxes (if applicable), and total payable amount.
- **And** I can review/edit my details: full name, email, phone number.
- **And** I can select a payment method integrated through the chosen gateway.
- **And** upon successful payment:
  - Transaction is recorded.
  - Enrollment is created instantly.
  - Success confirmation is displayed visually.
  - Confirmation email and notification are sent.
  - Course appears immediately in "My Courses."
- **And** failed payments display a clear error message with retry option.

**Priority:** Must Have  
**Complexity:** L

---

### US-STU-008: Interactive Learning Interface
**As a** student enrolled in a course,  
**I want** a premium, distraction-free learning interface,  
**So that** I can focus entirely on mastering the content.

**Acceptance Criteria:**
- **Given** I open an enrolled course,
- **When** the learning interface loads,
- **Then** the layout includes:
  - **Left Sidebar:** Course modules, lessons, progress indicators, locked/completed/current lesson states.
  - **Main Area:** Video player, lesson notes, downloadable resources, assignments placeholder, transcript placeholder.
  - **Right Sidebar:** Instructor info, downloads, discussion panel, bookmarks, personal notes.
  - **Below Video:** Previous/Next lesson navigation, "Mark Complete" button, "Leave Review" link, "Download Materials" button.
- **And** the interface is responsive across desktop, tablet, and mobile.
- **And** keyboard shortcuts are supported for playback control.

**Priority:** Must Have  
**Complexity:** L

---

### US-STU-009: Live Classroom Participation
**As a** student,  
**I want** to join scheduled live classes directly from my dashboard,  
**So that** I can benefit from real-time instruction and interaction.

**Acceptance Criteria:**
- **Given** I have registered for a live class,
- **When** I view my dashboard within 15 minutes of class start,
- **Then** I see a prominent "Join Class" button.
- **And** I cannot join before the scheduled start time (button is disabled with countdown).
- **And** after the session ends, the join button is replaced with a "Class Ended" status.
- **And** I receive reminder notifications: 24 hours, 1 hour, and 15 minutes before class.
- **And** the meeting link or integrated video platform launches correctly.

**Priority:** Must Have  
**Complexity:** M

---

### US-STU-010: One-on-One Coaching Booking
**As a** student seeking personalized help,  
**I want** to book a private coaching session with an instructor,  
**So that** I can receive targeted guidance on my specific challenges.

**Acceptance Criteria:**
- **Given** I navigate to the coaching section,
- **When** I select an instructor (if multiple),
- **Then** I see their available date and time slots.
- **And** I can select a slot and confirm the booking.
- **And** if payment is required, I complete checkout before confirmation.
- **And** I receive a booking confirmation email and calendar invite (ICS).
- **And** reminder notifications are sent 24 hours and 1 hour before the session.
- **And** administrators can view and manage all bookings to avoid conflicts.

**Priority:** Should Have  
**Complexity:** L

---

### US-STU-011: Service Request Submission
**As a** student or visitor,  
**I want** to request professional services (e.g., corporate training, consultancy),  
**So that** I can access specialized language support beyond standard courses.

**Acceptance Criteria:**
- **Given** I select a service from the catalog,
- **When** I complete the request form with relevant details (organization, needs, preferred dates, contact info),
- **Then** the submission is stored in the backend.
- **And** I receive a confirmation email with a reference number.
- **And** the administrator receives an in-app and email notification.
- **And** I can track the status of my request (Received → Under Review → Responded → Scheduled → Completed).

**Priority:** Should Have  
**Complexity:** M

---

### US-STU-012: Leave Course Reviews
**As a** student who has completed (or substantially progressed through) a course,  
**I want** to leave a rating and written review,  
**So that** I can share my experience and help future learners decide.

**Acceptance Criteria:**
- **Given** I have completed at least 50% of a course,
- **When** I click "Leave Review,"
- **Then** I can submit a star rating (1–5) and written feedback.
- **And** my review appears after admin moderation (if enabled).
- **And** I can edit or delete my review within 7 days.
- **And** the average course rating updates dynamically.

**Priority:** Should Have  
**Complexity:** S

---

### US-STU-013: Profile Management
**As a** registered student,  
**I want** to manage my personal profile and preferences,  
**So that** my learning experience is personalized and my data is accurate.

**Acceptance Criteria:**
- **Given** I navigate to my profile settings,
- **When** I edit my details,
- **Then** I can update: profile picture, full name, email, phone, country, timezone, biography, learning goals.
- **And** I can change my password (requires current password confirmation).
- **And** I can manage notification preferences (email, in-app, marketing).
- **And** I can view and disconnect my linked Google account.
- **And** I can adjust privacy settings (profile visibility, activity sharing).
- **And** all changes are saved with a success confirmation.

**Priority:** Must Have  
**Complexity:** M

---

### US-STU-014: Notification Center
**As a** registered student,  
**I want** to receive and manage notifications in one place,  
**So that** I stay informed without being overwhelmed.

**Acceptance Criteria:**
- **Given** I am logged in,
- **When** I click the notification bell,
- **Then** I see a dropdown/panel with recent notifications grouped by category (Courses, Payments, Live Classes, Announcements, System).
- **And** unread notifications are visually distinguished.
- **And** I can mark individual or all notifications as read.
- **And** clicking a notification navigates directly to the relevant page.
- **And** I receive notifications for: purchase confirmations, enrollment confirmations, new course releases, course updates, live class reminders, session reminders, service request updates, payment confirmations, announcements.

**Priority:** Must Have  
**Complexity:** M

---

### US-STU-015: Download Learning Resources
**As a** student enrolled in a course,  
**I want** to download supplementary materials (PDFs, worksheets, audio),  
**So that** I can study offline and reinforce my learning.

**Acceptance Criteria:**
- **Given** I am in a course lesson,
- **When** I view the resources section,
- **Then** I see a list of available downloadable files with file type and size.
- **And** clicking "Download" initiates the file download securely.
- **And** download history is tracked for analytics.
- **And** large files show a progress indicator.

**Priority:** Should Have  
**Complexity:** S

---

## 6. Epic: Admin Dashboard & Operations

### US-ADM-001: Operational Dashboard Overview
**As a** Super Admin,  
**I want** a centralized dashboard that displays the health of the business at a glance,  
**So that** I can make informed decisions quickly without navigating multiple pages.

**Acceptance Criteria:**
- **Given** I log into the admin portal,
- **When** the dashboard loads,
- **Then** I see key metrics displayed as clean, clickable cards:
  - Total registered students
  - Active students (last 30 days)
  - New registrations (today/this week/this month)
  - Published courses / Draft courses
  - Total revenue / Revenue this month
  - Pending payments / Completed transactions
  - Upcoming live classes
  - Open support tickets
  - Pending service requests
  - Total reviews / Average course rating
- **And** each metric is clickable, drilling down to a detailed report.

**Priority:** Must Have  
**Complexity:** L

---

### US-ADM-002: Quick Actions Panel
**As a** Super Admin,  
**I want** one-click access to frequent administrative tasks,  
**So that** I can perform common actions efficiently.

**Acceptance Criteria:**
- **Given** I am on the admin dashboard,
- **When** I view the Quick Actions section,
- **Then** I see buttons for: Create New Course, Schedule Live Class, Publish Announcement, Add Moderator, Send Notification, Review Pending Uploads, View Financial Report.
- **And** clicking each button navigates directly to the relevant workflow.

**Priority:** Must Have  
**Complexity:** S

---

### US-ADM-003: Real-Time Activity Feed
**As a** Super Admin,  
**I want** to see a live feed of platform events,  
**So that** I can monitor activity and respond to issues proactively.

**Acceptance Criteria:**
- **Given** I am on the admin dashboard,
- **When** I view the Activity Feed panel,
- **Then** I see real-time events including: new student registrations, completed purchases, failed payment attempts, new reviews, course publications, upload failures, support ticket creation, service requests, upcoming classroom reminders.
- **And** events are timestamped and link to relevant detail pages.
- **And** I can filter by event type and date range.

**Priority:** Should Have  
**Complexity:** M

---

### US-ADM-004: Revenue Analytics & Visualization
**As a** Super Admin,  
**I want** interactive charts showing revenue performance,  
**So that** I can identify trends and optimize business strategy.

**Acceptance Criteria:**
- **Given** I navigate to the Revenue section,
- **When** I view the analytics dashboard,
- **Then** I see interactive visualizations for:
  - Daily, weekly, and monthly revenue trends (line/bar charts)
  - Best-selling courses (ranked list)
  - Revenue by course category (pie/donut chart)
  - Payment success vs. failed transactions (stacked bar)
- **And** I can filter by date range (last 7 days, 30 days, 90 days, custom).
- **And** data exports to CSV/Excel are supported.

**Priority:** Must Have  
**Complexity:** L

---

### US-ADM-005: Student Engagement Insights
**As a** Super Admin,  
**I want** detailed analytics on student behavior and engagement,  
**So that** I can improve content and increase retention.

**Acceptance Criteria:**
- **Given** I navigate to the Student Insights section,
- **When** I view the reports,
- **Then** I see:
  - Most active learners (by time spent, lessons completed)
  - Course completion rates (overall and per-course)
  - Most enrolled courses
  - Least engaged students (at-risk flagging)
  - Popular search keywords
  - Average learning time per session and per course
- **And** at-risk students are flagged with automated suggestions for re-engagement.

**Priority:** Should Have  
**Complexity:** L

---

## 7. Epic: Course Management (Admin)

### US-ADM-006: Guided Course Creation Workflow
**As a** Super Admin or Moderator,  
**I want** a step-by-step wizard for creating courses,  
**So that** I can publish high-quality content without errors or omissions.

**Acceptance Criteria:**
- **Given** I start creating a new course,
- **When** I proceed through the wizard,
- **Then** I complete the following steps:
  1. **Course Information:** Title, subtitle, description, learning objectives, target audience, prerequisites, category, difficulty, language, estimated duration, cover image, promotional video (optional), tags. Auto-saved as Draft.
  2. **Pricing & Availability:** Free/Paid toggle, price, discount price (optional), enrollment period (optional).
  3. **Build Structure:** Create modules, add lessons, reorder via drag-and-drop, move lessons between modules, duplicate modules/lessons, delete modules, attach resources.
- **And** all changes are auto-saved.
- **And** I can exit and resume later without losing progress.

**Priority:** Must Have  
**Complexity:** XL

---

### US-ADM-007: Resumable Chunked Upload System
**As a** Super Admin or Moderator,  
**I want** to upload large video files reliably with resume capability,  
**So that** network interruptions never force me to restart uploads from scratch.

**Acceptance Criteria:**
- **Given** I initiate a course upload,
- **When** files are selected,
- **Then** the system splits files into chunks (configurable size, e.g., 5MB).
- **And** an Upload Session is created tracking: course ID, status, uploaded/failed/pending lessons, progress percentage, upload token, expiration time.
- **And** if the browser closes or network fails, I can resume from the last successful chunk.
- **And** multiple lessons upload in parallel (3–5 concurrent, adaptive to network).
- **And** the interface shows: overall course progress bar, per-lesson status (Uploaded ✓, Uploading…, Waiting…, Failed → Retry).
- **And** duplicate uploads are prevented via checksum comparison.

**Priority:** Must Have  
**Complexity:** XL

---

### US-ADM-008: Atomic Course Publishing
**As a** Super Admin,  
**I want** courses to be published only after complete validation,  
**So that** students never encounter broken or incomplete content.

**Acceptance Criteria:**
- **Given** I click "Publish Course,"
- **When** the system validates,
- **Then** it verifies: every required file is uploaded, checksums match, metadata is complete, module/lesson relationships are intact, thumbnail is present, pricing is set.
- **And** if any validation fails, publishing is blocked with a detailed error list.
- **And** the course transitions atomically from "Review" to "Published."
- **And** enrolled students receive a "New Course Available" notification.

**Priority:** Must Have  
**Complexity:** L

---

### US-ADM-009: Course Editing & Versioning
**As a** Super Admin,  
**I want** to update published courses while preserving student history,  
**So that** content stays current without disrupting existing learners.

**Acceptance Criteria:**
- **Given** I edit a published course,
- **When** I make changes,
- **Then** I can update: title, description, pricing, thumbnail, modules, lessons, resources.
- **And** adding new lessons notifies enrolled students and sets their progress to 0%.
- **And** removing a lesson warns me if students have viewed it; option to archive instead of delete.
- **And** every significant update creates an internal version record (audit history).
- **And** students always access the latest published version.
- **And** rollback to a previous version is supported.

**Priority:** Must Have  
**Complexity:** L

---

### US-ADM-010: Safe Course Deletion & Archival
**As a** Super Admin,  
**I want** strict rules around course deletion,  
**So that** I don't accidentally remove content with active enrollments or revenue history.

**Acceptance Criteria:**
- **Given** I attempt to delete a course,
- **When** the system checks constraints,
- **Then** deletion is blocked if: active enrollments exist, purchases have been made, transactions are recorded, or students have recorded progress.
- **And** blocked courses can be "Archived" instead (hidden from new enrollments, accessible to existing students per business rules).
- **And** only courses with zero enrollments, zero purchases, and zero progress may be permanently deleted with a confirmation dialog.

**Priority:** Must Have  
**Complexity:** M

---

### US-ADM-011: Live Class Scheduling
**As a** Super Admin or Moderator,  
**I want** to schedule live classes with full control over details,  
**So that** students can register and attend instructor-led sessions.

**Acceptance Criteria:**
- **Given** I navigate to the Live Class scheduler,
- **When** I create a new session,
- **Then** I configure: class title, description, instructor, date, start time, end time, capacity, pricing (free/paid), meeting link or integrated video platform.
- **And** the system prevents double-booking an instructor.
- **And** registered students see the class in their "Upcoming Live Classes" section.
- **And** reminder emails/notifications are automated.

**Priority:** Must Have  
**Complexity:** M

---

## 8. Epic: User & Role Management

### US-ADM-012: Moderator Management
**As a** Super Admin,  
**I want** to create and configure moderator accounts,  
**So that** trusted assistants can help manage the platform with appropriate boundaries.

**Acceptance Criteria:**
- **Given** I navigate to the Moderator Management page,
- **When** I add a new moderator,
- **Then** I assign: name, email, role (Moderator), and granular permissions.
- **And** configurable permissions include: publish courses, respond to support, schedule classes, review uploads, moderate reviews.
- **And** moderators CANNOT: delete super admin, view sensitive financial settings, change platform configuration, access security settings.
- **And** moderator actions are logged for audit.

**Priority:** Must Have  
**Complexity:** M

---

### US-ADM-013: Student Management
**As a** Super Admin,  
**I want** to view and manage all student accounts,  
**So that** I can support users and maintain platform integrity.

**Acceptance Criteria:**
- **Given** I navigate to the Students section,
- **When** I view the student list,
- **Then** I see: name, email, registration date, enrollment count, last active date, account status.
- **And** I can search and filter by name, email, status, enrollment date.
- **And** I can view a student's full profile, enrollments, progress, and transaction history.
- **And** I can suspend/activate accounts with a reason note.

**Priority:** Must Have  
**Complexity:** M

---

## 9. Epic: Service & Support Management

### US-ADM-014: Service Request Management
**As a** Super Admin or Moderator,  
**I want** to view and manage incoming service requests,  
**So that** I can respond promptly and convert enquiries into business.

**Acceptance Criteria:**
- **Given** I navigate to the Service Requests dashboard,
- **When** I view the list,
- **Then** I see all requests with filters: status (Received, Under Review, Responded, Scheduled, Completed), service type, submission date.
- **And** I can click any request to view full details and submitter information.
- **And** I can update status and add internal notes.
- **And** status changes trigger email notifications to the requester.
- **And** I can assign requests to specific team members.

**Priority:** Should Have  
**Complexity:** M

---

### US-ADM-015: Support Ticket Handling
**As a** Super Admin or Moderator,  
**I want** to manage support tickets efficiently,  
**So that** student issues are resolved quickly and satisfaction is maintained.

**Acceptance Criteria:**
- **Given** a support ticket is created,
- **When** I view the ticket queue,
- **Then** tickets are categorized by priority (Low, Medium, High, Critical) and status (Open, In Progress, Resolved, Closed).
- **And** I can assign tickets to myself or other moderators.
- **And** I can communicate with the student via threaded replies.
- **And** resolution triggers a satisfaction survey email.
- **And** SLA timers track response and resolution times.

**Priority:** Should Have  
**Complexity:** M

---

## 10. Epic: Notifications & Communication

### US-NOTIF-001: Announcement Publishing
**As a** Super Admin,  
**I want** to publish platform-wide announcements,  
**So that** I can communicate important updates to all users.

**Acceptance Criteria:**
- **Given** I compose a new announcement,
- **When** I publish it,
- **Then** I can set: title, message body, target audience (all students, specific courses, specific user segments), priority level, expiration date.
- **And** the announcement appears in the notification center of targeted users.
- **And** high-priority announcements trigger email delivery.
- **And** I can schedule announcements for future publication.

**Priority:** Should Have  
**Complexity:** S

---

### US-NOTIF-002: Admin Alert Configuration
**As a** Super Admin,  
**I want** to receive alerts for critical platform events,  
**So that** I can respond to issues before they impact students.

**Acceptance Criteria:**
- **Given** a critical event occurs,
- **When** the alert system triggers,
- **Then** I receive notifications for: new student registrations, successful purchases, failed payments, service requests, support tickets, course upload failures, upload completions, upcoming live classes.
- **And** I can configure delivery channels (in-app, email, SMS — future).
- **And** I can set quiet hours and digest frequency.

**Priority:** Should Have  
**Complexity:** M

---

## 11. Non-Functional Requirements (Cross-Cutting)

### US-NFR-001: Responsive Design
**As a** user on any device,  
**I want** the platform to be fully functional and visually polished on desktop, tablet, and mobile,  
**So that** I can learn and manage on my preferred device.

**Acceptance Criteria:**
- Layout adapts gracefully from 320px to 2560px width.
- Touch targets are minimum 44×44px on mobile.
- Navigation collapses to hamburger menu on screens < 768px.
- Video player supports fullscreen and picture-in-picture on mobile.

**Priority:** Must Have  

---

### US-NFR-002: Performance
**As a** user,  
**I want** pages to load quickly and interactions to feel instant,  
**So that** my experience is smooth and professional.

**Acceptance Criteria:**
- First Contentful Paint < 1.5s on 4G.
- Time to Interactive < 3.5s on average hardware.
- API response times < 200ms for 95th percentile.
- Video start time < 2s after click.
- Upload progress updates every 2 seconds.

**Priority:** Must Have  

---

### US-NFR-003: Accessibility
**As a** user with disabilities,  
**I want** the platform to be accessible via screen readers and keyboard navigation,  
**So that** I can learn without barriers.

**Acceptance Criteria:**
- WCAG 2.1 AA compliance.
- All images have descriptive alt text.
- Video content has captions/transcripts.
- Color contrast ratios meet standards (4.5:1 normal text, 3:1 large text).
- Focus indicators are visible on all interactive elements.

**Priority:** Must Have  

---

### US-NFR-004: Security
**As a** user,  
**I want** my personal and payment data to be protected,  
**So that** I can trust the platform with sensitive information.

**Acceptance Criteria:**
- All data transmission over HTTPS/TLS 1.3.
- Passwords hashed with bcrypt (cost factor ≥ 12).
- Payment data never touches our servers (tokenized via gateway).
- Role-based access control enforced on every API endpoint.
- Rate limiting on authentication endpoints (5 attempts / 15 min).
- OWASP Top 10 mitigations implemented.

**Priority:** Must Have  

---

## 12. Story Map Summary

| Epic                         | Key Stories         | Priority    | Complexity |
|------------------------------|---------------------|-------------|------------|
| Guest Experience             | US-GUEST-001 to 006 | Must Have   | S–M        |
| Student Auth & Onboarding    | US-STU-001 to 003   | Must Have   | S–M        |
| Student Dashboard & Learning | US-STU-004 to 015   | Must Have   | S–L        |
| Admin Dashboard & Operations | US-ADM-001 to 005   | Must Have   | S–L        |
| Course Management            | US-ADM-006 to 011   | Must Have   | M–XL       |
| User & Role Management       | US-ADM-012 to 013   | Must Have   | M          |
| Service & Support            | US-ADM-014 to 015   | Should Have | M          |
| Notifications                | US-NOTIF-001 to 002 | Should Have | S–M        |
| Non-Functional               | US-NFR-001 to 004   | Must Have   | —          |

---

## 13. Definition of Ready

A user story is considered **Ready** when:
1. It follows the Connextra format (As a… I want… So that…).
2. Acceptance criteria are written in Given-When-Then format.
3. Dependencies and blockers are identified.
4. UI/UX mockups or wireframes are attached (where applicable).
5. The story is estimable by the development team.
6. Business value is clearly articulated.

## 14. Definition of Done

A user story is considered **Done** when:
1. All acceptance criteria are met and demonstrable.
2. Code is peer-reviewed and merged to the main branch.
3. Unit test coverage ≥ 80% for new logic.
4. Integration tests pass for all affected endpoints.
5. UI matches approved designs (pixel-perfect where specified).
6. Accessibility audit passes (axe-core, zero critical violations).
7. Performance budgets are met (Lighthouse score ≥ 90).
8. Documentation is updated (API docs, user guides).
9. Product Owner accepts the story in the staging environment.

---

> **End of Document**
