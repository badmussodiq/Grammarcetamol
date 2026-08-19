import {Module} from '@nestjs/common';
import {AuthServiceClient} from '@/clients/auth-service.client';
import {EnrollmentServiceClient} from '@/clients/enrollment-service.client';
import {NotificationsModule} from '@/notifications/notifications.module';
import {SenderModule} from '@/sender/sender.module';
import {AnnouncementsController} from './announcements.controller';
import {AnnouncementsService} from './announcements.service';

@Module({
  imports: [SenderModule, NotificationsModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, AuthServiceClient, EnrollmentServiceClient],
})
export class AnnouncementsModule {}
