import { Module } from '@nestjs/common';
import { CourseServiceClient } from '../course-client/course-service.client';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { PaystackProvider } from '../providers/paystack.provider';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaystackProvider, PaymentProviderRegistry, CourseServiceClient],
})
export class PaymentsModule {}
