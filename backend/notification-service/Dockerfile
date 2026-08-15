# Build context: backend/notification-service/
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

EXPOSE 9008
CMD ["node", "dist/main"]
