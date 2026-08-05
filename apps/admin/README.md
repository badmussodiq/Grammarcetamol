# @grammarcetamol/admin

Internal admin/staff portal — Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, TypeScript 7.

Full target design is in [`/admin-frontend.md`](../../admin-frontend.md). This README covers what's actually implemented and how to run it.

## Implemented

- **Auth**: `/login` (staff-only — a student's credentials are rejected here even though they authenticate fine against the backend), `/forgot-password`, `/reset-password`. No `/register` — moderator/support accounts are provisioned by a super admin, not self-registered.
- **Dashboard shell**: `/dashboard` — welcome banner, stat card placeholders.
- **User management**: `/users` — server-rendered list of staff + student accounts with search and suspend/activate (a Server Action, no client JS needed for that mutation); `/users/create` — form for provisioning a `MODERATOR` or `CUSTOMER_SUPPORT` account.
- Everything past this (courses, revenue, service requests, support tickets, settings, logs — see `admin-frontend.md`) is spec only, not built.

## Run locally

Requires the backend gateway + auth-service running (see the root README and `backend/*/README.md`) and Node 20+.

```bash
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, defaults to the gateway at :8080
npm run dev      # http://localhost:3001
```

Other scripts: `npm run build`, `npm run lint` (ESLint flat config), `npm test` (Vitest).

## Notable structure

```
app/
├── (auth)/login, forgot-password, reset-password/     Client components
├── (dashboard)/dashboard/                              Client component (needs auth context)
└── (dashboard)/users/                                  page.tsx is a Server Component (SSR data fetch);
                                                          actions.ts holds the Server Action; create/ is client
contexts/AuthContext.tsx     Auth state + login/logout; rejects cross-portal logins
lib/auth.api.ts, users.api.ts  Typed fetch wrappers around the gateway's REST API
proxy.ts                     Route guard — Next 16 renamed `middleware.ts`; checks role from the
                              JWT payload (unverified, UX-only — the real enforcement is the
                              backend's @PreAuthorize checks), not just cookie presence
```

## Shared code

Anything reusable across both frontends — UI primitives, `apiFetch`, `useFormState`, `useFetch`, `useGenericState`, `Mapping`, toast plumbing — lives in [`@grammarcetamol/utilities`](../utilities/README.md), a sibling package pulled in via a `tsconfig.json` path mapping and `turbopack.root` (not an npm dependency — see that package's README for why, and for the Turbopack-on-Windows gotcha that shaped the setup).

## Design tokens

Tailwind v4, CSS-first: theme colors/radius/shadows/fonts live in `app/globals.css`'s `@theme` block (admin's accent is `#0EA5E9`, sidebar-dark palette — distinct from the student app's warmer `#F59E0B` accent). No `tailwind.config.ts` — Tailwind v3's JS config was fully replaced by v4's `@theme`.
