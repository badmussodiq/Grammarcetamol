# Build context: backend/payment-service/
# npm install, not npm ci — package-lock.json is intentionally not committed (see
# .gitignore), and npm ci requires one to exist.
FROM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:24-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
# SQL migrations, read from disk at startup (migration-runner.ts scans db/migration/),
# not bundled into dist/ by `nest build` — must be copied separately.
COPY db/ ./db/

EXPOSE 9005
CMD ["node", "dist/main"]
