-- Course DB initial schema (Flyway V1)
-- Adapted from database-schema-and-migrations.md §3.3, with two fixes:
--   1. `CREATE TYPE lesson_type AS (...)` in the spec is invalid Postgres (that's
--      composite-type syntax, not enum syntax). lessons.type uses VARCHAR + CHECK
--      instead, consistent with courses.status / courses.difficulty below, and
--      consistent with why auth_db avoided native Postgres enums for JDBC bind
--      parameters (see backend/auth-service/README.md).
--   2. courses gains instructor_name / instructor_bio / instructor_avatar_url —
--      there is no instructor directory/role yet (see PLAN.md Phase 2 status note).
-- Also adds courses.slug (not in the spec) — needed for the /courses/[slug]
-- route on the student frontend; generated from title at creation time.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    icon_url        VARCHAR(500),
    parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                VARCHAR(280) NOT NULL UNIQUE,
    instructor_id       UUID NOT NULL,  -- creating admin/moderator's auth_db user id (audit only, not a real instructor entity yet)
    instructor_name     VARCHAR(255) NOT NULL,
    instructor_bio       TEXT,
    instructor_avatar_url VARCHAR(500),
    title               VARCHAR(255) NOT NULL,
    subtitle            VARCHAR(500),
    description         TEXT NOT NULL,
    learning_objectives TEXT[] NOT NULL DEFAULT '{}',
    target_audience     TEXT,
    prerequisites       TEXT,
    category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
    difficulty          VARCHAR(20) NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    language            VARCHAR(10) NOT NULL DEFAULT 'en',
    estimated_duration  INT,  -- minutes
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'review', 'published', 'archived')),
    price               DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount_price      DECIMAL(10,2),
    discount_expires_at TIMESTAMPTZ,
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    cover_image_url     VARCHAR(500),
    promo_video_url     VARCHAR(500),
    enrollment_count    INT NOT NULL DEFAULT 0,
    avg_rating          DECIMAL(2,1) CHECK (avg_rating >= 0 AND avg_rating <= 5),
    review_count        INT NOT NULL DEFAULT 0,
    version             INT NOT NULL DEFAULT 1,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_category_id ON courses(category_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_difficulty ON courses(difficulty);
CREATE INDEX IF NOT EXISTS idx_courses_price ON courses(price);
CREATE INDEX IF NOT EXISTS idx_courses_published_at ON courses(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_courses_search ON courses USING gin(to_tsvector('english', title || ' ' || COALESCE(subtitle, '') || ' ' || COALESCE(description, '')));

-- Course versions (audit / rollback)
CREATE TABLE IF NOT EXISTS course_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    version         INT NOT NULL,
    snapshot        JSONB NOT NULL,  -- full course snapshot
    changed_by      UUID NOT NULL,
    change_summary  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, version)
);

CREATE INDEX IF NOT EXISTS idx_course_versions_course_id ON course_versions(course_id);

-- Modules
CREATE TABLE IF NOT EXISTS modules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    position        INT NOT NULL DEFAULT 0,
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_position ON modules(course_id, position);

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    type            VARCHAR(20) NOT NULL DEFAULT 'video'
                        CHECK (type IN ('video', 'text', 'quiz', 'resource')),
    duration        INT,  -- seconds
    position        INT NOT NULL DEFAULT 0,
    video_url       VARCHAR(500),
    video_metadata  JSONB,  -- resolution, codec, etc. — populated once Media Service exists
    is_preview      BOOLEAN NOT NULL DEFAULT FALSE,
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lessons_position ON lessons(module_id, position);
CREATE INDEX IF NOT EXISTS idx_lessons_type ON lessons(type);

-- Resources (lesson attachments)
CREATE TABLE IF NOT EXISTS resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    file_name       VARCHAR(255) NOT NULL,
    file_type       VARCHAR(50) NOT NULL,  -- pdf, docx, etc.
    file_size       BIGINT NOT NULL,       -- bytes
    file_url        VARCHAR(500) NOT NULL,
    mime_type       VARCHAR(100),
    checksum        VARCHAR(64),
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_lesson_id ON resources(lesson_id);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50) NOT NULL UNIQUE,
    slug            VARCHAR(50) NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_tags (
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_course_tags_tag_id ON course_tags(tag_id);

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_courses_updated_at') THEN
        CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_modules_updated_at') THEN
        CREATE TRIGGER trg_modules_updated_at BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lessons_updated_at') THEN
        CREATE TRIGGER trg_lessons_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Seed default categories so the catalog isn't empty on first boot
INSERT INTO categories (name, slug, description, sort_order) VALUES
    ('English for Beginners', 'english-for-beginners', 'Foundational English courses for new learners', 1),
    ('Business English', 'business-english', 'Professional communication and workplace English', 2),
    ('IELTS & TOEFL Prep', 'ielts-toefl-prep', 'Exam preparation for standardized English tests', 3),
    ('Conversation Practice', 'conversation-practice', 'Speaking and listening fluency courses', 4),
    ('Grammar & Writing', 'grammar-writing', 'Grammar rules and written communication skills', 5)
ON CONFLICT (slug) DO NOTHING;
