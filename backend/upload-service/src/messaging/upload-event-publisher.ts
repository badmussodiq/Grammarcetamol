import {Inject, Injectable, Logger} from '@nestjs/common';
import type {Channel} from 'amqplib';
import {AMQP_CHANNEL, UPLOAD_EXCHANGE} from '../config/amqp.constants';

/**
 * Publishes to upload.exchange — same TopicExchange + <domain>.<event> routing-key convention as
 * payment-service's PaymentEventPublisher. Event names are exactly what
 * implementation-phases.md §2.1 specifies for Upload Service. Payload shapes are plain JSON
 * objects (UUIDs as strings) — media-service (Task 17, not built yet) will eventually consume
 * `upload.file.completed`, so that payload's shape is a real cross-service contract, not just
 * internal bookkeeping.
 */
@Injectable()
export class UploadEventPublisher {
  private readonly logger = new Logger(UploadEventPublisher.name);

  constructor(@Inject(AMQP_CHANNEL) private readonly channel: Channel) {}

  publishSessionStarted(payload: Record<string, unknown>): void {
    this.publish('upload.session.started', payload);
  }

  publishChunkCompleted(payload: Record<string, unknown>): void {
    this.publish('upload.chunk.completed', payload);
  }

  publishFileCompleted(payload: Record<string, unknown>): void {
    this.publish('upload.file.completed', payload);
  }

  publishFailed(payload: Record<string, unknown>): void {
    this.publish('upload.failed', payload);
  }

  private publish(routingKey: string, payload: Record<string, unknown>): void {
    try {
      this.channel.publish(UPLOAD_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
        contentType: 'application/json',
        persistent: true,
      });
      this.logger.debug(`Published event [${routingKey}] with payload ${JSON.stringify(payload)}`);
    } catch (err) {
      this.logger.error(`Failed to publish event [${routingKey}]: ${(err as Error).message}`);
    }
  }
}
