export interface InitializeOrder {
  amount: number;
  currency: string;
  email: string;
  reference: string;
  metadata?: Record<string, unknown>;
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

/**
 * A gateway-agnostic checkout provider. PaystackProvider is the only implementation today
 * (selected via PAYMENT_GATEWAY env var through PaymentProviderRegistry) — adding
 * StripeProvider/FlutterwaveProvider later is a new class implementing this interface plus a
 * registry entry, not a rewrite of PaymentsService.
 */
export interface PaymentProvider {
  readonly name: string;
  initialize(order: InitializeOrder): Promise<InitializeResult>;
  verify(reference: string): Promise<VerifyResult>;
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;
}
