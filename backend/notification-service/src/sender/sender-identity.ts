/**
 * Which mailbox a given email template should actually send from — a real, separate SMTP
 * login per identity (billing@/support@), not just a spoofed "From" header on one shared
 * connection (most SMTP providers, Gmail included, reject or flag a From address that
 * isn't the authenticated account or one of its verified aliases). See
 * SmtpEmailProvider for how each identity maps to its own transporter, falling back to
 * the 'default' identity's credentials when an identity-specific one isn't configured.
 */
export type SenderIdentity = 'default' | 'billing' | 'support';

/** Payment/subscription/purchase templates — anything about money changing hands. */
const BILLING_TEMPLATES = new Set([
  'course-purchase-confirmation',
  'payment-receipt',
  'enrollment-confirmation',
  'subscription-charged',
  'subscription-payment-failed',
]);

/** Account security (OTP, lockout) and customer-support-ticket templates. */
const SUPPORT_TEMPLATES = new Set([
  'email-verification-otp',
  'password-reset-otp',
  'account-locked',
  'support-ticket-submitted',
  'support-ticket-closed',
]);

/** Pure — everything not explicitly categorized (newsletter, live-class-*, announcement)
 * falls back to 'default', not an error. New templates default to the shared inbox until
 * someone deliberately categorizes them here — never a hard failure for an uncategorized
 * template name. */
export function resolveSenderIdentity(templateName: string): SenderIdentity {
  if (BILLING_TEMPLATES.has(templateName)) return 'billing';
  if (SUPPORT_TEMPLATES.has(templateName)) return 'support';
  return 'default';
}
