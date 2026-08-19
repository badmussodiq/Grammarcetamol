import {Inject, Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import type {Channel, ConsumeMessage} from 'amqplib';
import {AMQP_CHANNEL, LIVECLASS_EXCHANGE, NOTIFICATION_ROUTING_KEY, type NotificationRequestedEvent} from '@/config/amqp.constants';
import {NotificationSenderService} from '@/sender/notification-sender.service';

const EXCHANGE_BY_DOMAIN: Record<keyof typeof NOTIFICATION_ROUTING_KEY, string> = {
  user: 'user.exchange',
  payment: 'payment.exchange',
  enrollment: 'enrollment.exchange',
  liveclass: LIVECLASS_EXCHANGE,
};

/**
 * This service's whole reason to exist: consume `{service, templateName, to, toName, variables}`
 * off every domain's own exchange (see amqp.constants.ts for why there's no shared exchange) and
 * hand each event to NotificationSenderService, which renders the template, sends it via the
 * active EmailProvider, and writes exactly one notification_logs row per attempt.
 *
 * First NestJS RabbitMQ *consumer* in this codebase (every other NestJS service only
 * publishes) — no `@nestjs/microservices` transport is used elsewhere here, so this stays on
 * plain `amqplib` for consistency: one durable queue per domain, bound with that domain's
 * `NOTIFICATION_ROUTING_KEY` entry, `noAck: false` with explicit ack/nack below.
 */
@Injectable()
export class NotificationConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationConsumerService.name);

  constructor(
    @Inject(AMQP_CHANNEL) private readonly channel: Channel,
    private readonly sender: NotificationSenderService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const domain of Object.keys(NOTIFICATION_ROUTING_KEY) as (keyof typeof NOTIFICATION_ROUTING_KEY)[]) {
      const exchange = EXCHANGE_BY_DOMAIN[domain];
      const routingKey = NOTIFICATION_ROUTING_KEY[domain];
      const queue = `notification-service.${domain}.queue`;

      await this.channel.assertQueue(queue, { durable: true });
      await this.channel.bindQueue(queue, exchange, routingKey);
      await this.channel.consume(queue, (msg) => this.handleMessage(msg), { noAck: false });

      this.logger.log(`Bound ${queue} to ${exchange} (routing key: ${routingKey})`);
    }
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    let event: NotificationRequestedEvent;
    try {
      event = JSON.parse(msg.content.toString('utf8')) as NotificationRequestedEvent;
    } catch (err) {
      // Malformed message — nothing sensible to log (no service/template to attribute it to)
      // and redelivering a message that will never parse just loops forever, so this is the
      // one case that gets nack'd without requeue instead of ack'd-after-logging.
      this.logger.error(`Failed to parse notification event: ${err instanceof Error ? err.message : String(err)}`);
      this.channel.nack(msg, false, false);
      return;
    }

    try {
      await this.sender.send(event);
    } finally {
      // Ack in every other case, including a failed send — a missing template or a provider
      // outage won't self-heal by redelivery, and this repo's established philosophy is "log
      // and move on," not an infinite requeue loop. The notification_logs row IS the retry
      // signal for a human, not RabbitMQ.
      this.channel.ack(msg);
    }
  }
}
