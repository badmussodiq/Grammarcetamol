export interface InitializeOrder {
  amount: number;
  currency: string;
  email: string;
  reference: string;
  metadata?: Record<string, unknown>;
  /** Set only for a subscription-creating initialize call — attaches a recurring plan to the
   * transaction so a successful first charge automatically creates a subscription on the
   * provider's side. Verified live against Paystack's real test-mode API (Task 38): passing
   * `plan` alongside the normal initialize fields works exactly like a one-time initialize,
   * same response shape, just with a subscription created as a side effect once paid. */
  planCode?: string;
}

export interface InitializeResult {
  reference: string;
  accessCode?: string;
  authorizationUrl?: string;
  raw: unknown;
}

export interface VerifyResult {
  status: 'success' | 'failed' | 'pending';
  amount: number;
  currency: string;
  raw: unknown;
}

export interface CreatePlanInput {
  name: string;
  amount: number;
  currency: string;
  interval: string;
}

export interface CreatePlanResult {
  planCode: string;
  raw: unknown;
}

export interface CancelSubscriptionInput {
  subscriptionCode: string;
  emailToken: string;
}

/**
 * A gateway-agnostic checkout provider. PaystackProvider is the only implementation today
 * (selected via PAYMENT_GATEWAY env var through PaymentProviderRegistry) — adding
 * StripeProvider/FlutterwaveProvider later is a new class implementing this interface plus a
 * registry entry, not a rewrite of PaymentsService/SubscriptionsService.
 */
export interface PaymentProvider {
  readonly name: string;
  initialize(order: InitializeOrder): Promise<InitializeResult>;
  verify(reference: string): Promise<VerifyResult>;
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;
  /** Idempotent from the caller's side only in the sense that calling it twice makes two plans
   * — SubscriptionsService is responsible for the reuse-vs-create-new decision (see its own
   * `subscription_plans` cache table), this method always creates. */
  createPlan(input: CreatePlanInput): Promise<CreatePlanResult>;
  cancelSubscription(input: CancelSubscriptionInput): Promise<void>;
}
