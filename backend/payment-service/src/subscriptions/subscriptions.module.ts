import {Module} from '@nestjs/common';
import {AuthServiceClient} from '@/course-client/auth-service.client';
import {PaymentProviderRegistry} from '@/providers/payment-provider.registry';
import {PaystackProvider} from '@/providers/paystack.provider';
import {SubscriptionsController} from './subscriptions.controller';
import {SubscriptionsService} from './subscriptions.service';

@Module({
  controllers: [SubscriptionsController],
  // PaystackProvider/PaymentProviderRegistry are re-declared here (not imported from
  // PaymentsModule) — both modules independently need the registry, and Nest doesn't share
  // providers across modules without an explicit export/import; re-providing is cheap and
  // keeps this module self-contained rather than creating a module-ordering dependency.
  providers: [SubscriptionsService, PaystackProvider, PaymentProviderRegistry, AuthServiceClient],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
