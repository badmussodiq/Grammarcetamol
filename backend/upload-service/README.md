# upload-service

Node.js / NestJS. Resumable chunked upload sessions for course video/resource files, with
presigned direct-to-storage uploads (never proxied through this service) and a pluggable
object-storage backend (MinIO today, real S3 later, both at once if you want).

Reachable via the gateway at `/api/uploads/**`, or directly on `:8087` in dev.

## Conventions copied from payment-service

This is the second NestJS service in the repo (after `payment-service`), so it copies that
service's established conventions rather than inventing new ones:

- **No ORM** — a thin `pg` client + the identical hand-rolled migration runner
  (`src/config/migration-runner.ts`), same `V<n>__<description>.sql` file convention as every
  Java service's Flyway migrations.
- **Header-trust identity** — `src/common/current-user.decorator.ts` reads `X-User-Id`/`X-User-Role`,
  set by the gateway's `JwtAuthFilter` after it's already validated the JWT. This service never
  sees or validates a raw token.
- **Response envelope** — `src/common/api-response.ts` / `all-exceptions.filter.ts` produce the
  same `{success, data, error, timestamp}` shape every Java service returns.
- **RabbitMQ, publish-only** — raw `amqplib` (not `@nestjs/microservices`), one topic exchange
  (`upload.exchange`), `<domain>.<event>` routing keys.

## Storage provider abstraction

Object storage is behind a `StorageProvider` interface (`src/storage/`), mirroring
`payment-service`'s `PaymentProvider` pattern:

- `S3CompatibleStorageProvider` — one class, backed by `@aws-sdk/client-s3`. MinIO and real AWS
  S3 both speak the S3 API, so the only real difference between "the MinIO provider" and "the S3
  provider" is which endpoint/credentials it's constructed with.
- `StorageProviderRegistry` registers `minio` always, and auto-registers `s3` the instant
  `AWS_ACCESS_KEY_ID` is set — no code change to add a second backend, just config.
- **Every `upload_files` row records its own `storage_provider`/`storage_bucket`/`storage_path`
  at creation time and never changes it.** `STORAGE_PROVIDER` only decides where *brand-new*
  uploads go; resuming, completing, or (eventually) downloading an existing file always resolves
  via whichever provider its own row says, never via "whatever's active today." This is how MinIO
  and S3 can coexist indefinitely — old files keep working on MinIO even after new uploads switch
  to S3, with zero migration required unless you explicitly want to move old objects too.
- The DB never stores a resolved URL — URLs (especially presigned ones) expire and are
  meaningless to persist. Only `(provider, bucket, key)` is stored; every signed URL is minted
  fresh, per request, from the provider that record names.

## Chunked upload flow

Chunks are S3/MinIO **multipart upload parts**, not a homemade reassembly scheme — that's why the
chunk size is fixed at 5MB (S3's own multipart minimum part size for anything but the last part).

1. `POST /api/uploads/sessions` — admin submits `{courseId, files: [{fileName, fileSize, ...}]}`.
   Course title is looked up server-side via `course-service` (never trust a client-supplied
   name). For each file: creates a multipart upload on the active storage provider, computes the
   chunk plan, and returns the full session + per-file + per-chunk plan in one response.
2. `GET /api/uploads/files/:fileId/chunks/:chunkIndex/presign` — a short-lived (15 min) signed PUT
   URL for that exact part. The browser PUTs the chunk bytes **directly** to MinIO/S3 using this
   URL — never through this service. Also the retry/resume endpoint: call it again for any chunk
   that isn't `completed` yet (after a failed PUT, or after reopening the browser mid-upload) and
   you get a fresh signed URL for the same part.
3. `PATCH /api/uploads/files/:fileId/chunks/:chunkIndex/complete` — client reports the part's ETag
   (read off the PUT response). Chunk/file/session byte counters update atomically (concurrent
   chunk completions are expected, not an edge case).
4. `POST /api/uploads/files/:fileId/complete` — once every chunk is in, finalizes the multipart
   upload on object storage (this is the point a real, retrievable object exists) and publishes
   `upload.file.completed` — the event `media-service` (not built yet — Task 17) will eventually
   consume to trigger transcoding.
5. `PATCH /api/uploads/files/:fileId/fail` — client gives up after its own retry/backoff loop;
   aborts the multipart upload on object storage (no orphaned storage cost) and publishes
   `upload.failed`.

## Known gotcha found during live verification

None yet beyond what's already documented above — the full flow (session → presign → real PUT to
MinIO → complete chunk ×2 → complete file → re-fetch session → independent HeadObject check
against MinIO) passed clean on first live run, see `e2e/upload-flow.e2e.ts`.

## How to run locally

1. Start infra: `docker compose -f ../../docker/docker-compose.dev.yml up -d` (this brings up
   MinIO too — S3 API on `:9002`, console on `:9003`, creds `platform`/`platform12345`).
2. `upload_db` must exist:
   ```bash
   docker exec grammarcetamol-postgres psql -U platform -d auth_db -c "CREATE DATABASE upload_db;"
   ```
3. `cp .env.example .env` (defaults already match the compose file — nothing to fill in for
   MinIO-only dev).
4. `npm install`
5. `npm run start:dev`

## Endpoints

| Method & path | Auth | Notes |
|---|---|---|
| `POST /api/uploads/sessions` | `SUPER_ADMIN` or `MODERATOR` | Creates a session + per-file multipart upload + chunk plan |
| `GET /api/uploads/sessions/:id` | `SUPER_ADMIN` or `MODERATOR` | Full session/file/chunk status — for resume-after-crash |
| `GET /api/uploads/files/:fileId/chunks/:chunkIndex/presign` | `SUPER_ADMIN` or `MODERATOR` | Signed PUT URL for one part; also the retry/resume call |
| `PATCH /api/uploads/files/:fileId/chunks/:chunkIndex/complete` | `SUPER_ADMIN` or `MODERATOR` | Body `{etag}` |
| `POST /api/uploads/files/:fileId/complete` | `SUPER_ADMIN` or `MODERATOR` | Finalizes the multipart upload |
| `PATCH /api/uploads/files/:fileId/fail` | `SUPER_ADMIN` or `MODERATOR` | Body `{errorCode?, errorMessage}` — aborts the multipart upload |

Not owner-scoped — any admin/moderator can see or manage any course's upload session, matching
how any admin can already edit any course.

## Events

Publishes to `upload.exchange` (topic, durable): `upload.session.started`,
`upload.chunk.completed`, `upload.file.completed`, `upload.failed`. `upload.file.completed`'s
payload is a real cross-service contract — it's what `media-service` will read to know which
object to transcode.

## Config

See `.env.example`. Notable vars: `STORAGE_PROVIDER` (which backend new uploads go to —
`minio` today), `STORAGE_BUCKET`, `MINIO_ENDPOINT`/`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`, and the
commented-out `AWS_*` vars that register a second `s3` provider the moment they're filled in.

## Tests

`npm test` — 23 unit tests (`src/uploads/uploads.service.spec.ts`), one consolidated file
covering session creation (including chunk-splitting math and the course-lookup/rollback paths),
resume/retry semantics, atomic byte-counter updates, multipart completion (including the
"session only completes once every file does" convergence logic), and failure/abort handling. The
`pg` `Pool` and `StorageProvider` are mocked directly (no test-double library), same style as
`payment-service`'s tests.

`npm run test:e2e` — a from-scratch end-to-end script (no prior harness like this existed anywhere
in the repo to mirror) that exercises the entire real flow against the actually-running stack:
real gateway JWT auth, a real `course-service` lookup, a real multipart upload against a real
MinIO instance, real presigned URLs actually PUT to, and an independent `HeadObjectCommand` check
against MinIO itself (bypassing this service entirely) to prove the object really exists with the
right size — not just that this service's own DB believes it does. Requires the full stack up and
a real admin login; not run as part of `npm test`.
