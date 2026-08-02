import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { UserService } from '../user.service';

@Injectable()
export class UserEventsConsumer implements OnModuleInit, OnModuleDestroy {

  private readonly logger = new Logger(UserEventsConsumer.name);
  private connection: amqplib.ChannelModel;
  private channel: amqplib.Channel;

  private static readonly EXCHANGE      = 'user.exchange';
  private static readonly CREATED_QUEUE = 'user.created.queue';
  private static readonly VERIFIED_QUEUE= 'user.verified.queue';

  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');
    try {
      this.connection = await amqplib.connect(url);
      this.channel    = await this.connection.createChannel();

      await this.channel.assertExchange(UserEventsConsumer.EXCHANGE, 'topic', { durable: true });

      await this.channel.assertQueue(UserEventsConsumer.CREATED_QUEUE,  { durable: true });
      await this.channel.assertQueue(UserEventsConsumer.VERIFIED_QUEUE, { durable: true });

      await this.channel.bindQueue(
        UserEventsConsumer.CREATED_QUEUE, UserEventsConsumer.EXCHANGE, 'user.created'
      );
      await this.channel.bindQueue(
        UserEventsConsumer.VERIFIED_QUEUE, UserEventsConsumer.EXCHANGE, 'user.verified'
      );

      await this.channel.consume(UserEventsConsumer.CREATED_QUEUE, async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          await this.userService.createProfileFromEvent(
            payload.userId, payload.email, payload.fullName
          );
          this.channel.ack(msg);
        } catch (err) {
          this.logger.error('Failed to process user.created event', err);
          this.channel.nack(msg, false, false);
        }
      });

      await this.channel.consume(UserEventsConsumer.VERIFIED_QUEUE, (msg) => {
        if (!msg) return;
        const payload = JSON.parse(msg.content.toString());
        this.logger.log(`Received user.verified for userId=${payload.userId}`);
        this.channel.ack(msg);
      });

      this.logger.log('Connected to RabbitMQ and listening for user events');
    } catch (err) {
      this.logger.error('Failed to connect to RabbitMQ', err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (_) {}
  }
}
