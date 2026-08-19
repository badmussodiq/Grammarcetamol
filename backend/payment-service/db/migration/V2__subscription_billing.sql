-- Task 38 (Phase 4): recurring billing, generic across item types (live-class today, anything
-- item-type/item-id addressable later) — see PHASE4.md's Domain Model for the full lifecycle.
-- subscription_plans is a local cache keyed on (amount, currency, interval) so a repeat
-- negotiated price reuses the same Paystack Plan instead of creating a duplicate every time;
-- verified live against Paystack's real test-mode API that arbitrary-amount Plan creation
-- works fine (Plans aren't restricted to dashboard-predefined ones).

CREATE TABLE IF NOT EXISTS subscription_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount          DECIMAL(12,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL,
    interval        VARCHAR(20) NOT NULL,
    plan_code       VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscription_plans_price UNIQUE (amount, currency, interval)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL,
    item_type                   VARCHAR(50) NOT NULL,
    item_id                     UUID NOT NULL,
    plan_code                   VARCHAR(255) NOT NULL,
    paystack_customer_code      VARCHAR(255),
    paystack_subscription_code  VARCHAR(255),
    paystack_email_token        VARCHAR(255),
    -- 'pending' is not in PHASE4.md's Domain Model list — added here because Paystack's
    -- initialize-with-plan flow is asynchronous (the real subscription only exists once the
    -- subscription.create webhook arrives, same async gap the one-time `payments` table's own
    -- 'pending' status already bridges), so a row can legitimately exist before it's 'active'.
    status                      VARCHAR(20) NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'active', 'payment_failed', 'past_due', 'cancelled', 'expired')),
    amount                      DECIMAL(12,2) NOT NULL,
    currency                    VARCHAR(3) NOT NULL DEFAULT 'NGN',
    interval                    VARCHAR(20) NOT NULL,
    gateway_ref                 VARCHAR(255) NOT NULL,
    current_period_end          TIMESTAMPTZ,
    cancelled_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscriptions_gateway_ref UNIQUE (gateway_ref)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_item ON subscriptions(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_code ON subscriptions(paystack_subscription_code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_customer ON subscriptions(plan_code, paystack_customer_code);

-- update_updated_at_column() already exists from V1.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at') THEN
        CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
