import {Inject, Injectable, Logger} from '@nestjs/common';
import type {Channel} from 'amqplib';
import {AMQP_CHANNEL, SUBSCRIPTION_EXCHANGE} from '@/config/amqp.constants';

/**
 * Publishes to subscription.exchange — same TopicExchange + <domain>.<event> routing-key
 * convention as PaymentEventPublisher. Every payload carries userId/itemType/itemId/
 * currentPeriodEnd so a consumer (Task 39's Live Class Service, or any future recurring-billed
 * item type) never needs to call back into payment-service synchronously to know what changed.
 */
@Injectable()
export class SubscriptionEventPublisher {
  private readonly logger = new Logger(SubscriptionEventPublisher.name);

  constructor(@Inject(AMQP_CHANNEL) private readonly channel: Channel) {}

  publishSubscriptionCreated(payload: Record<string, unknown>): void {
    this.publish('subscription.created', payload);
  }

  publishSubscriptionCharged(payload: Record<string, unknown>): void {
    this.publish('subscription.charged', payload);
  }

  publishSubscriptionCancelled(payload: Record<string, unknown>): void {
    this.publish('subscription.cancelled', payload);
  }

  publishSubscriptionExpired(payload: Record<string, unknown>): void {
    this.publish('subscription.expired', payload);
  }

  private publish(routingKey: string, payload: Record<string, unknown>): void {
    try {
      this.channel.publish(SUBSCRIPTION_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
        contentType: 'application/json',
        persistent: true,
      });
      this.logger.debug(`Published event [${routingKey}] with payload ${JSON.stringify(payload)}`);
    } catch (err) {
      this.logger.error(`Failed to publish event [${routingKey}]: ${(err as Error).message}`);
    }
  }
}
