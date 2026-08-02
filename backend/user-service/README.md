# user-service

Manages user profiles. Consumes RabbitMQ `user.created` events from auth-service.

## Important: Gateway-Only Access

**This service cannot be called directly.** All requests must come through the API Gateway (`gateway-service`), which injects the `X-Internal-Token` header. Direct calls without this header return `403 Forbidden`.

## How to run locally

1. Start PostgreSQL and RabbitMQ.
2. Create database `user_db`.
3. Copy `.env.example` to `.env` and adjust values.
4. Install dependencies: `npm install`
5. Run: `npm run start:dev`

TypeORM migrations run automatically on startup.

## Ports

- REST: 8082

## Headers injected by Gateway

| Header | Description |
|---|---|
| `X-Internal-Token` | Must match `INTERNAL_TOKEN` env var |
| `X-User-Id` | Authenticated user's UUID |
| `X-User-Role` | Comma-separated roles |
| `X-User-Email` | User email |
