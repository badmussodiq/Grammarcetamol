import {Module} from '@nestjs/common';
import {AuthServiceClient} from '@/clients/auth-service.client';
import {PaymentServiceClient} from '@/clients/payment-service.client';
import {EnrollmentsController} from './enrollments.controller';
import {EnrollmentsService} from './enrollments.service';
import {InvitationsController} from './invitations.controller';

@Module({
  controllers: [EnrollmentsController, InvitationsController],
  providers: [EnrollmentsService, PaymentServiceClient, AuthServiceClient],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
