import { Module } from '@nestjs/common';
import { SenderModule } from '../sender/sender.module';
import { NotificationConsumerService } from './notification-consumer.service';

@Module({
  imports: [SenderModule],
  providers: [NotificationConsumerService],
})
export class ConsumerModule {}
