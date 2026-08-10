import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { AMQP_CHANNEL, ENROLLMENT_EXCHANGE, PAYMENT_EXCHANGE, USER_EXCHANGE } from './amqp.constants';

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
        // This service only consumes from these exchanges — asserting them here is the same
        // idempotent redeclare every consumer in this codebase already does (works regardless
        // of which service, publisher or consumer, happens to start first).
        await channel.assertExchange(USER_EXCHANGE, 'topic', { durable: true });
        await channel.assertExchange(PAYMENT_EXCHANGE, 'topic', { durable: true });
        await channel.assertExchange(ENROLLMENT_EXCHANGE, 'topic', { durable: true });
        return channel;
      },
    },
  ],
  exports: [AMQP_CHANNEL],
})
export class RabbitMQModule {}
