import {BadRequestException, ForbiddenException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {CurrentUserPayload} from '@/common/current-user.decorator';
import {AuthServiceClient} from '@/course-client/auth-service.client';
import {CourseServiceClient} from '@/course-client/course-service.client';
import {PaymentEventPublisher} from '@/messaging/payment-event-publisher';
import {PaymentProviderRegistry} from '@/providers/payment-provider.registry';
import {SubscriptionsService} from '@/subscriptions/subscriptions.service';
import {PaymentsService} from '@/payments/payments.service';

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
  let authServiceClient: { getUser: jest.Mock };
  let eventPublisher: {
    publishPaymentIntentCreated: jest.Mock;
    publishPaymentCompleted: jest.Mock;
    publishPaymentFailed: jest.Mock;
    publishRefundRequested: jest.Mock;
    publishRefundCompleted: jest.Mock;
    publishNotification: jest.Mock;
  };
  let config: ConfigService;
  let subscriptionsService: { handleWebhookEvent: jest.Mock };
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
    authServiceClient = { getUser: jest.fn() };
    eventPublisher = {
      publishPaymentIntentCreated: jest.fn(),
      publishPaymentCompleted: jest.fn(),
      publishPaymentFailed: jest.fn(),
      publishRefundRequested: jest.fn(),
      publishRefundCompleted: jest.fn(),
      publishNotification: jest.fn(),
    };
    config = { get: jest.fn((key: string, fallback?: unknown) => fallback) } as unknown as ConfigService;
    subscriptionsService = { handleWebhookEvent: jest.fn() };

    service = new PaymentsService(
      pool as any,
      providerRegistry as unknown as PaymentProviderRegistry,
      courseServiceClient as unknown as CourseServiceClient,
      authServiceClient as unknown as AuthServiceClient,
      eventPublisher as unknown as PaymentEventPublisher,
      config,
      subscriptionsService as unknown as SubscriptionsService,
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

    it('publishes course-purchase-confirmation and payment-receipt with the resolved course/user details', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'pending' })], rowCount: 1 }) // SELECT by reference
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'completed', paid_at: '2026-08-09T22:19:21.848Z' })], rowCount: 1 }) // UPDATE ... RETURNING *
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT transactions
      provider.verify.mockResolvedValue({ status: 'success', amount: 49.99, currency: 'USD', raw: {} });
      courseServiceClient.getCourse.mockResolvedValue({ id: 'course-1', title: 'English Grammar Fundamentals' });
      authServiceClient.getUser.mockResolvedValue({ id: 'user-1', email: 'a@b.com', fullName: 'Jane Doe' });

      await service.confirm('pay_ref_1');
      await new Promise((resolve) => setImmediate(resolve)); // let the fire-and-forget email publish settle

      expect(eventPublisher.publishNotification).toHaveBeenCalledWith(
        'course-purchase-confirmation',
        'a@b.com',
        'Jane Doe',
        expect.objectContaining({ fullName: 'Jane Doe', courseTitle: 'English Grammar Fundamentals', amount: 49.99 }),
        'user-1',
      );
      expect(eventPublisher.publishNotification).toHaveBeenCalledWith(
        'payment-receipt',
        'a@b.com',
        'Jane Doe',
        expect.objectContaining({ courseTitle: 'English Grammar Fundamentals', paidAt: '2026-08-09T22:19:21.848Z' }),
        'user-1',
      );
    });

    it('does not fail payment completion when the course/user lookup for the email fails', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'pending' })], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'completed' })], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 });
      provider.verify.mockResolvedValue({ status: 'success', amount: 49.99, currency: 'USD', raw: {} });
      courseServiceClient.getCourse.mockRejectedValue(new Error('course-service unreachable'));

      const result = await service.confirm('pay_ref_1');
      await new Promise((resolve) => setImmediate(resolve));

      expect(result.status).toBe('completed');
      expect(eventPublisher.publishNotification).not.toHaveBeenCalled();
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

  describe('listMine', () => {
    it('forces the userId filter server-side regardless of what is passed in', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [paymentRow()], rowCount: 1 }) // SELECT items
        .mockResolvedValueOnce({ rows: [{ total: '1' }], rowCount: 1 }); // SELECT count

      const result = await service.listMine('user-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('user_id = $1'), expect.arrayContaining(['user-1']));
    });
  });

  describe('getById', () => {
    function user(id: string | null, roles: string[] = []): CurrentUserPayload {
      return { id, roles, isAuthenticated: () => id !== null, isAdminOrModerator: () => roles.some((r) => ['SUPER_ADMIN', 'MODERATOR'].includes(r)) };
    }

    it('returns the payment enriched with course info for the owner', async () => {
      pool.query.mockResolvedValueOnce({ rows: [paymentRow({ user_id: 'user-1' })], rowCount: 1 }); // findById
      courseServiceClient.getCourse.mockResolvedValue({ id: 'course-1', title: 'English Grammar Fundamentals', slug: 'english-grammar' });

      const result = await service.getById('payment-1', user('user-1'));

      expect(result.course).toEqual(expect.objectContaining({ title: 'English Grammar Fundamentals' }));
    });

    it('rejects a non-owner, non-admin caller', async () => {
      pool.query.mockResolvedValueOnce({ rows: [paymentRow({ user_id: 'user-1' })], rowCount: 1 });

      await expect(service.getById('payment-1', user('user-2'))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows an admin to view any transaction', async () => {
      pool.query.mockResolvedValueOnce({ rows: [paymentRow({ user_id: 'user-1' })], rowCount: 1 });
      courseServiceClient.getCourse.mockResolvedValue({ id: 'course-1', title: 'Course' });

      const result = await service.getById('payment-1', user('admin-1', ['SUPER_ADMIN']));

      expect(result.userId).toBe('user-1');
    });

    it('degrades to course: null when course-service is unreachable, without failing the request', async () => {
      pool.query.mockResolvedValueOnce({ rows: [paymentRow({ user_id: 'user-1' })], rowCount: 1 });
      courseServiceClient.getCourse.mockRejectedValue(new Error('course-service unreachable'));

      const result = await service.getById('payment-1', user('user-1'));

      expect(result.course).toBeNull();
    });
  });

  describe('handleWebhook — refund.processed reversal', () => {
    it('rejects the webhook outright when the signature is invalid', async () => {
      provider.verifyWebhookSignature.mockReturnValue(false);

      await expect(
        service.handleWebhook(JSON.stringify({ event: 'refund.processed', data: {} }), 'bad-sig'),
      ).rejects.toThrow();
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('marks a completed payment refunded when Paystack confirms a reversal, without calling verify()', async () => {
      provider.verifyWebhookSignature.mockReturnValue(true);
      const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
      pool.connect.mockResolvedValue(client);
      pool.query
        .mockResolvedValueOnce({ rows: [paymentRow({ status: 'completed', amount: '100.00' })], rowCount: 1 }) // findByReference
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 }) // already-refunded sum
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'refund-1',
              payment_id: 'payment-1',
              amount: '100.00',
              currency: 'USD',
              reason: 'Reversed by payment provider (webhook)',
              status: 'completed',
              processed_by: null,
              processed_at: null,
              gateway_ref: null,
              created_at: '2026-08-09T00:00:00.000Z',
              updated_at: '2026-08-09T00:00:00.000Z',
            },
          ],
          rowCount: 1,
        }); // INSERT refunds

      await service.handleWebhook(
        JSON.stringify({ event: 'refund.processed', data: { transaction: { reference: 'pay_ref_1' }, amount: 10000 } }),
        'sig',
      );

      expect(provider.verify).not.toHaveBeenCalled();
      expect(eventPublisher.publishRefundCompleted).toHaveBeenCalledTimes(1);
      expect(client.query).toHaveBeenCalledWith('UPDATE payments SET status = $1 WHERE id = $2', ['refunded', 'payment-1']);
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith('COMMIT');
    });

    it('ignores a refund.processed event for an unknown reference', async () => {
      provider.verifyWebhookSignature.mockReturnValue(true);
      pool.query.mockRejectedValueOnce(new Error('No payment found for reference unknown_ref'));

      await service.handleWebhook(JSON.stringify({ event: 'refund.processed', data: { reference: 'unknown_ref' } }), 'sig');

      expect(eventPublisher.publishRefundCompleted).not.toHaveBeenCalled();
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('is a no-op when the payment is already fully refunded', async () => {
      provider.verifyWebhookSignature.mockReturnValue(true);
      pool.query.mockResolvedValueOnce({ rows: [paymentRow({ status: 'refunded', amount: '100.00' })], rowCount: 1 });

      await service.handleWebhook(JSON.stringify({ event: 'refund.processed', data: { reference: 'pay_ref_1' } }), 'sig');

      expect(eventPublisher.publishRefundCompleted).not.toHaveBeenCalled();
      expect(pool.connect).not.toHaveBeenCalled();
    });
  });
});
