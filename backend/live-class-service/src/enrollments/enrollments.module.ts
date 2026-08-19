import {Module} from '@nestjs/common';
import {AuthServiceClient} from '@/clients/auth-service.client';
import {PaymentServiceClient} from '@/clients/payment-service.client';
import {EnrolledStudentNotifier} from './enrolled-student-notifier.service';
import {EnrollmentsController} from './enrollments.controller';
import {EnrollmentsService} from './enrollments.service';
import {InvitationsController} from './invitations.controller';

@Module({
  controllers: [EnrollmentsController, InvitationsController],
  providers: [EnrollmentsService, PaymentServiceClient, AuthServiceClient, EnrolledStudentNotifier],
  exports: [EnrollmentsService, EnrolledStudentNotifier],
})
export class EnrollmentsModule {}
