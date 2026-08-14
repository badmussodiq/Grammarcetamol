import {Global, Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as amqp from 'amqplib';
import {UploadEventPublisher} from '../messaging/upload-event-publisher';
import {AMQP_CHANNEL, UPLOAD_EXCHANGE} from './amqp.constants';

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
        await channel.assertExchange(UPLOAD_EXCHANGE, 'topic', { durable: true });
        return channel;
      },
    },
    UploadEventPublisher,
  ],
  exports: [AMQP_CHANNEL, UploadEventPublisher],
})
export class RabbitMQModule {}
