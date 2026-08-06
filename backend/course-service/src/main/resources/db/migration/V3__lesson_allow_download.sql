-- ============================================================
-- Migration: V3__lesson_allow_download.sql
-- Service: Course Service
-- ============================================================
-- Lesson resources (PDFs, images, documents) are view-only by default — the student frontend
-- renders them inline (iframe/img) but doesn't offer a download/open-in-new-tab affordance
-- unless the instructor explicitly opts a lesson into it. Applies to any lesson with an attached
-- file, not just a specific file type.

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS allow_download BOOLEAN NOT NULL DEFAULT false;
