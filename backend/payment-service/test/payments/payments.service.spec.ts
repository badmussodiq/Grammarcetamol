import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourseServiceClient } from '../../src/course-client/course-service.client';
import { PaymentEventPublisher } from '../../src/messaging/payment-event-publisher';
import { PaymentProviderRegistry } from '../../src/providers/payment-provider.registry';
import { PaymentsService } from '../../src/payments/payments.service';

function paymentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'payment-1',
    user_id: 'user-1',
    course_id: 'course-1',
    service_request_id: null,
    amount: '49.99',
    currency: 'USD',
    status: 'pending',
    payment_method: 'card',
    gateway: 'paystack',
    gateway_ref: 'pay_ref_1',
    description: null,
    paid_at: null,
    failed_at: null,
    failure_reason: null,
    created_at: '2026-08-05T00:00:00.000Z',
    updated_at: '2026-08-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('PaymentsService', () => {
  let pool: { query: jest.Mock; connect: jest.Mock };
  let providerRegistry: { get: jest.Mock };
  let provider: { name: string; initialize: jest.Mock; verify: jest.Mock; verifyWebhookSignature: jest.Mock };
  let courseServiceClient: { getCourse: jest.Mock };
  let eventPublisher: {
    publishPaymentIntentCreated: jest.Mock;
    publishPaymentCompleted: jest.Mock;
    publishPaymentFailed: jest.Mock;
    publishRefundRequested: jest.Mock;
    publishRefundCompleted: jest.Mock;
  };
  let config: ConfigService;
  let service: PaymentsService;

  beforeEach(() => {
    pool = { query: jest.fn(), connect: jest.fn() };
    provider = {
      name: 'paystack',
      initialize: jest.fn(),
      verify: jest.fn(),
      verifyWebhookSignature: jest.fn(),
    };
    providerRegistry = { get: jest.fn().mockReturnValue(provider) };
    courseServiceClient = { getCourse: jest.fn() };
    eventPublisher = {
      publishPaymentIntentCreated: jest.fn(),
      publishPaymentCompleted: jest.fn(),
      publishPaymentFailed: jest.fn(),
      publishRefundRequested: jest.fn(),
      publishRefundCompleted: jest.fn(),
    };
    config = { get: jest.fn((key: string, fallback?: unknown) => fallback) } as unknown as ConfigService;

    service = new PaymentsService(
      pool as any,
      providerRegistry as unknown as PaymentProviderRegistry,
      courseServiceClient as unknown as CourseServiceClient,
      eventPublisher as unknown as PaymentEventPublisher,
      config,
    );
  });

  describe('initialize', () => {
    it('rejects a free course', async () => {
      courseServiceClient.getCourse.mockResolvedValue({
        id: 'course-1',
        status: 'published',
        price: '0.00',
        currency: 'USD',
      });

      await expect(service.initialize('user-1', 'course-1', 'a@b.com')).rejects.toBeInstanceOf(BadRequestException);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects an unpublished course', async () => {
      courseServiceClient.getCourse.mockResolvedValue({
        id: 'course-1',
        status: 'draft',
        price: '49.99',
        currency: 'USD',
      });

      await expect(service.initialize('user-1', 'course-1', 'a@b.com')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a pending payment and returns the provider access code for a paid published course', async () => {
      courseServiceClient.getCourse.mockResolvedValue({
        id: 'course-1',
        status: 'published',
        price: '49.99',
        currency: 'USD',
      });
      provider.initialize.mockResolvedValue({
        reference: 'pay_ref_1',
        accessCode: 'access_code_abc',
        raw: {},
      });
      pool.query.mockResolvedValueOnce({ rows: [paymentRow()], rowCount: 1 }); // INSERT payments

      const result = await service.initialize('user-1', 'course-1', 'a@b.com');

      expect(result.accessCode).toBe('access_code_abc');
      expect(eventPublisher.publishPaymentIntentCreated).toHaveBeenCalledTimes(1);
    });

    it('does not write any row when the provider call itself fails', async () => {
      courseServiceClient.getCourse.mockResolvedValue({
        id: 'course-1',
        status: 'published',
        price: '49.99',
        currency: 'USD',
      });
      provider.initialize.mockRejectedValue(new Error('Currency not supported by merchant'));

      await expect(service.initialize('user-1', 'course-1', 'a@b.com')).rejects.toThrow();
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('confirm — idempotent convergence with the webhook path', () => {
    it('does not re-verify or re-publish when the payment is already completed', async () => {
      pool.query.mockResolvedValueOnce({ rows: [paymentRow({ status: 'completed' })], rowCount: 1 });

      const result = await service.confirm('pay_ref_1');

      expect(result.status).toBe('completed');
      expect(provider.verify).not.toHaveBeenCalled();
      expect(eventPublisher.publishPaymentCompleted).not.toHaveBeenCalled();
    });

    it('marks a pending payment completed on successful verification and publishes exactly once', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'pending' })], rowCount: 1 }) // SELECT by reference
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'completed' })], rowCount: 1 }) // UPDATE ... RETURNING *
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT transactions
      provider.verify.mockResolvedValue({ status: 'success', amount: 49.99, currency: 'USD', raw: {} });

      const result = await service.confirm('pay_ref_1');

      expect(result.status).toBe('completed');
      expect(eventPublisher.publishPaymentCompleted).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when the DB-level race guard finds the row already transitioned (rowCount 0)', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'pending' })], rowCount: 1 }) // SELECT by reference
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // UPDATE ... WHERE status <> 'completed' matched nothing
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'completed' })], rowCount: 1 }); // re-fetch by id
      provider.verify.mockResolvedValue({ status: 'success', amount: 49.99, currency: 'USD', raw: {} });

      const result = await service.confirm('pay_ref_1');

      expect(result.status).toBe('completed');
      expect(eventPublisher.publishPaymentCompleted).not.toHaveBeenCalled();
    });
  });

  describe('refund', () => {
    it('rejects a refund amount that exceeds the remaining refundable balance', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'completed', amount: '100.00' })], rowCount: 1 }) // findById
        .mockResolvedValueOnce({ rows: [{ total: '80.00' }], rowCount: 1 }); // already-refunded sum

      await expect(service.refund('payment-1', 30, 'not satisfied', 'admin-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('creates and completes a refund within the remaining balance', async () => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
      pool.connect.mockResolvedValue(client);
      pool.query
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'completed', amount: '100.00' })], rowCount: 1 }) // findById
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 }) // already-refunded sum
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'refund-1',
              payment_id: 'payment-1',
              amount: '30.00',
              currency: 'USD',
              reason: 'not satisfied',
              status: 'pending',
              processed_by: 'admin-1',
              processed_at: null,
              gateway_ref: null,
              created_at: '2026-08-05T00:00:00.000Z',
              updated_at: '2026-08-05T00:00:00.000Z',
            },
          ],
          rowCount: 1,
        }) // INSERT refunds
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'refund-1',
              payment_id: 'payment-1',
              amount: '30.00',
              currency: 'USD',
              reason: 'not satisfied',
              status: 'completed',
              processed_by: 'admin-1',
              processed_at: '2026-08-05T00:01:00.000Z',
              gateway_ref: null,
              created_at: '2026-08-05T00:00:00.000Z',
              updated_at: '2026-08-05T00:01:00.000Z',
            },
          ],
          rowCount: 1,
        }); // final SELECT refunds

      const result = await service.refund('payment-1', 30, 'not satisfied', 'admin-1');

      expect(result.status).toBe('completed');
      expect(eventPublisher.publishRefundRequested).toHaveBeenCalledTimes(1);
      expect(eventPublisher.publishRefundCompleted).toHaveBeenCalledTimes(1);
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith('COMMIT');
    });
  });
});
