import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './config/database.module';
import { RabbitMQModule } from './config/rabbitmq.module';
import { HealthController } from './health.controller';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, RabbitMQModule, StorageModule, UploadsModule],
  controllers: [HealthController],
})
export class AppModule {}
