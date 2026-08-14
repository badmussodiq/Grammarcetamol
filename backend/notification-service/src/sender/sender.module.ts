import {Module} from '@nestjs/common';
import {ProvidersModule} from '../providers/providers.module';
import {NotificationLogsModule} from '../notification-logs/notification-logs.module';
import {NotificationsModule} from '../notifications/notifications.module';
import {TemplatesModule} from '../templates/templates.module';
import {NotificationSenderService} from './notification-sender.service';

@Module({
  imports: [ProvidersModule, NotificationLogsModule, NotificationsModule, TemplatesModule],
  providers: [NotificationSenderService],
  exports: [NotificationSenderService],
})
export class SenderModule {}
