# Build context: backend/upload-service/
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# SQL migrations, read from disk at startup (migration-runner.ts scans db/migration/),
# not bundled into dist/ by `nest build` — must be copied separately.
COPY db/ ./db/

EXPOSE 9006
CMD ["node", "dist/main"]
