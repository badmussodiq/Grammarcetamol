import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {ScheduleModule} from '@nestjs/schedule';
import {DatabaseModule} from './config/database.module';
import {RabbitMQModule} from './config/rabbitmq.module';
import {HealthController} from './health.controller';
import {PaymentsModule} from './payments/payments.module';

@Module({
  // ScheduleModule.forRoot() — Task 38's SubscriptionsService.sweepFailedSubscriptions()
  // is this service's first @Cron() consumer; without this, the decorator is inert.
  imports: [ConfigModule.forRoot({ isGlobal: true }), ScheduleModule.forRoot(), DatabaseModule, RabbitMQModule, PaymentsModule],
  controllers: [HealthController],
})
export class AppModule {}
