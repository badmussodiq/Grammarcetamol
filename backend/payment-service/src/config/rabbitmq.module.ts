import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { PaymentEventPublisher } from '../messaging/payment-event-publisher';
import { AMQP_CHANNEL, PAYMENT_EXCHANGE } from './amqp.constants';

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
        await channel.assertExchange(PAYMENT_EXCHANGE, 'topic', { durable: true });
        return channel;
      },
    },
    PaymentEventPublisher,
  ],
  exports: [AMQP_CHANNEL, PaymentEventPublisher],
})
export class RabbitMQModule {}
