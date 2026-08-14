import {Module} from '@nestjs/common';
import {AuthServiceClient} from '../course-client/auth-service.client';
import {CourseServiceClient} from '../course-client/course-service.client';
import {PaymentProviderRegistry} from '../providers/payment-provider.registry';
import {PaystackProvider} from '../providers/paystack.provider';
import {PaymentsController} from './payments.controller';
import {PaymentsService} from './payments.service';
import {RevenueController} from './revenue.controller';
import {RevenueService} from './revenue.service';

@Module({
  controllers: [PaymentsController, RevenueController],
  providers: [
    PaymentsService,
    PaystackProvider,
    PaymentProviderRegistry,
    CourseServiceClient,
    AuthServiceClient,
    RevenueService,
  ],
})
export class PaymentsModule {}
