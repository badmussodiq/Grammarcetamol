import {Module} from '@nestjs/common';
import {NotificationLogsController} from './notification-logs.controller';
import {NotificationLogsService} from './notification-logs.service';

@Module({
  controllers: [NotificationLogsController],
  providers: [NotificationLogsService],
  exports: [NotificationLogsService],
})
export class NotificationLogsModule {}
