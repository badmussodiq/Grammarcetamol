-- Real bug found live-verifying Task 39: item_id was typed UUID in both subscriptions (V2)
-- and payments (V3), but "generic item" ids are not actually guaranteed to be UUIDs — Live
-- Class Service's classId is a MongoDB ObjectId (24-char hex, e.g. "6a85f0c9b403f1f9b06812bc"),
-- which Postgres's UUID type rejects outright ("invalid input syntax for type uuid"). itemId
-- is meant to be opaque to payment-service (it never interprets the value, only stores and
-- echoes it back in events) — a plain string is the correct type for a cross-service
-- identifier whose format payment-service has no business assuming.

ALTER TABLE subscriptions ALTER COLUMN item_id TYPE VARCHAR(255) USING item_id::text;
ALTER TABLE payments ALTER COLUMN item_id TYPE VARCHAR(255) USING item_id::text;
