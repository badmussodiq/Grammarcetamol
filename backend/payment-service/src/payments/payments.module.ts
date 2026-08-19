import {Module} from '@nestjs/common';
import {AuthServiceClient} from '@/course-client/auth-service.client';
import {CourseServiceClient} from '@/course-client/course-service.client';
import {PaymentProviderRegistry} from '@/providers/payment-provider.registry';
import {PaystackProvider} from '@/providers/paystack.provider';
import {SubscriptionsModule} from '@/subscriptions/subscriptions.module';
import {PaymentsController} from './payments.controller';
import {PaymentsService} from './payments.service';
import {RevenueController} from './revenue.controller';
import {RevenueService} from './revenue.service';

@Module({
  // SubscriptionsModule imported (not re-declared) — PaymentsService needs the real
  // SubscriptionsService instance so its webhook dispatch and this module's own subscription
  // module share one row of truth, not two independently-instantiated services each thinking
  // they own the subscriptions table.
  imports: [SubscriptionsModule],
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
