import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Channel } from 'amqplib';
import { AMQP_CHANNEL, PAYMENT_EXCHANGE } from '../config/amqp.constants';

/**
 * Publishes to payment.exchange — same TopicExchange + <domain>.<event> routing-key convention
 * as auth-service's UserEventPublisher / enrollment-service's EnrollmentEventPublisher. Payload
 * shapes are plain JSON objects (UUIDs as strings), matching what those Java listeners expect
 * (Jackson2JsonMessageConverter's INFERRED type precedence deserializes into the listener's
 * declared Map<String,Object> parameter without needing a __TypeId__ header).
 */
@Injectable()
export class PaymentEventPublisher {
  private readonly logger = new Logger(PaymentEventPublisher.name);

  constructor(@Inject(AMQP_CHANNEL) private readonly channel: Channel) {}

  publishPaymentIntentCreated(payload: Record<string, unknown>): void {
    this.publish('payment.intent.created', payload);
  }

  publishPaymentCompleted(payload: Record<string, unknown>): void {
    this.publish('payment.completed', payload);
  }

  publishPaymentFailed(payload: Record<string, unknown>): void {
    this.publish('payment.failed', payload);
  }

  publishRefundRequested(payload: Record<string, unknown>): void {
    this.publish('refund.requested', payload);
  }

  publishRefundCompleted(payload: Record<string, unknown>): void {
    this.publish('refund.completed', payload);
  }

  /** "payment.notification" — the generic {service, templateName, to, toName, variables} shape
   * notification-service's consumer binds to, same convention as auth-service's
   * UserEventPublisher.publishNotification. Distinct from payment.completed/payment.failed,
   * which carry domain-shaped payloads for other consumers (e.g. enrollment-service). */
  publishNotification(templateName: string, to: string, toName: string, variables: Record<string, unknown>, userId?: string): void {
    this.publish('payment.notification', {
      service: 'payment-service',
      templateName,
      to,
      toName,
      variables,
      ...(userId ? { userId } : {}),
    });
  }

  private publish(routingKey: string, payload: Record<string, unknown>): void {
    try {
      this.channel.publish(PAYMENT_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
        contentType: 'application/json',
        persistent: true,
      });
      this.logger.debug(`Published event [${routingKey}] with payload ${JSON.stringify(payload)}`);
    } catch (err) {
      this.logger.error(`Failed to publish event [${routingKey}]: ${(err as Error).message}`);
    }
  }
}
