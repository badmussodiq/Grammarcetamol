# Build context: apps/ (student needs apps/utilities/src as a build-time sibling — its
# tsconfig `paths` aliases @grammarcetamol/utilities straight to ../utilities/src).
# npm install, not npm ci — package-lock.json is intentionally not committed (see
# .gitignore), and npm ci requires one to exist.
FROM node:24-alpine AS builder

WORKDIR /workspace
COPY utilities/ utilities/
COPY student/ student/

# apps/utilities is a sibling project with its OWN node_modules (see its README) — the
# student/admin frontends resolve its source files via a tsconfig path alias, but
# TypeScript still needs utilities' own react/@types/react etc. reachable via Node's
# directory-walk module resolution starting from utilities/src, not student's node_modules.
WORKDIR /workspace/utilities
RUN npm install

WORKDIR /workspace/student
RUN npm install

ARG NEXT_PUBLIC_API_URL=http://localhost:9000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:24-alpine

WORKDIR /app
# next.config.mjs sets turbopack.root to apps/, so the standalone output mirrors that
# monorepo layout — the runnable server.js lands at .next/standalone/student/server.js.
# @grammarcetamol/utilities is resolved via a tsconfig path alias straight to source, so
# the bundler inlines it directly — there's no separate utilities/ folder to copy.
COPY --from=builder /workspace/student/.next/standalone/student ./
COPY --from=builder /workspace/student/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
# Docker sets HOSTNAME to the container ID by default, and Next's standalone server.js
# binds to `process.env.HOSTNAME || '0.0.0.0'` — without this override it ends up bound
# to whatever IP /etc/hosts resolves the container ID to (reachable from the host via
# Docker's NAT, but NOT via localhost from inside the container, which breaks the
# Compose healthcheck). Force it to listen on all interfaces instead.
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
