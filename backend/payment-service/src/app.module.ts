import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './config/database.module';
import { RabbitMQModule } from './config/rabbitmq.module';
import { HealthController } from './health.controller';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, RabbitMQModule, PaymentsModule],
  controllers: [HealthController],
})
export class AppModule {}
