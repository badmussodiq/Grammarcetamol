# @grammarcetamol/student

Public/student-facing portal — Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, TypeScript 7.

Full target design is in [`/student-frontend.md`](../../student-frontend.md). This README covers what's actually implemented and how to run it.

## Implemented

- **Auth**: `/register` (with inline password-strength feedback), `/login`, `/forgot-password`, `/reset-password`, `/verify-email`. Staff credentials are rejected on `/login` even though they authenticate fine against the backend — this portal is students-only.
- Everything past auth (landing page content beyond the placeholder hero, course catalog, dashboard, learning interface, live classes, checkout, etc. — see `student-frontend.md`) is spec only, not built.

## Run locally

Requires the backend gateway + auth-service running (see the root README and `backend/*/README.md`) and Node 20+.

```bash
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, defaults to the gateway at :9000
npm run dev      # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint` (ESLint flat config).

## Notable structure

```
app/(auth)/login, register, forgot-password, reset-password, verify-email/   All client components
contexts/AuthContext.tsx     Auth state + login/logout; rejects cross-portal logins (staff -> here)
lib/auth.api.ts              Typed fetch wrapper around the gateway's REST API
proxy.ts                     Route guard for protected paths (dashboard, my-courses, etc. — mostly
                              not built yet) — Next 16 renamed `middleware.ts` to this
```

## Shared code

Anything reusable across both frontends — UI primitives, `apiFetch`, `useFormState`, `useFetch`, `useGenericState`, `Mapping`, toast plumbing — lives in [`@grammarcetamol/utilities`](../utilities/README.md), a sibling package pulled in via a `tsconfig.json` path mapping and `turbopack.root` (not an npm dependency — see that package's README for why).

## Design tokens

Tailwind v4, CSS-first: theme colors/radius/shadows/fonts live in `app/globals.css`'s `@theme` block (student's accent is a warm `#F59E0B` — distinct from the admin app's cooler `#0EA5E9`). No `tailwind.config.ts` — Tailwind v3's JS config was fully replaced by v4's `@theme`.
