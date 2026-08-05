
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role            VARCHAR(64)  NOT NULL DEFAULT 'STUDENT',
    ADD COLUMN IF NOT EXISTS full_name       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS avatar_url      VARCHAR(512),
    ADD COLUMN IF NOT EXISTS country         VARCHAR(100),
    ADD COLUMN IF NOT EXISTS timezone        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bio             TEXT,
    ADD COLUMN IF NOT EXISTS learning_goals  TEXT[],
    ADD COLUMN IF NOT EXISTS date_of_birth   DATE,
    ADD COLUMN IF NOT EXISTS preferences     JSONB;

CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users (full_name);
