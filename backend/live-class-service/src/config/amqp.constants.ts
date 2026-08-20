export const AMQP_CHANNEL = 'AMQP_CHANNEL';

/** This service owns liveclass.exchange (publishes class/session/enrollment events for
 * Task 40's Notification Service to consume) and consumes from two exchanges it doesn't own —
 * payment.exchange (payment.completed, for ONE_TIME enrollments) and subscription.exchange
 * (Task 38, for RECURRING enrollments) — same idempotent-redeclare-on-both-sides approach
 * every publisher/consumer pair in this codebase already uses. */
export const LIVECLASS_EXCHANGE = 'liveclass.exchange';
export const PAYMENT_EXCHANGE = 'payment.exchange';
export const SUBSCRIPTION_EXCHANGE = 'subscription.exchange';
