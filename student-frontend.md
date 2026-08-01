# Grammarcetamol — Student Frontend Architecture & Design Specification

> **Document Version:** 1.0  
> **Application:** Grammarcetamol-Student-Interface  
> **Stack:** Next.js (App Router), TypeScript, Tailwind CSS, React Query, Zustand  
> **Status:** Draft  
> **Last Updated:** 2026-07-31  

---

## 1. Overview

The **Student Interface** is the public-facing, learner-centric application of the Grammarcetamol ecosystem. It is designed to be the primary touchpoint for students discovering, purchasing, and consuming English language learning content. Every design decision prioritizes **Learning First** — reducing cognitive load, maximizing engagement, and ensuring seamless access to educational material across all devices.

### 1.1 Design Philosophy
- **Clarity over decoration:** Every element serves a learning purpose.
- **Progressive disclosure:** Complex features reveal themselves only when needed.
- **Responsive-first:** Native-app quality experience on mobile, tablet, and desktop.
- **Accessibility-first:** WCAG 2.1 AA compliance is non-negotiable.
- **Performance-critical:** Pages must feel instant; videos must start within 2 seconds.

### 1.2 Target Users
| User Type | Access Level | Primary Goal |
|---|---|---|
| Guest | Unauthenticated | Discover, evaluate, and register |
| Registered Student | Authenticated | Learn, track progress, engage |

---

## 2. Information Architecture

```
grammarcetamol-student-interface/
├── Public Routes (Guest + Student)
│   ├── /                          → Landing Page (Hero, Services, Courses, Testimonials)
│   ├── /courses                   → Course Catalog (Filter, Search, Pagination)
│   ├── /courses/[slug]            → Course Detail (Overview, Curriculum, Reviews, Instructor)
│   ├── /services                  → Services Directory (7 Flagship Services)
│   ├── /services/[slug]           → Service Detail (Benefits, Pricing, Request Form)
│   ├── /instructors               → Instructor Directory
│   ├── /instructors/[id]          → Instructor Profile
│   ├── /blog                      → Blog/Articles Listing
│   ├── /blog/[slug]               → Article Detail
│   ├── /about                     → About Grammarcetamol
│   ├── /faq                       → Frequently Asked Questions
│   ├── /contact                   → Contact & Enquiry Form
│   ├── /testimonials              → Student & Corporate Testimonials
│   ├── /login                     → Authentication (Email / Google OAuth)
│   ├── /register                  → Registration (Email / Google OAuth)
│   ├── /forgot-password           → Password Reset Flow
│   └── /verify-email              → Email Verification Handler
│
├── Protected Routes (Student Only)
│   ├── /dashboard                 → Student Learning HQ
│   ├── /my-courses                → Enrolled Courses (Purchased, Free, Completed)
│   ├── /my-courses/[courseId]     → Course Learning Interface
│   ├── /live-classes              → Upcoming & Past Live Classes
│   ├── /live-classes/[id]/join    → Live Class Join Portal
│   ├── /coaching                  → One-on-One Coaching Booking
│   ├── /coaching/[bookingId]      → Booking Confirmation & Details
│   ├── /services/request          → Service Request Form (Authenticated)
│   ├── /notifications             → Notification Center
│   ├── /profile                   → Profile Settings
│   ├── /profile/edit              → Edit Profile & Preferences
│   ├── /transactions              → Payment & Transaction History
│   ├── /certificates              → Earned Certificates (Future)
│   └── /settings                  → Account & Privacy Settings
│
└── Checkout Flow
    ├── /checkout/[courseId]       → Branded Checkout Page
    └── /checkout/success          → Payment Confirmation
```

---

## 3. Global Design System

### 3.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#1E3A5F` | Primary brand color, headers, key actions |
| `--color-primary-light` | `#2A5285` | Hover states, secondary emphasis |
| `--color-accent` | `#F59E0B` | CTAs, progress indicators, highlights |
| `--color-accent-hover` | `#D97706` | CTA hover states |
| `--color-success` | `#10B981` | Success states, completion, confirmations |
| `--color-warning` | `#F59E0B` | Warnings, pending states |
| `--color-error` | `#EF4444` | Errors, failures, destructive actions |
| `--color-background` | `#F8FAFC` | Page backgrounds |
| `--color-surface` | `#FFFFFF` | Cards, modals, elevated surfaces |
| `--color-surface-elevated` | `#FFFFFF` + shadow | Dropdowns, popovers |
| `--color-border` | `#E2E8F0` | Dividers, input borders |
| `--color-text-primary` | `#0F172A` | Headings, primary text |
| `--color-text-secondary` | `#64748B` | Body text, descriptions |
| `--color-text-muted` | `#94A3B8` | Placeholders, disabled text |

### 3.2 Typography

| Element | Font | Weight | Size (Desktop) | Size (Mobile) | Line Height |
|---|---|---|---|---|---|
| H1 (Hero) | Inter | 800 | 56px | 36px | 1.1 |
| H2 (Section) | Inter | 700 | 40px | 28px | 1.2 |
| H3 (Card Title) | Inter | 600 | 24px | 20px | 1.3 |
| H4 (Subsection) | Inter | 600 | 20px | 18px | 1.4 |
| Body | Inter | 400 | 16px | 15px | 1.6 |
| Body Small | Inter | 400 | 14px | 13px | 1.5 |
| Caption | Inter | 500 | 12px | 11px | 1.4 |
| Button | Inter | 600 | 16px | 15px | 1.0 |
| Nav Link | Inter | 500 | 15px | 14px | 1.0 |

### 3.3 Spacing Scale

Based on an 8px grid system:

| Token | Value |
|---|---|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 24px |
| `space-6` | 32px |
| `space-7` | 48px |
| `space-8` | 64px |
| `space-9` | 96px |
| `space-10` | 128px |

### 3.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Buttons, badges, small elements |
| `radius-md` | 8px | Inputs, cards, modals |
| `radius-lg` | 12px | Large cards, feature sections |
| `radius-xl` | 16px | Hero containers, media players |
| `radius-full` | 9999px | Pills, avatars, circular buttons |

### 3.5 Shadows

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Cards, dropdowns |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals, popovers |
| `shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1)` | Overlays, toasts |

### 3.6 Animation Tokens

| Token | Duration | Easing | Usage |
|---|---|---|---|
| `transition-fast` | 150ms | `ease-out` | Button hovers, toggles |
| `transition-base` | 200ms | `ease-in-out` | Card hovers, dropdowns |
| `transition-slow` | 300ms | `ease-in-out` | Page transitions, modals |
| `transition-slower` | 500ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Hero animations |

---

## 4. Component Inventory

### 4.1 Layout Components

#### `Navbar`
- **Position:** Fixed top, z-index 50, height 72px
- **Behavior:** Transparent on hero → solid white on scroll (trigger: 50px)
- **Elements:**
  - Logo (left)
  - Navigation links: Courses, Services, Live Classes, Blog, About (center, hidden on mobile)
  - Search icon → expands to search bar
  - Notification bell (student only, with unread badge)
  - User avatar dropdown (student) or Login/Register buttons (guest)
- **Mobile:** Hamburger menu → full-screen overlay navigation

#### `Footer`
- **Layout:** 4-column grid (desktop), stacked (mobile)
- **Columns:**
  1. Brand + short description + social icons
  2. Quick Links (Courses, Services, About, Blog, FAQ)
  3. Legal (Privacy Policy, Terms, Refund Policy)
  4. Newsletter signup (email input + subscribe button)
- **Bottom bar:** Copyright + payment method icons

#### `PageHeader`
- **Usage:** Section headers across internal pages
- **Structure:** Breadcrumb trail → Title → Optional subtitle/description → Optional action button
- **Styling:** Background `--color-background`, bottom border `--color-border`, padding `space-7` vertical

#### `Sidebar` (Learning Interface)
- **Position:** Fixed left, width 320px (desktop), collapsible drawer (mobile)
- **Structure:**
  - Course title + progress ring
  - Module accordion list
  - Each module: title + completion percentage + lesson list
  - Lesson item: status icon (locked/playing/completed) + title + duration
  - Active lesson highlighted with `--color-primary` left border

### 4.2 Data Display Components

#### `CourseCard`
- **Dimensions:** 280px min-width, aspect-ratio 16:9 thumbnail
- **Elements:**
  - Thumbnail image with hover zoom (scale 1.05)
  - Difficulty badge (top-left)
  - Price badge (top-right, or "Free" label)
  - Title (2-line clamp)
  - Instructor name + avatar
  - Rating stars + count
  - Student count
- **Hover:** Shadow elevation increase, "Preview" overlay on thumbnail
- **States:** Loading skeleton, empty state, error state

#### `StatCard` (Dashboard)
- **Structure:** Icon (48px, rounded container) + Value (H3) + Label (caption) + Trend indicator (up/down arrow + percentage)
- **Variants:** Primary (colored background), Default (white background)

#### `ProgressRing`
- **Usage:** Course completion, module progress
- **Specs:** 48px diameter, 4px stroke, `--color-accent` for progress, `--color-border` for track
- **Center:** Percentage text (caption size)

#### `NotificationItem`
- **Structure:** Icon (colored by type) + Title + Message preview + Timestamp + Unread dot
- **Types:** Course (blue), Payment (green), Live Class (purple), Announcement (orange), System (gray)
- **Actions:** Mark as read, Delete, Click to navigate

### 4.3 Form Components

#### `Input`
- **States:** Default, Focus (ring-2 `--color-primary`), Error (ring-2 `--color-error`), Disabled
- **Features:** Label, helper text, error message, icon prefix/suffix, password visibility toggle

#### `SearchInput`
- **Behavior:** Debounced (300ms), loading spinner during fetch, dropdown results with course thumbnails
- **Keyboard:** Arrow navigation, Enter to select, Escape to close

#### `ResourceDownloader`
- **Usage:** Download supplementary course materials (PDFs, worksheets, audio files)
- **Visual:** File list with icon (by type), file name, size, and download button
- **States:** Available (clickable download), Downloading (progress indicator), Downloaded (checkmark + "Open" link), Restricted (lock icon for premium resources)
- **Security:** Signed URL generation for each download, expiring after 15 minutes

### 4.4 Feedback Components

#### `Toast`
- **Position:** Bottom-right (desktop), top-center (mobile)
- **Types:** Success, Error, Warning, Info
- **Duration:** 4 seconds (auto-dismiss), persistent for errors
- **Animation:** Slide in from right, fade out

#### `Modal`
- **Overlay:** Backdrop blur + dark overlay (rgba(0,0,0,0.5))
- **Sizes:** Small (400px), Medium (560px), Large (720px), Fullscreen (mobile)
- **Close:** X button, Escape key, click outside
- **Focus trap:** First focusable element auto-focused

#### `Skeleton`
- **Usage:** Loading states for cards, lists, text blocks
- **Style:** Animated shimmer gradient (`--color-border` to `--color-background`)

### 4.5 Media Components

#### `VideoPlayer`
- **Library:** Custom wrapper around HTML5 video + hls.js for adaptive streaming
- **Controls:** Play/Pause, Seek bar with buffered indicator, Volume, Playback speed (0.5x–2x), Fullscreen, Picture-in-Picture, Captions toggle
- **Overlay:** Title, next lesson preview (last 10 seconds)
- **Keyboard:** Space (play/pause), ArrowLeft/Right (seek ±10s), ArrowUp/Down (volume), F (fullscreen), M (mute)
- **Progress sync:** Auto-save current time to backend every 5 seconds

---

## 5. Page Specifications

### 5.1 Landing Page (`/`)

**Objective:** Convert visitors into registered students within 60 seconds.

**Sections (top to bottom):**

1. **Hero Section**
   - Full viewport height (100vh), centered content
   - Background: Subtle animated gradient or high-quality educational imagery (overlay: `--color-primary` at 85% opacity)
   - Headline: "Master English with Confidence" (H1, white)
   - Subheadline: 2-line description of platform value (Body Large, white/80%)
   - CTAs: Primary "Start Learning" (accent button, large) + Secondary "Explore Courses" (outline button, white)
   - Trust indicators: "10,000+ students", "4.9/5 rating", "Expert instructors" (horizontal row below CTAs)
   - Scroll indicator: Animated chevron at bottom

2. **Services Section**
   - Section title: "Our Flagship Services" (H2)
   - Grid: 3 columns desktop, 1 column mobile
   - 7 service cards: Professional illustration (120px) + Title (H4) + 2-line description + "Learn More" link
   - Cards: White background, border, hover lift + shadow

3. **Featured Courses Section**
   - Section title: "Popular Courses" (H2) + "View All →" link
   - Horizontal scroll carousel (desktop: 4 visible, mobile: 1.5 visible with peek)
   - `CourseCard` components
   - Auto-scroll disabled; manual scroll with momentum

4. **How It Works**
   - 3-step horizontal timeline: Register → Learn → Master
   - Each step: Numbered circle + Icon + Title + Description
   - Connecting line between steps (desktop)

5. **Testimonials**
   - Section title: "What Our Students Say"
   - Carousel: Large quote text + Student photo (64px circle) + Name + Occupation
   - Auto-advance every 6 seconds, manual dots navigation
   - 5 testimonials minimum for credibility

6. **FAQ Section**
   - Accordion layout: Question (bold) → Expandable answer
   - 8–10 questions covering courses, payments, live classes, certificates, refunds, tech requirements
   - Smooth height animation on expand/collapse

7. **CTA Banner**
   - Full-width, `--color-primary` background
   - Text: "Ready to Transform Your English?" (H2, white)
   - Button: "Get Started for Free" (accent, large)

### 5.2 Course Catalog (`/courses`)

**Layout:** Sidebar filters (left, 280px) + Course grid (right)

**Sidebar Filters:**
- Search bar (sticky top)
- Categories (checkbox list with count badges)
- Difficulty (radio: Beginner, Intermediate, Advanced, All)
- Price (radio: Free, Paid, All)
- Rating (checkbox: 4★ & up, 3★ & up)
- Duration (range slider)
- Clear Filters button

**Main Area:**
- Result count + Sort dropdown (Popular, Newest, Price Low-High, Price High-Low, Highest Rated)
- Course grid: 3 columns desktop, 2 tablet, 1 mobile
- Pagination: Load more button (infinite scroll optional)
- Empty state: Illustration + "No courses match your filters" + Clear filters CTA

### 5.3 Course Detail (`/courses/[slug]`)

**Layout:** Two-column (left 65%, right 35% desktop), stacked mobile

**Left Column:**
- Breadcrumb: Home > Courses > [Category] > [Title]
- Video thumbnail with play overlay (promo video) or course trailer
- Title (H1) + Subtitle (Body Large, secondary)
- Meta row: Rating stars + count | Student count | Last updated | Language
- Tabs: Overview | Curriculum | Reviews | Instructor
  - **Overview:** Description, learning objectives (checklist), prerequisites, target audience
  - **Curriculum:** Module accordion → Lesson list with duration and preview icons
  - **Reviews:** Aggregate rating breakdown (1-5 star bars) + Review cards (pagination)
  - **Instructor:** Bio, photo, stats (courses, students, rating)

**Right Column (Sticky):**
- Price card: Original price (strikethrough) + Discounted price + "Buy Now" button (full width, accent)
- "Enroll for Free" button (if free)
- Includes: Lifetime access, Certificate of completion, Mobile access
- 30-Day Money-Back Guarantee badge
- Share buttons

**Bottom:** Related courses carousel

### 5.4 Student Dashboard (`/dashboard`)

**Layout:** Full-width content area, no sidebar (top nav only)

**Sections:**

1. **Welcome Card**
   - Full-width banner, `--color-primary` gradient background
   - Left: "Good morning, [First Name]! 👋" (H3, white) + Motivational subtext + Date
   - Right: Learning streak flame icon + "5-day streak" (future) or "Start your streak today!"

2. **Continue Learning**
   - Horizontal card: Course thumbnail (left, 200px) + Course title + Progress bar + "Resume" button + "X% Complete"
   - If no active course: "You haven't started a course yet" + Browse courses CTA

3. **My Courses Grid**
   - Tabs: In Progress | Completed | Not Started
   - 3-column grid of mini course cards (thumbnail + title + progress bar + last accessed)
   - "View All" link to `/my-courses`

4. **Upcoming Live Classes**
   - Horizontal scroll list
   - Card: Date badge (day + month) + Title + Time + Instructor avatar + "Join" button (enabled 15 min before) or countdown
   - Empty state: "No upcoming classes" + Browse live classes link

5. **Notifications Panel**
   - Latest 5 notifications with "View All" link
   - Inline mark-as-read functionality

6. **Recommended Courses**
   - "Because you enrolled in [Course]" or "Trending Now"
   - Horizontal scroll of `CourseCard` components

### 5.5 Learning Interface (`/my-courses/[courseId]`)

**Layout:** Three-pane layout (desktop), stacked (mobile)

**Left Sidebar (320px, collapsible):**
- Course header: Thumbnail (40px) + Title (truncated) + Overall progress ring
- Module list (accordion):
  - Module title + expand/collapse chevron + completion fraction (e.g., "2/5")
  - Lesson items:
    - Icon: Lock (locked) | Play circle (available) | Check circle (completed) | Pulse (currently playing)
    - Title + Duration
    - Active lesson: `--color-primary` left border, subtle background highlight
  - Resources section at module bottom (if any)

**Main Content Area (flexible):**
- Video player (16:9, max-height 70vh)
- Below video:
  - Lesson title (H3) + Completion checkbox ("Mark as Complete")
  - Lesson notes/description (rich text)
  - Resources list (downloadable files)
  - Navigation: "← Previous Lesson" | "Next Lesson →"

**Right Sidebar (280px, collapsible, desktop only):**
- Instructor mini-card: Avatar + Name + "View Profile" link
- Downloads: File list with size + download icon
- Discussion: Recent comments preview + "Open Discussion" button
- Bookmarks: Toggle bookmark for current timestamp
- My Notes: Quick-add text area (auto-saved)

**Mobile Adaptation:**
- Left sidebar becomes bottom sheet (swipe up)
- Right sidebar becomes tabs below video: Notes | Discussion | Downloads
- Video player supports fullscreen rotation

### 5.6 Branded Checkout (`/checkout/[courseId]`)

**Layout:** Two-column (left: order summary, right: payment form)

**Left Column (Order Summary):**
- Course thumbnail (120px) + Title + Instructor
- Price breakdown: Subtotal | Discount (if any) | Tax (if applicable) | **Total**
- Secure payment badges (SSL, PCI DSS)
- Money-back guarantee reminder

**Right Column (Payment Form):**
- Customer details (pre-filled from profile, editable): Full name, Email, Phone
- Payment method selector: Card (default), Mobile Money, Bank Transfer (configurable per region)
- Card form: Number, Expiry, CVV, Name on card (if card selected)
- "Pay [Amount]" button (full width, accent, loading state during processing)
- Terms agreement checkbox

**Success State:**
- Full-screen confirmation: Checkmark animation + "Payment Successful!"
- Course access card: "Start Learning Now" button + "Go to Dashboard" link
- Email confirmation notice

**Failure State:**
- Inline error message with specific reason (e.g., "Insufficient funds", "Card declined")
- "Try Again" button + "Change Payment Method" option

### 5.7 Live Class Portal (`/live-classes` & `/live-classes/[id]/join`)

**Listing Page (`/live-classes`):**
- Tabs: Upcoming | Past
- Filter: Date range, Category, Instructor
- Card: Banner image + Title + Date/Time (with timezone) + Duration + Instructor + Price/Free badge + Capacity indicator (e.g., "12/30 spots left") + Register/Join button

**Join Page (`/live-classes/[id]/join`):**
- Pre-join screen (5 min before start): Countdown timer + Class details + "Waiting for host…" + Tech check (camera/mic test if integrated)
- Active state: Embedded video conference (Jitsi/Zoom SDK/custom WebRTC) or external link launcher
- Post-class: Recording availability notice (if applicable) + "Rate this class" prompt

### 5.8 Profile & Settings (`/profile`)

**Tabs:** Profile | Account | Notifications | Privacy

**Profile Tab:**
- Avatar upload (drag-drop or click, max 2MB, preview crop)
- Form fields: Full name, Email (read-only if verified), Phone, Country (dropdown), Timezone (auto-detect + manual), Biography (textarea, 500 chars), Learning goals (tag input)
- "Save Changes" button (disabled until dirty)

**Account Tab:**
- Change password: Current | New | Confirm
- Linked accounts: Google (connect/disconnect)
- Danger zone: Delete account (requires confirmation + password)

**Notifications Tab:**
- Toggle list: Course updates, Live class reminders, Payment confirmations, Marketing emails, New course releases
- Delivery preference per type: In-app only | Email | Both

**Privacy Tab:**
- Profile visibility: Public | Students only | Private
- Activity sharing: Show courses on profile | Show achievements
- Data export: "Download my data" (GDPR compliance)

---

## 6. State Management

### 6.1 Global State (Zustand)

```typescript
// stores/authStore.ts
interface AuthState {
  user: Student | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginDTO) => Promise<void>;
  logout: () => void;
  updateProfile: (data: ProfileUpdateDTO) => Promise<void>;
}

// stores/cartStore.ts (future)
interface CartState {
  items: CourseItem[];
  addItem: (course: Course) => void;
  removeItem: (courseId: string) => void;
  clearCart: () => void;
  total: number;
}

// stores/uiStore.ts
interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}
```

### 6.2 Server State (React Query / TanStack Query)

```typescript
// hooks/useCourses.ts
export const useCourses = (filters: CourseFilters) =>
  useQuery({
    queryKey: ['courses', filters],
    queryFn: () => fetchCourses(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

// hooks/useCourseProgress.ts
export const useCourseProgress = (courseId: string) =>
  useQuery({
    queryKey: ['progress', courseId],
    queryFn: () => fetchProgress(courseId),
    refetchInterval: 30000, // Poll every 30s for sync
  });

// hooks/useNotifications.ts
export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 60000,
  });
```

### 6.3 Local State
- Form inputs (React Hook Form)
- UI toggles (sidebar, modals, dropdowns)
- Video player state (currentTime, playbackRate, volume)
- Video playback state (currentTime, playbackRate, volume, buffering)

---

## 7. API Integration Patterns

### 7.1 Authentication Flow
```
1. User submits credentials → POST /api/auth/login
2. Backend returns JWT (access + refresh tokens)
3. Access token stored in httpOnly cookie (or memory)
4. Refresh token stored in httpOnly cookie
5. Axios interceptor attaches Bearer token to requests
6. On 401: Attempt silent refresh → retry request or redirect to login
7. On refresh failure: Clear auth state → redirect to /login with returnUrl
```

### 7.2 Video Streaming & Resource Delivery
```
1. Student opens lesson → GET /api/courses/{courseId}/lessons/{lessonId}
2. Backend returns lesson metadata including:
   - videoUrl (HLS manifest or direct MP4)
   - resources[] (signed download URLs)
   - lastWatchedPosition (timestamp in seconds)
3. Video Player loads HLS manifest → Adaptive bitrate streaming
4. Progress tracking:
   - Debounced PATCH /api/progress every 5 seconds
   - Payload: { lessonId, currentTime, completed: boolean }
5. Resource download:
   - Student clicks download → GET /api/resources/{resourceId}/download
   - Backend generates signed URL (15-min expiry)
   - Browser initiates download
6. Resume on return:
   - GET /api/progress/{courseId} → Returns last position per lesson
   - Video player seeks to timestamp automatically
```

### 7.3 Real-Time Features (Future)
- **Live Class:** WebRTC or embedded Zoom/Jitsi SDK
- **Notifications:** Server-Sent Events (SSE) or WebSocket for instant delivery
- **Progress Sync:** Debounced PATCH requests (every 5s) + optimistic UI updates

---

## 8. Responsive Breakpoints

| Name | Width | Target |
|---|---|---|
| `xs` | < 480px | Small mobile phones |
| `sm` | 480px – 767px | Large mobile phones |
| `md` | 768px – 1023px | Tablets |
| `lg` | 1024px – 1279px | Small laptops |
| `xl` | 1280px – 1535px | Desktops |
| `2xl` | ≥ 1536px | Large monitors |

### Key Responsive Behaviors
- **Navbar:** Full links (lg+) → Hamburger (md and below)
- **Course Grid:** 4 columns (xl) → 3 (lg) → 2 (md) → 1 (sm)
- **Learning Interface:** 3-pane (lg+) → Sidebar drawers (md) → Bottom sheets (sm)
- **Dashboard:** Multi-column grids collapse to single column below md
- **Font sizes:** Scale down 15–25% on mobile per typography scale

---

## 9. Accessibility Requirements

### 9.1 Keyboard Navigation
- All interactive elements reachable via Tab
- Logical tab order (top-to-bottom, left-to-right)
- Escape closes modals, dropdowns, and sidebars
- Space/Enter activates buttons and links
- Arrow keys navigate within menus, tabs, and carousels

### 9.2 Screen Reader Support
- Semantic HTML5 elements (`<nav>`, `<main>`, `<article>`, `<aside>`)
- ARIA labels for icon-only buttons
- `aria-expanded` for accordions and dropdowns
- `aria-live="polite"` for toast notifications and dynamic content
- Skip-to-content link for keyboard users

### 9.3 Visual Accessibility
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text
- Focus indicators: 2px solid outline, offset 2px, `--color-primary`
- No information conveyed by color alone (icons + text for status)
- Respect `prefers-reduced-motion`: Disable animations, instant transitions

### 9.4 Video Accessibility
- All videos include captions (VTT format)
- Transcripts available below video player
- Keyboard controls for all player functions
- High-contrast control icons

---

## 10. Performance Budgets

| Metric | Target | Maximum |
|---|---|---|
| First Contentful Paint (FCP) | < 1.0s | 1.5s |
| Largest Contentful Paint (LCP) | < 2.0s | 2.5s |
| Time to Interactive (TTI) | < 2.5s | 3.5s |
| Cumulative Layout Shift (CLS) | < 0.05 | 0.1 |
| Total Blocking Time (TBT) | < 200ms | 350ms |
| First Input Delay (FID) | < 50ms | 100ms |
| Lighthouse Performance Score | ≥ 95 | 90 |

### Optimization Strategies
- **Images:** Next.js `<Image>` with WebP/AVIF, lazy loading, blur placeholder
- **Videos:** HLS adaptive streaming, poster images, lazy load below fold
- **Code:** Route-based code splitting, tree shaking, dynamic imports for heavy components
- **Fonts:** `font-display: swap`, preload critical font weights
- **Caching:** SWR for server state, localStorage for user preferences
- **CDN:** Static assets served via edge CDN

---

## 11. Error Handling & Empty States

### 11.1 Global Error Boundary
- Catches React rendering errors
- Displays friendly "Something went wrong" page
- "Reload page" button + "Contact support" link
- Error logging to monitoring service (Sentry)

### 11.2 Network Error Patterns
- **Retry:** Auto-retry failed GET requests (3 attempts, exponential backoff)
- **Offline:** Service Worker caches critical pages; "You are offline" banner
- **Timeout:** Requests timeout after 10s; show "Taking longer than expected…"

### 11.3 Empty States
| Context | Visual | Message | CTA |
|---|---|---|---|
| No courses enrolled | Empty folder illustration | "You haven't enrolled in any courses yet." | "Browse Courses" |
| No search results | Magnifying glass illustration | "No courses match your search." | "Clear Filters" |
| No notifications | Bell illustration | "You're all caught up!" | — |
| No live classes | Calendar illustration | "No upcoming live classes." | "View Schedule" |
| Cart empty | Shopping bag illustration | "Your cart is empty." | "Explore Courses" |

---

## 12. Third-Party Integrations

| Service | Purpose | Integration Point |
|---|---|---|
| **Stripe / Paystack / Flutterwave** | Payment processing | Checkout page, webhook handlers |
| **Google OAuth 2.0** | Social authentication | Login/Register modal |
| **Cloudinary / AWS S3** | Media storage & delivery | Video streaming, image optimization |
| **Jitsi Meet / Zoom SDK** | Live video classrooms | Live class join page |
| **SendGrid / AWS SES** | Transactional emails | Backend-triggered (welcome, receipts) |
| **Sentry** | Error monitoring | Global error boundary |
| **Google Analytics 4** | User behavior analytics | Page views, events, conversions |
| **Hotjar** | Heatmaps & session recordings | Landing pages, checkout flow |

---

## 13. File Structure

```
grammarcetamol-student-interface/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group (no nav/footer)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── verify-email/page.tsx
│   ├── (public)/                 # Public pages (with nav/footer)
│   │   ├── page.tsx              # Landing page
│   │   ├── courses/page.tsx
│   │   ├── courses/[slug]/page.tsx
│   │   ├── services/page.tsx
│   │   ├── services/[slug]/page.tsx
│   │   ├── about/page.tsx
│   │   ├── blog/page.tsx
│   │   ├── blog/[slug]/page.tsx
│   │   ├── faq/page.tsx
│   │   ├── contact/page.tsx
│   │   └── testimonials/page.tsx
│   ├── (student)/                # Protected student routes
│   │   ├── dashboard/page.tsx
│   │   ├── my-courses/page.tsx
│   │   ├── my-courses/[courseId]/page.tsx
│   │   ├── live-classes/page.tsx
│   │   ├── live-classes/[id]/join/page.tsx
│   │   ├── coaching/page.tsx
│   │   ├── coaching/[bookingId]/page.tsx
│   │   ├── notifications/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── transactions/page.tsx
│   │   └── settings/page.tsx
│   ├── checkout/
│   │   ├── [courseId]/page.tsx
│   │   └── success/page.tsx
│   ├── api/                      # Next.js API routes (proxies, webhooks)
│   ├── layout.tsx                # Root layout (providers, fonts, metadata)
│   ├── globals.css               # Tailwind directives + custom properties
│   └── loading.tsx               # Global loading UI
│
├── components/
│   ├── layout/                   # Navbar, Footer, Sidebar, PageHeader
│   ├── ui/                       # Reusable primitives (Button, Input, Modal, Toast)
│   ├── course/                   # CourseCard, CourseGrid, CurriculumAccordion
│   ├── learning/                 # VideoPlayer, LessonSidebar, ProgressTracker
│   ├── dashboard/                # StatCard, WelcomeBanner, ContinueLearning
│   ├── checkout/                 # OrderSummary, PaymentForm, CheckoutSuccess
│   └── forms/                    # Form wrappers, validation schemas
│
├── hooks/                        # Custom React hooks
│   ├── useAuth.ts
│   ├── useCourses.ts
│   ├── useProgress.ts
│   ├── useNotifications.ts
│   ├── useMediaQuery.ts
│   ├── useVideoPlayer.ts
│   └── useProgressSync.ts
│
├── stores/                       # Zustand stores
│   ├── authStore.ts
│   ├── uiStore.ts
│   └── cartStore.ts
│
├── lib/                          # Utilities, constants, types
│   ├── api.ts                    # Axios instance + interceptors
│   ├── utils.ts                  # cn() helper, formatters
│   ├── constants.ts              # App-wide constants
│   └── types/                    # TypeScript interfaces
│       ├── auth.ts
│       ├── course.ts
│       ├── user.ts
│       └── payment.ts
│
├── public/                       # Static assets
│   ├── images/
│   ├── icons/
│   └── fonts/
│
├── styles/
│   └── animations.css            # Custom keyframes
│
├── middleware.ts                 # Auth guard, route protection
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 14. Security Considerations

- **XSS Prevention:** All user-generated content sanitized via DOMPurify; React's built-in escaping for JSX
- **CSRF Protection:** SameSite cookies, CSRF tokens for state-changing operations
- **Clickjacking:** X-Frame-Options: DENY, CSP frame-ancestors directive
- **Content Security Policy:** Strict CSP headers allowing only trusted script sources
- **Sensitive Data:** No API keys or secrets exposed in client bundles; env vars prefixed with `NEXT_PUBLIC_` only for non-sensitive values
- **Payment Security:** PCI DSS compliance via tokenized payment flows (never handle raw card data)

---

> **End of Document**
