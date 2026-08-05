# @grammarcetamol/utilities

Shared React library for the student and admin frontends — components, hooks, a toast system, and a fetch client. Consumed as raw TypeScript source (no build step) by both apps.

## Why this isn't a normal npm dependency

There's no root `package.json` / npm workspaces in this repo — `Grammarcetamol/` is a plain container folder, not a project (see the root README). So `apps/admin` and `apps/student` don't `npm install` this package; instead each app's `tsconfig.json` maps the specifier directly to source:

```json
"paths": {
  "@grammarcetamol/utilities": ["../utilities/src/index.ts"],
  "@grammarcetamol/utilities/*": ["../utilities/src/*"]
}
```

and `next.config.mjs` sets `turbopack: { root: path.resolve(__dirname, '..') }` so Turbopack — which refuses to resolve files outside its auto-detected project root — is told the boundary includes this sibling package too. (An explicit `turbopack.resolveAlias` pointing at an absolute Windows path was tried first and hit a real Turbopack bug — "windows imports are not implemented yet" — before `root` turned out to be the right fix.)

One consequence: **this package has its own `node_modules`** (react, react-dom, typescript, vitest, etc. as its own installs) purely so `tsc`/the IDE can typecheck it standalone — a file physically outside `apps/admin` or `apps/student` can't walk up into either app's `node_modules` for type resolution. This does *not* create a duplicate-React-at-runtime risk: actual bundling still happens inside each consuming app's own webpack/Turbopack build, which resolves `react` from *that app's* `node_modules`.

```bash
npm install   # only needed for standalone `npx tsc --noEmit` / `npx vitest run` here
```

## What's in it

**Components** (`src/components/`): `Button`, `Input`, `Modal`, `Toast` / `ToastContainer`, `Badge`, `Skeleton`, `Spinner`, `Tabs`, `Dropdown`, `ProgressBar`, `Mapping`. Plus `ToastRenderer`, a small composite wiring `ToastContext` to `ToastContainer`.

**Hooks** (`src/hooks/`):
- `useFormState` — controlled-form state with per-field errors, used by every auth form in both apps.
- `useFetch` — `{ data, loading, error, refetch }` around `apiFetch`.
- `useGenericState` — `useState` with two extras: `updateState(key, value)` patches a single key of object state without spreading the rest yourself (falls back to whole-value replace for non-plain-object state — arrays included, deliberately, since `typeof [] === 'object'` would otherwise misroute them into key-based updates); `replaceState(value)` always replaces the whole value. Both setters are referentially stable across renders.

**`Mapping`** deserves a callout: it deliberately has **no** `'use client'` and **no** `useMemo`, even though it looks like it should have both. A render-prop `children` function can't cross a Server → Client component boundary (React can't serialize a function across it), so the moment this needed `'use client'` it broke the admin `/users` page, which is a Server Component. Dropping the hook makes it a plain universal component usable from both Server and Client Components — and the memoization bought little anyway, since `children` is almost always a fresh inline closure per render.

**Contexts** (`src/contexts/`): `ToastContext` / `ToastProvider` / `useToast`.

**Lib** (`src/lib/`): `apiFetch` / `ApiError` — fetch wrapper with `credentials: 'include'` and a single 401-triggered refresh-and-retry.

**Tokens** (`src/tokens/`): `colors`, `shadows`, `borderRadius`, `transitions` as plain JS constants, plus a `tokens.css` file — these predate the apps' Tailwind v4 migration and are mostly superseded by each app's own `@theme` block in `globals.css` now; kept for any code still importing the JS constants directly.

## Tests

```bash
npm test   # vitest run
```

Covers `useFetch`, `useGenericState`, and `Mapping`. Components that are thin, mostly-styling wrappers (`Button`, `Input`, etc.) don't have dedicated tests; the two hooks and `Mapping` do because they carry real logic (type-dispatch branching, Server/Client-boundary constraints).
