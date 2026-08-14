export interface SendEmailInput {
  to: string;
  toName: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  raw?: unknown;
  /** Set only when success is false — the consumer logs this into notification_logs.error. */
  error?: string;
}

/**
 * A delivery-mechanism-agnostic email sender. `LogEmailProvider` is the only implementation
 * today (selected via `EMAIL_PROVIDER` env var through `EmailProviderRegistry`, default `log`
 * since no real SMTP/SendGrid/SES credentials exist yet) — adding `SendGridProvider`/
 * `SesProvider`/`SmtpProvider` later is a new class implementing this interface plus a registry
 * entry, not a rewrite of the consumer. Exact same shape as PaymentProvider/StorageProvider.
 */
export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
