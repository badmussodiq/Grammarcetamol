import {ConfigService} from '@nestjs/config';
import {createHmac} from 'crypto';
import {PaystackProvider} from '../../src/providers/paystack.provider';

describe('PaystackProvider.verifyWebhookSignature', () => {
  const secret = 'sk_test_secret';
  let provider: PaystackProvider;

  beforeEach(() => {
    const config = { get: jest.fn().mockReturnValue(secret) } as unknown as ConfigService;
    provider = new PaystackProvider(config);
  });

  it('accepts a signature computed with the correct secret over the exact raw body', () => {
    const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'pay_123' } });
    const signature = createHmac('sha512', secret).update(rawBody).digest('hex');

    expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'pay_123' } });
    const signature = createHmac('sha512', 'wrong_secret').update(rawBody).digest('hex');

    expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(false);
  });

  it('rejects when the body was tampered with after signing', () => {
    const originalBody = JSON.stringify({ event: 'charge.success', data: { reference: 'pay_123', amount: 100 } });
    const signature = createHmac('sha512', secret).update(originalBody).digest('hex');
    const tamperedBody = JSON.stringify({ event: 'charge.success', data: { reference: 'pay_123', amount: 999999 } });

    expect(provider.verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });

  it('rejects when no signature header is present', () => {
    const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'pay_123' } });

    expect(provider.verifyWebhookSignature(rawBody, undefined)).toBe(false);
  });
});
