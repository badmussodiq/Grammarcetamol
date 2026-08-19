import {Global, Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as amqp from 'amqplib';
import {LiveClassEventPublisher} from '@/messaging/live-class-event-publisher';
import {AMQP_CHANNEL, LIVECLASS_EXCHANGE, PAYMENT_EXCHANGE, SUBSCRIPTION_EXCHANGE} from './amqp.constants';

@Global()
@Module({
  providers: [
    {
      provide: AMQP_CHANNEL,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const host = config.get<string>('RABBITMQ_HOST', 'localhost');
        const port = config.get<number>('RABBITMQ_PORT', 9011);
        const username = config.get<string>('RABBITMQ_USERNAME', 'guest');
        const password = config.get<string>('RABBITMQ_PASSWORD', 'guest');
        const connection = await amqp.connect(`amqp://${username}:${password}@${host}:${port}`);
        const channel = await connection.createChannel();
        // Idempotent redeclare on both the owning and consuming side — works regardless of
        // which service happens to start first, same convention every exchange in this
        // codebase already follows.
        await channel.assertExchange(LIVECLASS_EXCHANGE, 'topic', { durable: true });
        await channel.assertExchange(PAYMENT_EXCHANGE, 'topic', { durable: true });
        await channel.assertExchange(SUBSCRIPTION_EXCHANGE, 'topic', { durable: true });
        return channel;
      },
    },
    LiveClassEventPublisher,
  ],
  exports: [AMQP_CHANNEL, LiveClassEventPublisher],
})
export class RabbitMQModule {}
