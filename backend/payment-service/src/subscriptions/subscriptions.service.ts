import {BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Cron, CronExpression} from '@nestjs/schedule';
import {randomUUID} from 'crypto';
import type {Pool} from 'pg';
import {PG_POOL} from '@/config/database.module';
import {CurrentUserPayload} from '@/common/current-user.decorator';
import {AuthServiceClient} from '@/course-client/auth-service.client';
import {SubscriptionEventPublisher} from '@/messaging/subscription-event-publisher';
import {PaymentProviderRegistry} from '@/providers/payment-provider.registry';
import {mapSubscriptionRow, Subscription} from './subscription.types';

// How long a subscription stays 'past_due' before this service gives up and expires it —
// short on purpose (a few days, not weeks): Paystack's own retry schedule has already run its
// course by the time invoice.payment_failed fires with no more retries left, so this is a final
// grace window for the customer to notice and fix their card, not the primary retry mechanism.
const PAST_DUE_GRACE_DAYS = 3;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly authServiceClient: AuthServiceClient,
    private readonly eventPublisher: SubscriptionEventPublisher,
    private readonly config: ConfigService,
  ) {}

  private activeProvider() {
    return this.providerRegistry.get(this.config.get<string>('PAYMENT_GATEWAY', 'paystack'));
  }

  /**
   * Reuses a cached Plan for this exact (amount, currency, interval) combo, or creates one on
   * the provider and caches it — negotiated private-class prices mean plans can't all be
   * pre-created by hand, so this path has to work for arbitrary amounts, not just a fixed
   * catalog. Verified live against Paystack's real test-mode API (Task 38) that creating a
   * Plan with an arbitrary amount succeeds — Plans aren't restricted to dashboard-predefined
   * pricing tiers.
   */
  private async getOrCreatePlanCode(amount: number, currency: string, interval: string): Promise<string> {
    const cached = await this.pool.query(
      `SELECT plan_code FROM subscription_plans WHERE amount = $1 AND currency = $2 AND interval = $3`,
      [amount, currency, interval],
    );
    if (cached.rowCount && cached.rowCount > 0) {
      return cached.rows[0].plan_code as string;
    }

    const created = await this.activeProvider().createPlan({
      name: `${currency}-${amount}-${interval}`,
      amount,
      currency,
      interval,
    });

    // ON CONFLICT: a concurrent request could race this same (amount,currency,interval) combo
    // between the SELECT above and this INSERT — the unique constraint on subscription_plans
    // makes that race safe (whichever loses just adopts the winner's plan_code) instead of
    // leaving two live Paystack plans for what should be one price point.
    const inserted = await this.pool.query(
      `INSERT INTO subscription_plans (amount, currency, interval, plan_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (amount, currency, interval) DO UPDATE SET amount = subscription_plans.amount
       RETURNING plan_code`,
      [amount, currency, interval, created.planCode],
    );
    return inserted.rows[0].plan_code as string;
  }

  async create(
    userId: string,
    dto: { itemType: string; itemId: string; amount: number; currency?: string; interval: string; email?: string },
  ): Promise<{ reference: string; authorizationUrl?: string; accessCode?: string; publicKey: string; amount: number; currency: string }> {
    const currency = dto.currency ?? 'NGN';
    const email = dto.email ?? (await this.authServiceClient.getUser(userId)).email;

    const planCode = await this.getOrCreatePlanCode(dto.amount, currency, dto.interval);
    const reference = `sub_${randomUUID()}`;
    const provider = this.activeProvider();

    // Call the provider before writing any row — same "don't leave an orphaned row behind a
    // failed provider call" discipline PaymentsService.initialize() already established.
    const init = await provider.initialize({
      amount: dto.amount,
      currency,
      email,
      reference,
      planCode,
      metadata: { userId, itemType: dto.itemType, itemId: dto.itemId },
    });

    // 'pending' until the subscription.create/charge.success webhook confirms the real
    // Paystack subscription code — see subscription.types.ts's status comment.
    await this.pool.query(
      `INSERT INTO subscriptions (user_id, item_type, item_id, plan_code, status, amount, currency, interval, gateway_ref)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)`,
      [userId, dto.itemType, dto.itemId, planCode, dto.amount, currency, dto.interval, init.reference],
    );

    return {
      reference: init.reference,
      accessCode: init.accessCode,
      authorizationUrl: init.authorizationUrl,
      publicKey: this.config.get<string>('PAYSTACK_PUBLIC_KEY', ''),
      amount: dto.amount,
      currency,
    };
  }

  async listMine(userId: string): Promise<Subscription[]> {
    const result = await this.pool.query(`SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
    return result.rows.map(mapSubscriptionRow);
  }

  async getById(id: string, user: CurrentUserPayload): Promise<Subscription> {
    const subscription = await this.findById(id);
    if (subscription.userId !== user.id && !user.isAdminOrModerator()) {
      throw new ForbiddenException('You do not have access to this subscription');
    }
    return subscription;
  }

  /**
   * Cancels on the provider side only — sets status='cancelled' immediately, but deliberately
   * never touches anything outside this service's own subscriptions table. Access/enrollment
   * state belongs entirely to the consuming service (Task 39), which reads currentPeriodEnd
   * from the subscription.cancelled event below to decide when access actually ends — this
   * service enforces nothing about who can still use the class they subscribed to.
   */
  async cancel(id: string, userId: string): Promise<Subscription> {
    const subscription = await this.findById(id);
    if (subscription.userId !== userId) {
      throw new ForbiddenException('You do not own this subscription');
    }
    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      return subscription;
    }
    if (!subscription.paystackSubscriptionCode || !subscription.paystackEmailToken) {
      // The subscription.create webhook hasn't arrived yet — nothing to cancel on the
      // provider's side. Real, not hypothetical: webhook delivery is asynchronous and can lag
      // the initialize call by seconds.
      throw new BadRequestException('This subscription has not been confirmed by the payment provider yet — try again shortly');
    }

    await this.activeProvider().cancelSubscription({
      subscriptionCode: subscription.paystackSubscriptionCode,
      emailToken: subscription.paystackEmailToken,
    });

    const result = await this.pool.query(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    const updated = mapSubscriptionRow(result.rows[0]);

    this.eventPublisher.publishSubscriptionCancelled({
      subscriptionId: updated.id,
      userId: updated.userId,
      itemType: updated.itemType,
      itemId: updated.itemId,
      currentPeriodEnd: updated.currentPeriodEnd,
    });
    this.logger.log(`Subscription ${updated.id} cancelled by owner; access remains until ${updated.currentPeriodEnd}`);
    return updated;
  }

  /**
   * Dispatched from PaymentsService.handleWebhook() for subscription-related event types —
   * this service never registers its own webhook endpoint, per the task's explicit "extend the
   * existing one, don't create a second" instruction.
   *
   * Design note (flagged in PLAN.md as a real risk, not an assumption): Paystack fires
   * charge.success for BOTH the first subscription-creating charge and every renewal, and
   * separately fires subscription.create once the subscription itself exists on their side —
   * these can arrive in either order. charge.success is treated as authoritative for
   * activating/renewing (it always carries `reference` and `metadata`, which is enough to
   * find-or-create the row); subscription.create is treated as best-effort enrichment that
   * backfills subscription_code/email_token (required later for cancellation) by matching on
   * plan_code + customer_code. Neither path has been exercised against a real webhook delivery
   * yet — this sandboxed environment has no publicly-reachable callback URL for Paystack to
   * call — so Task 45's integration pass must verify this against a real webhook, not just
   * the API calls this task itself verified.
   */
  async handleWebhookEvent(event: { event: string; data?: Record<string, unknown> }): Promise<void> {
    switch (event.event) {
      case 'charge.success':
        await this.handleChargeSuccess(event.data);
        return;
      case 'subscription.create':
        await this.handleSubscriptionCreate(event.data);
        return;
      case 'subscription.disable':
        await this.handleSubscriptionDisable(event.data);
        return;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data);
        return;
      default:
        return; // invoice.create and anything else: no action needed on this side
    }
  }

  private async handleChargeSuccess(data: Record<string, unknown> | undefined): Promise<void> {
    const plan = data?.plan as { plan_code?: string } | undefined;
    if (!plan?.plan_code) return; // a one-time payment's charge.success — PaymentsService's own path handles it

    const reference = data?.reference as string | undefined;
    const customer = data?.customer as { customer_code?: string } | undefined;
    const nextPaymentDate = this.computeNextPeriodEnd(data);

    const existing = reference ? await this.findByGatewayRef(reference) : null;
    if (existing) {
      const result = await this.pool.query(
        `UPDATE subscriptions SET status = 'active', current_period_end = $1, paystack_customer_code = COALESCE(paystack_customer_code, $2)
         WHERE id = $3 RETURNING *`,
        [nextPaymentDate, customer?.customer_code ?? null, existing.id],
      );
      const updated = mapSubscriptionRow(result.rows[0]);
      this.eventPublisher.publishSubscriptionCharged({
        subscriptionId: updated.id,
        userId: updated.userId,
        itemType: updated.itemType,
        itemId: updated.itemId,
        currentPeriodEnd: updated.currentPeriodEnd,
      });
      this.logger.log(`Subscription ${updated.id} charged, period extended to ${updated.currentPeriodEnd}`);
      return;
    }

    // First charge for a subscription this service didn't insert a pending row for — shouldn't
    // normally happen since create() always inserts one first, but handled defensively so a
    // lost/delayed insert doesn't silently drop a real payment.
    this.logger.warn(`charge.success for an unknown subscription reference ${reference} — no matching pending row found`);
  }

  private async handleSubscriptionCreate(data: Record<string, unknown> | undefined): Promise<void> {
    const subscriptionCode = data?.subscription_code as string | undefined;
    const emailToken = data?.email_token as string | undefined;
    const plan = data?.plan as { plan_code?: string } | undefined;
    const customer = data?.customer as { customer_code?: string } | undefined;
    if (!subscriptionCode || !plan?.plan_code || !customer?.customer_code) return;

    // Best-effort enrichment: the most recent row for this exact plan+customer combo that
    // doesn't have a subscription_code yet is the one this event belongs to.
    const result = await this.pool.query(
      `UPDATE subscriptions
       SET paystack_subscription_code = $1, paystack_email_token = $2, paystack_customer_code = $3, status = 'active'
       WHERE id = (
         SELECT id FROM subscriptions
         WHERE plan_code = $4 AND paystack_subscription_code IS NULL
         ORDER BY created_at DESC LIMIT 1
       )
       RETURNING id`,
      [subscriptionCode, emailToken, customer.customer_code, plan.plan_code],
    );
    if (result.rowCount && result.rowCount > 0) {
      this.logger.log(`Backfilled subscription_code/email_token for subscription ${result.rows[0].id}`);
    } else {
      this.logger.warn(`subscription.create for plan ${plan.plan_code} matched no pending row`);
    }
  }

  private async handleSubscriptionDisable(data: Record<string, unknown> | undefined): Promise<void> {
    const subscriptionCode = data?.subscription_code as string | undefined;
    if (!subscriptionCode) return;

    // Provider-initiated disable (e.g. from Paystack's own dashboard) — distinct from the
    // owner-initiated cancel() flow above, but converges on the same status.
    const result = await this.pool.query(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW()
       WHERE paystack_subscription_code = $1 AND status NOT IN ('cancelled', 'expired')
       RETURNING *`,
      [subscriptionCode],
    );
    if (!result.rowCount) return;
    const updated = mapSubscriptionRow(result.rows[0]);
    this.eventPublisher.publishSubscriptionCancelled({
      subscriptionId: updated.id,
      userId: updated.userId,
      itemType: updated.itemType,
      itemId: updated.itemId,
      currentPeriodEnd: updated.currentPeriodEnd,
    });
  }

  private async handleInvoicePaymentFailed(data: Record<string, unknown> | undefined): Promise<void> {
    const subscription = data?.subscription as { subscription_code?: string } | undefined;
    const subscriptionCode = subscription?.subscription_code ?? (data?.subscription_code as string | undefined);
    if (!subscriptionCode) return;

    await this.pool.query(
      `UPDATE subscriptions SET status = 'payment_failed'
       WHERE paystack_subscription_code = $1 AND status = 'active'`,
      [subscriptionCode],
    );
    // Deliberately doesn't jump straight to past_due/expired here — Paystack retries a failed
    // charge automatically over the following days; the cron sweep below is what escalates a
    // still-failed subscription once currentPeriodEnd (the last period it actually paid for)
    // is sufficiently in the past that retries have clearly been exhausted.
  }

  /** Escalates payment_failed -> past_due -> expired based on how far past currentPeriodEnd
   * the subscription already is — runs hourly, cheap enough not to need anything smarter. */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepFailedSubscriptions(): Promise<void> {
    const pastDueResult = await this.pool.query(
      `UPDATE subscriptions SET status = 'past_due'
       WHERE status = 'payment_failed' AND current_period_end < NOW()
       RETURNING *`,
    );
    for (const row of pastDueResult.rows) {
      this.logger.log(`Subscription ${row.id} moved to past_due (period ended, payment still failing)`);
    }

    const expiredResult = await this.pool.query(
      `UPDATE subscriptions SET status = 'expired'
       WHERE status = 'past_due' AND current_period_end < NOW() - INTERVAL '${PAST_DUE_GRACE_DAYS} days'
       RETURNING *`,
    );
    for (const row of expiredResult.rows) {
      const updated = mapSubscriptionRow(row);
      this.eventPublisher.publishSubscriptionExpired({
        subscriptionId: updated.id,
        userId: updated.userId,
        itemType: updated.itemType,
        itemId: updated.itemId,
        currentPeriodEnd: updated.currentPeriodEnd,
      });
      this.logger.log(`Subscription ${updated.id} expired after ${PAST_DUE_GRACE_DAYS} days past_due`);
    }
  }

  /** Approximates the next billing date from the plan's own interval — used when a webhook
   * payload doesn't carry an explicit next-payment date. A later subscription.create/invoice
   * event correcting this from Paystack's own authoritative date (when present) just overwrites
   * it, so an approximation here is a safe starting point, not a lasting source of truth. */
  private computeNextPeriodEnd(data: Record<string, unknown> | undefined): Date {
    const explicit = data?.next_payment_date as string | undefined;
    if (explicit) return new Date(explicit);

    const plan = data?.plan as { interval?: string } | undefined;
    const days: Record<string, number> = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      biannually: 182,
      annually: 365,
    };
    const offsetDays = days[plan?.interval ?? 'monthly'] ?? 30;
    return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  }

  private async findById(id: string): Promise<Subscription> {
    const result = await this.pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Subscription not found: ${id}`);
    }
    return mapSubscriptionRow(result.rows[0]);
  }

  private async findByGatewayRef(reference: string): Promise<Subscription | null> {
    const result = await this.pool.query(`SELECT * FROM subscriptions WHERE gateway_ref = $1`, [reference]);
    return result.rowCount ? mapSubscriptionRow(result.rows[0]) : null;
  }
}
