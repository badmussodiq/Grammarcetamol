import {BadRequestException, ForbiddenException, NotFoundException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {AuthServiceClient} from '@/course-client/auth-service.client';
import {SubscriptionEventPublisher} from '@/messaging/subscription-event-publisher';
import {PaymentProviderRegistry} from '@/providers/payment-provider.registry';
import {SubscriptionsService} from '@/subscriptions/subscriptions.service';

function subscriptionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sub-1',
    user_id: 'user-1',
    item_type: 'live-class',
    item_id: 'class-1',
    plan_code: 'PLN_abc',
    paystack_customer_code: null,
    paystack_subscription_code: null,
    paystack_email_token: null,
    status: 'pending',
    amount: '5000.00',
    currency: 'NGN',
    interval: 'monthly',
    gateway_ref: 'sub_ref_1',
    current_period_end: null,
    cancelled_at: null,
    created_at: '2026-08-19T00:00:00.000Z',
    updated_at: '2026-08-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('SubscriptionsService', () => {
  let pool: { query: jest.Mock };
  let providerRegistry: { get: jest.Mock };
  let provider: { name: string; initialize: jest.Mock; createPlan: jest.Mock; cancelSubscription: jest.Mock };
  let authServiceClient: { getUser: jest.Mock };
  let eventPublisher: {
    publishSubscriptionCreated: jest.Mock;
    publishSubscriptionCharged: jest.Mock;
    publishSubscriptionCancelled: jest.Mock;
    publishSubscriptionExpired: jest.Mock;
  };
  let config: ConfigService;
  let service: SubscriptionsService;

  beforeEach(() => {
    pool = { query: jest.fn() };
    provider = {
      name: 'paystack',
      initialize: jest.fn(),
      createPlan: jest.fn(),
      cancelSubscription: jest.fn(),
    };
    providerRegistry = { get: jest.fn().mockReturnValue(provider) };
    authServiceClient = { getUser: jest.fn() };
    eventPublisher = {
      publishSubscriptionCreated: jest.fn(),
      publishSubscriptionCharged: jest.fn(),
      publishSubscriptionCancelled: jest.fn(),
      publishSubscriptionExpired: jest.fn(),
    };
    config = { get: jest.fn((key: string, fallback?: unknown) => fallback) } as unknown as ConfigService;

    service = new SubscriptionsService(
      pool as any,
      providerRegistry as unknown as PaymentProviderRegistry,
      authServiceClient as unknown as AuthServiceClient,
      eventPublisher as unknown as SubscriptionEventPublisher,
      config,
    );
  });

  describe('create — plan reuse vs. create-new decision', () => {
    it('reuses a cached plan_code and never calls the provider to create one', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ plan_code: 'PLN_cached' }] }); // cache hit
      provider.initialize.mockResolvedValue({ reference: 'sub_ref_1', authorizationUrl: 'https://checkout', raw: {} });
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT INTO subscriptions

      await service.create('user-1', { itemType: 'live-class', itemId: 'class-1', amount: 5000, interval: 'monthly', email: 'a@b.com' });

      expect(provider.createPlan).not.toHaveBeenCalled();
      expect(provider.initialize).toHaveBeenCalledWith(expect.objectContaining({ planCode: 'PLN_cached' }));
    });

    it('creates and caches a new plan when no cached price match exists', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // cache miss
      provider.createPlan.mockResolvedValue({ planCode: 'PLN_new', raw: {} });
      pool.query.mockResolvedValueOnce({ rows: [{ plan_code: 'PLN_new' }] }); // INSERT INTO subscription_plans
      provider.initialize.mockResolvedValue({ reference: 'sub_ref_2', authorizationUrl: 'https://checkout', raw: {} });
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT INTO subscriptions

      await service.create('user-1', { itemType: 'live-class', itemId: 'class-2', amount: 7500, interval: 'monthly', email: 'a@b.com' });

      expect(provider.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 7500, currency: 'NGN', interval: 'monthly' }),
      );
      expect(provider.initialize).toHaveBeenCalledWith(expect.objectContaining({ planCode: 'PLN_new' }));
    });

    it('resolves the caller email via AuthServiceClient when none is supplied', async () => {
      authServiceClient.getUser.mockResolvedValue({ id: 'user-1', email: 'resolved@b.com', fullName: 'A B' });
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ plan_code: 'PLN_cached' }] });
      provider.initialize.mockResolvedValue({ reference: 'sub_ref_3', raw: {} });
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await service.create('user-1', { itemType: 'live-class', itemId: 'class-1', amount: 5000, interval: 'monthly' });

      expect(authServiceClient.getUser).toHaveBeenCalledWith('user-1');
      expect(provider.initialize).toHaveBeenCalledWith(expect.objectContaining({ email: 'resolved@b.com' }));
    });
  });

  describe('cancel — does not touch access, only this service\'s own table', () => {
    it('calls the provider and marks cancelled, preserving currentPeriodEnd untouched', async () => {
      const row = subscriptionRow({
        status: 'active',
        paystack_subscription_code: 'SUB_1',
        paystack_email_token: 'tok_1',
        current_period_end: '2026-09-19T00:00:00.000Z',
      });
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [row] }) // findById
        .mockResolvedValueOnce({
          rows: [{ ...row, status: 'cancelled', cancelled_at: '2026-08-19T00:00:00.000Z' }],
        }); // UPDATE ... RETURNING *

      const result = await service.cancel('sub-1', 'user-1');

      expect(provider.cancelSubscription).toHaveBeenCalledWith({ subscriptionCode: 'SUB_1', emailToken: 'tok_1' });
      expect(result.status).toBe('cancelled');
      // The whole point of the access-vs-billing split: cancelling never changes currentPeriodEnd.
      expect(result.currentPeriodEnd).toBe('2026-09-19T00:00:00.000Z');
      expect(eventPublisher.publishSubscriptionCancelled).toHaveBeenCalledWith(
        expect.objectContaining({ currentPeriodEnd: '2026-09-19T00:00:00.000Z' }),
      );
      // Only ever queries its own table — no cross-service call, no other table touched.
      for (const call of pool.query.mock.calls) {
        expect(String(call[0])).toMatch(/subscriptions/i);
      }
    });

    it('rejects cancelling someone else\'s subscription', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [subscriptionRow({ user_id: 'other-user' })] });
      await expect(service.cancel('sub-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
    });

    it('rejects cancelling before the provider has confirmed the subscription (no code/token yet)', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [subscriptionRow({ status: 'pending' })] });
      await expect(service.cancel('sub-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
    });

    it('is a no-op for an already-cancelled subscription', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [subscriptionRow({ status: 'cancelled' })] });
      await service.cancel('sub-1', 'user-1');
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('throws NotFoundException for an unknown id', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      await expect(service.getById('missing', { id: 'user-1', roles: [], isAuthenticated: () => true, isAdminOrModerator: () => false })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('allows the owner but rejects a different non-admin user', async () => {
      pool.query.mockResolvedValue({ rowCount: 1, rows: [subscriptionRow()] });
      await expect(
        service.getById('sub-1', { id: 'someone-else', roles: [], isAuthenticated: () => true, isAdminOrModerator: () => false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('handleWebhookEvent — charge.success', () => {
    it('ignores a plain one-time-payment charge (no plan on the payload)', async () => {
      await service.handleWebhookEvent({ event: 'charge.success', data: { reference: 'pay_ref_1' } });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('activates a matching pending subscription row (first charge) and publishes subscription.created, not .charged', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [subscriptionRow({ status: 'pending' })] }) // findByGatewayRef
        .mockResolvedValueOnce({ rows: [subscriptionRow({ status: 'active', current_period_end: '2026-09-19T00:00:00.000Z' })] }); // UPDATE

      await service.handleWebhookEvent({
        event: 'charge.success',
        data: { reference: 'sub_ref_1', plan: { plan_code: 'PLN_abc' }, customer: { customer_code: 'CUS_1' } },
      });

      expect(eventPublisher.publishSubscriptionCreated).toHaveBeenCalled();
      expect(eventPublisher.publishSubscriptionCharged).not.toHaveBeenCalled();
    });

    it('extends an already-active subscription (renewal) and publishes subscription.charged, not .created', async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [subscriptionRow({ status: 'active' })] }) // findByGatewayRef
        .mockResolvedValueOnce({ rows: [subscriptionRow({ status: 'active', current_period_end: '2026-10-19T00:00:00.000Z' })] }); // UPDATE

      await service.handleWebhookEvent({
        event: 'charge.success',
        data: { reference: 'sub_ref_1', plan: { plan_code: 'PLN_abc' }, customer: { customer_code: 'CUS_1' } },
      });

      expect(eventPublisher.publishSubscriptionCharged).toHaveBeenCalled();
      expect(eventPublisher.publishSubscriptionCreated).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhookEvent — subscription.disable', () => {
    it('marks the subscription cancelled and publishes subscription.cancelled', async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [subscriptionRow({ status: 'cancelled' })] });

      await service.handleWebhookEvent({ event: 'subscription.disable', data: { subscription_code: 'SUB_1' } });

      expect(eventPublisher.publishSubscriptionCancelled).toHaveBeenCalled();
    });
  });

  describe('sweepFailedSubscriptions — payment_failed -> past_due -> expired timing', () => {
    it('moves an overdue payment_failed subscription to past_due, and an overdue past_due one to expired', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [subscriptionRow({ status: 'past_due' })] }) // -> past_due UPDATE ... RETURNING *
        .mockResolvedValueOnce({ rows: [subscriptionRow({ status: 'expired' })] }); // -> expired UPDATE ... RETURNING *

      await service.sweepFailedSubscriptions();

      const [pastDueSql] = pool.query.mock.calls[0];
      const [expiredSql] = pool.query.mock.calls[1];
      expect(String(pastDueSql)).toMatch(/status = 'past_due'/);
      expect(String(pastDueSql)).toMatch(/status = 'payment_failed'/);
      expect(String(expiredSql)).toMatch(/status = 'expired'/);
      expect(String(expiredSql)).toMatch(/status = 'past_due'/);
      expect(eventPublisher.publishSubscriptionExpired).toHaveBeenCalledTimes(1);
      // payment_failed -> past_due is a silent state change (no consumer needs to react yet —
      // access hasn't ended); only the terminal expired transition is worth an event.
      expect(eventPublisher.publishSubscriptionCancelled).not.toHaveBeenCalled();
    });

    it('does not publish anything when nothing is overdue', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
      await service.sweepFailedSubscriptions();
      expect(eventPublisher.publishSubscriptionExpired).not.toHaveBeenCalled();
    });
  });
});
