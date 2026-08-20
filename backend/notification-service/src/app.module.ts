import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {ScheduleModule} from '@nestjs/schedule';
import {DatabaseModule} from './config/database.module';
import {RabbitMQModule} from './config/rabbitmq.module';
import {HealthController} from './health.controller';
import {TemplatesModule} from './templates/templates.module';
import {ProvidersModule} from './providers/providers.module';
import {NotificationLogsModule} from './notification-logs/notification-logs.module';
import {NotificationsModule} from './notifications/notifications.module';
import {PreferencesModule} from './preferences/preferences.module';
import {AnnouncementsModule} from './announcements/announcements.module';
import {ConsumerModule} from './consumer/consumer.module';
import {SupportModule} from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ScheduleModule.forRoot() — AnnouncementsService's @Cron() sweeps (Task 40) are this
    // service's first cron consumers; without this, the decorators are inert.
    ScheduleModule.forRoot(),
    DatabaseModule,
    RabbitMQModule,
    TemplatesModule,
    ProvidersModule,
    NotificationLogsModule,
    NotificationsModule,
    PreferencesModule,
    AnnouncementsModule,
    ConsumerModule,
    SupportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
