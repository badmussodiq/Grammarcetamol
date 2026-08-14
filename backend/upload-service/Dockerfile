# Build context: backend/upload-service/
# npm install, not npm ci — package-lock.json is intentionally not committed (see
# .gitignore), and npm ci requires one to exist.
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
# SQL migrations, read from disk at startup (migration-runner.ts scans db/migration/),
# not bundled into dist/ by `nest build` — must be copied separately.
COPY db/ ./db/

EXPOSE 9006
CMD ["node", "dist/main"]
