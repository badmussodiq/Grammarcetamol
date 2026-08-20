import {Injectable, Logger, ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {createHmac, timingSafeEqual} from 'crypto';
import type {
  CancelSubscriptionInput,
  CreatePlanInput,
  CreatePlanResult,
  InitializeOrder,
  InitializeResult,
  PaymentProvider,
  VerifyResult,
} from './payment-provider.interface';

const PAYSTACK_API_BASE = 'https://api.paystack.co';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: { authorization_url: string; access_code: string; reference: string };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: { status: string; amount: number; currency: string; reference: string };
}

interface PaystackPlanResponse {
  status: boolean;
  message: string;
  data?: { plan_code: string };
}

interface PaystackDisableSubscriptionResponse {
  status: boolean;
  message: string;
}

@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly name = 'paystack';

  private readonly logger = new Logger(PaystackProvider.name);

  constructor(private readonly config: ConfigService) {}

  async initialize(order: InitializeOrder): Promise<InitializeResult> {
    const res = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Paystack expects the amount in the currency's smallest subunit (kobo/cents).
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        email: order.email,
        reference: order.reference,
        metadata: order.metadata ?? {},
        // Verified live (Task 38): attaching `plan` here is the entire difference between a
        // one-time initialize and a subscription-creating one — Paystack creates the
        // subscription itself once this transaction's first charge succeeds.
        ...(order.planCode ? { plan: order.planCode } : {}),
      }),
    });

    const body = (await res.json()) as PaystackInitializeResponse;
    if (!res.ok || !body.status || !body.data) {
      this.logger.error(`Paystack initialize failed: ${JSON.stringify(body)}`);
      throw new ServiceUnavailableException('Payment provider initialization failed');
    }

    return {
      reference: body.data.reference,
      accessCode: body.data.access_code,
      authorizationUrl: body.data.authorization_url,
      raw: body,
    };
  }

  async verify(reference: string): Promise<VerifyResult> {
    const res = await fetch(`${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.secretKey()}` },
    });

    const body = (await res.json()) as PaystackVerifyResponse;
    if (!res.ok || !body.status || !body.data) {
      this.logger.error(`Paystack verify failed: ${JSON.stringify(body)}`);
      throw new ServiceUnavailableException('Payment provider verification failed');
    }

    const status: VerifyResult['status'] =
      body.data.status === 'success' ? 'success' : body.data.status === 'failed' ? 'failed' : 'pending';

    return {
      status,
      amount: body.data.amount / 100,
      currency: body.data.currency,
      raw: body,
    };
  }

  async createPlan(input: CreatePlanInput): Promise<CreatePlanResult> {
    const res = await fetch(`${PAYSTACK_API_BASE}/plan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        interval: input.interval,
      }),
    });

    const body = (await res.json()) as PaystackPlanResponse;
    if (!res.ok || !body.status || !body.data) {
      this.logger.error(`Paystack plan creation failed: ${JSON.stringify(body)}`);
      throw new ServiceUnavailableException('Payment provider plan creation failed');
    }

    return { planCode: body.data.plan_code, raw: body };
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<void> {
    const res = await fetch(`${PAYSTACK_API_BASE}/subscription/disable`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: input.subscriptionCode, token: input.emailToken }),
    });

    const body = (await res.json()) as PaystackDisableSubscriptionResponse;
    if (!res.ok || !body.status) {
      this.logger.error(`Paystack subscription cancellation failed: ${JSON.stringify(body)}`);
      throw new ServiceUnavailableException('Payment provider subscription cancellation failed');
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    if (!signature) {
      return false;
    }
    const expected = createHmac('sha512', this.secretKey()).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const signatureBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, signatureBuf);
  }

  private secretKey(): string {
    const key = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!key) {
      throw new ServiceUnavailableException('PAYSTACK_SECRET_KEY is not configured');
    }
    return key;
  }
}
