-- Task 39 (Phase 4): a generic one-time-item payment path alongside the existing course-
-- specific one — Live Class Service's ONE_TIME classes need to pay for something that isn't a
-- `courses` row, and payment-service has no business knowing what a "live class" is. Mirrors
-- the same itemType/itemId shape Task 38's subscriptions table already uses, rather than
-- inventing a second convention.

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS item_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS item_id UUID;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payment_target;
ALTER TABLE payments
    ADD CONSTRAINT chk_payment_target
    CHECK (course_id IS NOT NULL OR service_request_id IS NOT NULL OR item_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_payments_item ON payments(item_type, item_id);
