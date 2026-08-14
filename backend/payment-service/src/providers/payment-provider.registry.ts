import {Injectable} from '@nestjs/common';
import {PaystackProvider} from './paystack.provider';
import type {PaymentProvider} from './payment-provider.interface';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(paystackProvider: PaystackProvider) {
    this.providers.set(paystackProvider.name, paystackProvider);
    // Add StripeProvider / FlutterwaveProvider here (constructor param + a .set(...) call) when
    // those providers are actually built — see payment-provider.interface.ts.
  }

  get(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`No payment provider registered for "${name}"`);
    }
    return provider;
  }
}
