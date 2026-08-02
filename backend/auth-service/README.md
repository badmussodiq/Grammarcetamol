# auth-service

Handles user registration, email verification, login/logout, token refresh, password reset, and gRPC token validation.

## How to run locally

1. Start PostgreSQL, Redis, and RabbitMQ (Docker recommended).
2. Create database `auth_db`.
3. Generate RSA keys (see below).
4. Copy `.env.example` to `.env` and adjust values.
5. Run: `./mvnw spring-boot:run`

Flyway migrations run automatically on startup.

## Generate RSA keys

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Place `private.pem` and `public.pem` in `src/main/resources/keys/`.
**Never commit these files to git.**

## Ports

- REST: 8081
- gRPC: 9091
