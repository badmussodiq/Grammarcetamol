-- ============================================================
-- Migration: V2__lesson_upload_file_reference.sql
-- Service: Course Service
-- ============================================================
-- Lets a lesson reference a file uploaded through upload-service (video, or an attached
-- image/pdf for text/resource lessons) instead of (or alongside) an admin-pasted external
-- video_url. Deliberately just the bare upload_files.id — no storage_provider/bucket/path
-- duplicated here. Resolving that id into an actual signed playback/download URL is
-- enrollment-service's job at request time (it already owns the real enrollment check), via a
-- trusted internal call to upload-service — course-service never talks to object storage
-- directly and never needs to know which provider a given file lives on.

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS upload_file_id UUID;
