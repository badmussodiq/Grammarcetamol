import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {DatabaseModule} from './config/database.module';
import {RabbitMQModule} from './config/rabbitmq.module';
import {HealthController} from './health.controller';
import {TemplatesModule} from './templates/templates.module';
import {ProvidersModule} from './providers/providers.module';
import {NotificationLogsModule} from './notification-logs/notification-logs.module';
import {NotificationsModule} from './notifications/notifications.module';
import {ConsumerModule} from './consumer/consumer.module';
import {SupportModule} from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RabbitMQModule,
    TemplatesModule,
    ProvidersModule,
    NotificationLogsModule,
    NotificationsModule,
    ConsumerModule,
    SupportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
