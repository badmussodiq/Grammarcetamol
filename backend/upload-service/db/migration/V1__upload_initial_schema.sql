-- ============================================================
-- Migration: V1__upload_initial_schema.sql
-- Service: Upload Service
-- ============================================================
-- database-schema-and-migrations.md §3.9 specifies `CREATE TYPE upload_status AS (...)` /
-- `CREATE TYPE chunk_status AS (...)` — invalid Postgres (that's composite-type syntax, not enum
-- syntax). Same spec mistake already found and fixed identically in every other service's
-- migration: plain VARCHAR + CHECK constraint instead of a native enum. Also corrects
-- upload_files' spec'd default of 'waiting', which isn't a valid value in the status list —
-- uses 'preparing' instead, matching upload_sessions.
--
-- storage_provider / storage_bucket / storage_path / storage_multipart_id are additions beyond
-- the original spec, needed to support more than one object-storage backend coexisting at once
-- (MinIO today, real S3 later) without ever losing track of which backend an already-uploaded
-- file actually lives on. See StorageProviderRegistry.

-- Upload sessions — one per "admin uploads N files for course X" batch.
CREATE TABLE IF NOT EXISTS upload_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID NOT NULL,
    course_name     VARCHAR(255) NOT NULL,
    admin_id        UUID NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'preparing'
                        CHECK (status IN ('preparing','uploading','paused','completed','failed','cancelled')),
    upload_token    VARCHAR(255) NOT NULL UNIQUE,
    chunk_size      INT NOT NULL DEFAULT 5242880,  -- 5MB — matches S3/MinIO multipart's own minimum part size
    max_concurrent  INT NOT NULL DEFAULT 5,
    total_files     INT NOT NULL DEFAULT 0,
    completed_files INT NOT NULL DEFAULT 0,
    failed_files    INT NOT NULL DEFAULT 0,
    total_bytes     BIGINT NOT NULL DEFAULT 0,
    uploaded_bytes  BIGINT NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_course_id ON upload_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_admin_id ON upload_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires_at ON upload_sessions(expires_at);

-- Files within a session — one per actual object being multipart-uploaded to object storage.
CREATE TABLE IF NOT EXISTS upload_files (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    lesson_id               UUID,
    file_name               VARCHAR(255) NOT NULL,
    file_size               BIGINT NOT NULL,
    file_type               VARCHAR(50) NOT NULL,
    mime_type               VARCHAR(100),
    status                  VARCHAR(20) NOT NULL DEFAULT 'preparing'
                                CHECK (status IN ('preparing','uploading','paused','completed','failed','cancelled')),
    progress                DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    uploaded_bytes          BIGINT NOT NULL DEFAULT 0,
    checksum                VARCHAR(64) NOT NULL,
    -- Which object-storage backend this specific file lives on, and everything needed to
    -- address it there — never a resolved URL (those expire / need per-request signing).
    -- Recorded once at creation and never changed afterward, even if STORAGE_PROVIDER's
    -- "current default" changes later — see StorageProviderRegistry.
    storage_provider        VARCHAR(20) NOT NULL,
    storage_bucket          VARCHAR(255) NOT NULL,
    storage_path            VARCHAR(500) NOT NULL,
    storage_multipart_id    VARCHAR(500),
    error_code              VARCHAR(50),
    error_message           TEXT,
    retry_count             INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_files_session_id ON upload_files(session_id);
CREATE INDEX IF NOT EXISTS idx_upload_files_lesson_id ON upload_files(lesson_id);
CREATE INDEX IF NOT EXISTS idx_upload_files_status ON upload_files(status);

-- Chunk tracking — one row per multipart "part" (S3/MinIO terminology), 1:1 with what the
-- frontend PUTs directly to object storage via a presigned URL.
CREATE TABLE IF NOT EXISTS upload_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id         UUID NOT NULL REFERENCES upload_files(id) ON DELETE CASCADE,
    chunk_index     INT NOT NULL,
    start_byte      BIGINT NOT NULL,
    end_byte        BIGINT NOT NULL,
    size            BIGINT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','uploading','completed','failed')),
    checksum        VARCHAR(64),
    -- S3/MinIO's own per-part integrity tag, returned on each chunk PUT and required (in order)
    -- to complete the multipart upload. `checksum` above is the client-computed SHA-256 the spec
    -- calls for — a separate, additional integrity record, not what object storage itself checks.
    etag            VARCHAR(255),
    retry_count     INT NOT NULL DEFAULT 0,
    uploaded_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (file_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_upload_chunks_file_id ON upload_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_upload_chunks_status ON upload_chunks(status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_upload_sessions_updated_at') THEN
        CREATE TRIGGER trg_upload_sessions_updated_at BEFORE UPDATE ON upload_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_upload_files_updated_at') THEN
        CREATE TRIGGER trg_upload_files_updated_at BEFORE UPDATE ON upload_files
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
