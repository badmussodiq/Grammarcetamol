import {Injectable, ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

interface InitializeResult {
  reference: string;
  accessCode?: string;
  authorizationUrl?: string;
  publicKey: string;
  amount: number;
  currency: string;
}

interface SubscriptionResult {
  reference: string;
  accessCode?: string;
  authorizationUrl?: string;
  publicKey: string;
  amount: number;
  currency: string;
}

interface PaymentApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server-to-server client into payment-service — bypasses the gateway (same convention as
 * payment-service's own CourseServiceClient), but unlike that read-only lookup, these calls
 * must be attributed to the REAL student's userId (not an internal-caller sentinel), since
 * payment-service writes that value straight into the payments/subscriptions row as who paid.
 * Neither endpoint on the payment-service side is role-gated beyond "authenticated", so any
 * real role string works — STUDENT is accurate for every caller of this client.
 */
@Injectable()
export class PaymentServiceClient {
  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return this.config.get<string>('PAYMENT_SERVICE_URL', 'http://localhost:9005');
  }

  private headersFor(userId: string): Record<string, string> {
    return { 'Content-Type': 'application/json', 'X-User-Id': userId, 'X-User-Role': 'STUDENT' };
  }

  async initializeOneTimePayment(
    userId: string,
    itemId: string,
    amount: number,
    currency: string,
    email?: string,
  ): Promise<InitializeResult> {
    const res = await fetch(`${this.baseUrl()}/api/payments/initialize-item`, {
      method: 'POST',
      headers: this.headersFor(userId),
      body: JSON.stringify({ itemType: 'live-class', itemId, amount, currency, email }),
    });
    const body = (await res.json()) as PaymentApiResponse<InitializeResult>;
    if (!res.ok || !body.success || !body.data) {
      throw new ServiceUnavailableException(body.error ?? 'payment-service initialize-item request failed');
    }
    return body.data;
  }

  async createSubscription(
    userId: string,
    itemId: string,
    amount: number,
    currency: string,
    interval: string,
    email?: string,
  ): Promise<SubscriptionResult> {
    const res = await fetch(`${this.baseUrl()}/api/subscriptions`, {
      method: 'POST',
      headers: this.headersFor(userId),
      body: JSON.stringify({ itemType: 'live-class', itemId, amount, currency, interval, email }),
    });
    const body = (await res.json()) as PaymentApiResponse<SubscriptionResult>;
    if (!res.ok || !body.success || !body.data) {
      throw new ServiceUnavailableException(body.error ?? 'payment-service subscriptions request failed');
    }
    return body.data;
  }

  async cancelSubscription(userId: string, subscriptionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl()}/api/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: this.headersFor(userId),
    });
    const body = (await res.json()) as PaymentApiResponse<unknown>;
    if (!res.ok || !body.success) {
      throw new ServiceUnavailableException(body.error ?? 'payment-service subscription cancel request failed');
    }
  }
}
