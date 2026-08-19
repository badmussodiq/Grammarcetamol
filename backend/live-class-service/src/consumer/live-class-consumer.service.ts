import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import type {Channel, ConsumeMessage} from 'amqplib';
import {Inject} from '@nestjs/common';
import {AMQP_CHANNEL, PAYMENT_EXCHANGE, SUBSCRIPTION_EXCHANGE} from '@/config/amqp.constants';
import {EnrollmentsService} from '@/enrollments/enrollments.service';

interface Binding {
  exchange: string;
  routingKey: string;
  queue: string;
  handle: (payload: any) => Promise<void>;
}

/**
 * This service's whole reason to exist: react to billing lifecycle events published by
 * payment-service (subscription.exchange, Task 38) and the existing payment.exchange, so
 * enrollment activation/expiry never needs a synchronous call back into payment-service — same
 * consumer shape notification-service's NotificationConsumerService already established
 * (durable queue per routing key, explicit ack/nack, malformed messages nack'd without
 * requeue since redelivery would never fix a parse failure).
 */
@Injectable()
export class LiveClassConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LiveClassConsumerService.name);

  constructor(
    @Inject(AMQP_CHANNEL) private readonly channel: Channel,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const bindings: Binding[] = [
      {
        exchange: SUBSCRIPTION_EXCHANGE,
        routingKey: 'subscription.created',
        queue: 'live-class-service.subscription.created.queue',
        handle: (p) => this.enrollmentsService.handleSubscriptionCreated(p),
      },
      {
        exchange: SUBSCRIPTION_EXCHANGE,
        routingKey: 'subscription.charged',
        queue: 'live-class-service.subscription.charged.queue',
        handle: (p) => this.enrollmentsService.handleSubscriptionCharged(p),
      },
      {
        exchange: SUBSCRIPTION_EXCHANGE,
        routingKey: 'subscription.expired',
        queue: 'live-class-service.subscription.expired.queue',
        handle: (p) => this.enrollmentsService.handleSubscriptionExpired(p),
      },
      {
        exchange: PAYMENT_EXCHANGE,
        routingKey: 'payment.completed',
        queue: 'live-class-service.payment.completed.queue',
        handle: (p) => this.enrollmentsService.handlePaymentCompleted(p),
      },
    ];

    for (const binding of bindings) {
      await this.channel.assertQueue(binding.queue, { durable: true });
      await this.channel.bindQueue(binding.queue, binding.exchange, binding.routingKey);
      await this.channel.consume(binding.queue, (msg) => this.handleMessage(msg, binding), { noAck: false });
      this.logger.log(`Bound ${binding.queue} to ${binding.exchange} (routing key: ${binding.routingKey})`);
    }
  }

  private async handleMessage(msg: ConsumeMessage | null, binding: Binding): Promise<void> {
    if (!msg) return;

    let payload: unknown;
    try {
      payload = JSON.parse(msg.content.toString('utf8'));
    } catch (err) {
      this.logger.error(`Failed to parse ${binding.routingKey} event: ${err instanceof Error ? err.message : String(err)}`);
      this.channel.nack(msg, false, false);
      return;
    }

    try {
      await binding.handle(payload);
    } catch (err) {
      // Same "log and move on" philosophy as every other consumer in this codebase — a
      // transient DB hiccup here shouldn't loop forever, and a real bug is a human's job to
      // notice and fix, not RabbitMQ's redelivery mechanism.
      this.logger.error(`Failed to handle ${binding.routingKey}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.channel.ack(msg);
    }
  }
}
