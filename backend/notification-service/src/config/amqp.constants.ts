export const AMQP_CHANNEL = 'AMQP_CHANNEL';

/** This service doesn't own any of these exchanges — it only consumes from them, the same
 * idempotent-redeclare approach every Java consumer (e.g. PaymentEventListener) already uses.
 * No new shared "notification.exchange" was introduced: every publishing service keeps
 * publishing to its own existing exchange, this service just adds bindings. */
export const USER_EXCHANGE = 'user.exchange';
export const PAYMENT_EXCHANGE = 'payment.exchange';
export const ENROLLMENT_EXCHANGE = 'enrollment.exchange';
// Task 40 (Phase 4): Live Class Service (Task 39) publishes its own generic notification
// requests here, same shape as every other domain — subscription-charged/-payment-failed
// notifications deliberately do NOT get a new binding here, since SubscriptionsService
// (payment-service, Task 38) reuses the existing payment.exchange/payment.notification path
// instead (it already has a PaymentEventPublisher on hand) rather than inventing a second one.
export const LIVECLASS_EXCHANGE = 'liveclass.exchange';

/** Routing-key convention for "please send an email" requests: `<domain>.notification` on the
 * domain's own existing exchange — distinct from that domain's other event routing keys (e.g.
 * `user.locked`, `payment.completed`), since those carry domain-shaped payloads for other
 * consumers, not this service's generic {service, templateName, to, toName, variables} shape.
 * A publishing service that wants an email sent publishes to ITS OWN exchange with this key;
 * it never needs to know Notification Service exists as anything other than "a consumer of my
 * own events," which is exactly the point of not introducing a new shared exchange. */
export const NOTIFICATION_ROUTING_KEY = {
  user: 'user.notification',
  payment: 'payment.notification',
  enrollment: 'enrollment.notification',
  liveclass: 'liveclass.notification',
} as const;

/** The exact payload shape every publisher sends on the routing keys above. */
export interface NotificationRequestedEvent {
  /** The publishing service's own name, stamped into notification_logs verbatim — e.g.
   * "auth-service", "payment-service". Not validated against a fixed enum: any future
   * publisher just starts using its own name, no registration step needed here. */
  service: string;
  templateName: string;
  to: string;
  toName: string;
  variables: Record<string, unknown>;
  /** Optional — the user this notification is about, if the publisher has one on hand (every
   * current publisher does). Used to also write an in-app notification (see
   * src/notifications/) alongside the email; when absent (e.g. a future publisher that only
   * knows an email address), only the email send happens, same as before this field existed. */
  userId?: string;
  /** Optional — an id the frontend can deep-link from (a classId for live-class events, an
   * announcementId for announcements, etc.). Absent means no deep-link target, same as before
   * this field existed — NotificationSenderService.send() used to hardcode this to null for
   * every notification, which silently broke Task 41's "click a live-class notification to
   * open that class's classroom" requirement (a real bug found building Task 42). */
  relatedId?: string;
}
