import {Inject, Injectable, Logger} from '@nestjs/common';
import type {Channel} from 'amqplib';
import {AMQP_CHANNEL, LIVECLASS_EXCHANGE} from '@/config/amqp.constants';

/**
 * Publishes to liveclass.exchange — same TopicExchange + <domain>.<event> routing-key
 * convention as payment-event-publisher.ts/subscription-event-publisher.ts. Task 40's
 * Notification Service binds the session.reminder/session.started/class.ended/enrollment.*
 * routing keys to populate the in-app inbox and send emails.
 */
@Injectable()
export class LiveClassEventPublisher {
  private readonly logger = new Logger(LiveClassEventPublisher.name);

  constructor(@Inject(AMQP_CHANNEL) private readonly channel: Channel) {}

  publishClassCreated(payload: Record<string, unknown>): void {
    this.publish('liveclass.class.created', payload);
  }

  publishClassUpdated(payload: Record<string, unknown>): void {
    this.publish('liveclass.class.updated', payload);
  }

  publishClassEnded(payload: Record<string, unknown>): void {
    this.publish('liveclass.class.ended', payload);
  }

  publishSessionCreated(payload: Record<string, unknown>): void {
    this.publish('liveclass.session.created', payload);
  }

  publishSessionStarted(payload: Record<string, unknown>): void {
    this.publish('liveclass.session.started', payload);
  }

  publishSessionEnded(payload: Record<string, unknown>): void {
    this.publish('liveclass.session.ended', payload);
  }

  publishSessionCancelled(payload: Record<string, unknown>): void {
    this.publish('liveclass.session.cancelled', payload);
  }

  publishSessionReminder(payload: Record<string, unknown>): void {
    this.publish('liveclass.session.reminder', payload);
  }

  publishEnrollmentCreated(payload: Record<string, unknown>): void {
    this.publish('liveclass.enrollment.created', payload);
  }

  publishEnrollmentCancelled(payload: Record<string, unknown>): void {
    this.publish('liveclass.enrollment.cancelled', payload);
  }

  /** "liveclass.notification" — the generic {service, templateName, to, toName, variables}
   * shape notification-service's consumer binds to, same convention as payment-service's
   * PaymentEventPublisher.publishNotification. */
  publishNotification(templateName: string, to: string, toName: string, variables: Record<string, unknown>, userId?: string, relatedId?: string): void {
    this.publish('liveclass.notification', {
      service: 'live-class-service',
      templateName,
      to,
      toName,
      variables,
      ...(userId ? { userId } : {}),
      ...(relatedId ? { relatedId } : {}),
    });
  }

  private publish(routingKey: string, payload: Record<string, unknown>): void {
    try {
      this.channel.publish(LIVECLASS_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
        contentType: 'application/json',
        persistent: true,
      });
      this.logger.debug(`Published event [${routingKey}] with payload ${JSON.stringify(payload)}`);
    } catch (err) {
      this.logger.error(`Failed to publish event [${routingKey}]: ${(err as Error).message}`);
    }
  }
}
