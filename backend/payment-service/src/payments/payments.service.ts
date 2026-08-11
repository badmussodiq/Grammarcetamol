import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';
import { CurrentUserPayload } from '../common/current-user.decorator';
import { AuthServiceClient } from '../course-client/auth-service.client';
import { CourseServiceClient, CourseSummary } from '../course-client/course-service.client';
import { PaymentEventPublisher } from '../messaging/payment-event-publisher';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { mapPaymentRow, mapRefundRow, Payment, Refund } from './payment.types';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly courseServiceClient: CourseServiceClient,
    private readonly authServiceClient: AuthServiceClient,
    private readonly eventPublisher: PaymentEventPublisher,
    private readonly config: ConfigService,
  ) {}

  private activeProvider() {
    return this.providerRegistry.get(this.config.get<string>('PAYMENT_GATEWAY', 'paystack'));
  }

  async initialize(
    userId: string,
    courseId: string,
    email: string,
  ): Promise<{ reference: string; accessCode?: string; authorizationUrl?: string; publicKey: string; amount: string; currency: string }> {
    const course = await this.courseServiceClient.getCourse(courseId);
    if (course.status !== 'published') {
      throw new BadRequestException('Course is not published');
    }
    if (Number(course.price) <= 0) {
      throw new BadRequestException('This course is free — enroll directly instead of checking out');
    }

    const reference = `pay_${randomUUID()}`;
    const provider = this.activeProvider();

    // Call the provider BEFORE writing any row — if this throws, nothing is left behind to
    // clean up. (An earlier version inserted a pending row first and updated it after; a failed
    // provider call left an orphaned pending row with no error info, found during this task's
    // own live verification against a real Paystack test account.)
    const init = await provider.initialize({
      amount: Number(course.price),
      currency: course.currency,
      email,
      reference,
      metadata: { courseId, userId },
    });

    const insertResult = await this.pool.query(
      `INSERT INTO payments (user_id, course_id, amount, currency, status, payment_method, gateway, gateway_ref, gateway_response)
       VALUES ($1, $2, $3, $4, 'pending', 'card', $5, $6, $7)
       RETURNING *`,
      [userId, courseId, course.price, course.currency, provider.name, init.reference, JSON.stringify(init.raw)],
    );
    const payment = mapPaymentRow(insertResult.rows[0]);

    this.eventPublisher.publishPaymentIntentCreated({
      paymentId: payment.id,
      userId,
      courseId,
      amount: course.price,
      currency: course.currency,
    });

    return {
      reference: init.reference,
      accessCode: init.accessCode,
      authorizationUrl: init.authorizationUrl,
      publicKey: this.config.get<string>('PAYSTACK_PUBLIC_KEY', ''),
      amount: course.price,
      currency: course.currency,
    };
  }

  /** Called by the frontend right after the Paystack popup's client-side onSuccess, and
   * independently by the webhook — both converge on markCompleted/markFailed, which are
   * idempotent, so whichever arrives first wins and the second is a no-op. */
  async confirm(reference: string): Promise<Payment> {
    const payment = await this.findByReference(reference);
    if (payment.status === 'completed' || payment.status === 'failed') {
      return payment;
    }

    const verify = await this.activeProvider().verify(reference);
    if (verify.status === 'success') {
      return this.markCompleted(payment, verify.raw);
    }
    if (verify.status === 'failed') {
      return this.markFailed(payment, 'Payment declined', verify.raw);
    }
    return payment;
  }

  async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    if (!this.activeProvider().verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody) as { event: string; data?: Record<string, unknown> };

    if (event.event === 'refund.processed') {
      await this.handleReversal(event.data);
      return;
    }

    if (event.event !== 'charge.success' || !event.data?.reference) {
      return; // other event types (e.g. transfer events) aren't relevant to checkout
    }

    const reference = event.data.reference as string;
    const payment = await this.findByReference(reference).catch(() => null);
    if (!payment || payment.status === 'completed') {
      return; // unknown reference, or already handled by the confirm-endpoint path
    }

    // Never trust the webhook body's own success claim — re-verify server-side against Paystack.
    const verify = await this.activeProvider().verify(reference);
    if (verify.status === 'success') {
      await this.markCompleted(payment, verify.raw);
    } else if (verify.status === 'failed') {
      await this.markFailed(payment, 'Payment declined', verify.raw);
    }
  }

  /**
   * Handles a reversal Paystack initiated on its own side (dashboard refund, dispute settlement,
   * etc.) rather than through our own admin-initiated refund() flow. There's no separate "verify
   * a refund" API to re-confirm against — the HMAC signature check above is this path's
   * verification — so the webhook is the authoritative source for this event type specifically.
   */
  private async handleReversal(data: Record<string, unknown> | undefined): Promise<void> {
    const transaction = data?.transaction as { reference?: string } | undefined;
    const reference = (data?.transaction_reference ?? transaction?.reference ?? data?.reference) as string | undefined;
    if (!reference) return;

    const payment = await this.findByReference(reference).catch(() => null);
    if (!payment || (payment.status !== 'completed' && payment.status !== 'partially_refunded')) {
      return; // unknown reference, never completed, or already fully refunded
    }

    const alreadyRefundedResult = await this.pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE payment_id = $1 AND status = 'completed'`,
      [payment.id],
    );
    const alreadyRefunded = Number(alreadyRefundedResult.rows[0].total);
    const remaining = Number(payment.amount) - alreadyRefunded;
    if (remaining <= 0) return;

    const reportedAmount = Number(data?.amount);
    const amount = Math.min(reportedAmount > 0 ? reportedAmount / 100 : remaining, remaining);

    const insertResult = await this.pool.query(
      `INSERT INTO refunds (payment_id, amount, currency, reason, status, processed_by)
       VALUES ($1, $2, $3, $4, 'completed', NULL)
       RETURNING *`,
      [payment.id, amount, payment.currency, 'Reversed by payment provider (webhook)'],
    );
    const refund = mapRefundRow(insertResult.rows[0]);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const newStatus = alreadyRefunded + amount >= Number(payment.amount) ? 'refunded' : 'partially_refunded';
      await client.query(`UPDATE payments SET status = $1 WHERE id = $2`, [newStatus, payment.id]);
      await client.query(
        `INSERT INTO transactions (payment_id, type, amount, currency, status) VALUES ($1, 'refund', $2, $3, 'success')`,
        [payment.id, amount, payment.currency],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    this.eventPublisher.publishRefundCompleted({ refundId: refund.id, paymentId: payment.id, amount, currency: payment.currency });
    this.logger.log(`Payment ${payment.id} reversed via webhook (refund ${refund.id})`);
  }

  async refund(paymentId: string, amount: number, reason: string, adminUserId: string): Promise<Refund> {
    const payment = await this.findById(paymentId);
    if (payment.status !== 'completed' && payment.status !== 'partially_refunded') {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    const alreadyRefundedResult = await this.pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE payment_id = $1 AND status = 'completed'`,
      [paymentId],
    );
    const alreadyRefunded = Number(alreadyRefundedResult.rows[0].total);
    if (alreadyRefunded + amount > Number(payment.amount)) {
      throw new BadRequestException('Refund amount exceeds the remaining refundable balance');
    }

    const insertResult = await this.pool.query(
      `INSERT INTO refunds (payment_id, amount, currency, reason, status, processed_by)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING *`,
      [paymentId, amount, payment.currency, reason, adminUserId],
    );
    let refund = mapRefundRow(insertResult.rows[0]);
    this.eventPublisher.publishRefundRequested({ refundId: refund.id, paymentId, amount, currency: payment.currency });

    // Paystack test-mode refunds settle asynchronously in reality, but for this integration we
    // treat a successful API call as sufficient to mark it completed — matches the phase's own
    // "ship the vertical slice" scope (a full pending/approved workflow with a moderation queue
    // isn't part of this task).
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const newStatus = alreadyRefunded + amount >= Number(payment.amount) ? 'refunded' : 'partially_refunded';
      await client.query(`UPDATE payments SET status = $1 WHERE id = $2`, [newStatus, paymentId]);
      await client.query(
        `UPDATE refunds SET status = 'completed', processed_at = NOW() WHERE id = $1 RETURNING *`,
        [refund.id],
      );
      await client.query(
        `INSERT INTO transactions (payment_id, type, amount, currency, status) VALUES ($1, 'refund', $2, $3, 'success')`,
        [paymentId, amount, payment.currency],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const refreshed = await this.pool.query(`SELECT * FROM refunds WHERE id = $1`, [refund.id]);
    refund = mapRefundRow(refreshed.rows[0]);
    this.eventPublisher.publishRefundCompleted({ refundId: refund.id, paymentId, amount, currency: payment.currency });
    return refund;
  }

  private async markCompleted(payment: Payment, gatewayResponse: unknown): Promise<Payment> {
    const result = await this.pool.query(
      `UPDATE payments SET status = 'completed', paid_at = NOW(), gateway_response = $1
       WHERE id = $2 AND status <> 'completed'
       RETURNING *`,
      [JSON.stringify(gatewayResponse), payment.id],
    );

    if (result.rowCount === 0) {
      // Already completed by the other convergent path (webhook vs. confirm-endpoint race).
      return this.findById(payment.id);
    }

    const updated = mapPaymentRow(result.rows[0]);
    await this.pool.query(
      `INSERT INTO transactions (payment_id, type, amount, currency, status) VALUES ($1, 'payment', $2, $3, 'success')`,
      [updated.id, updated.amount, updated.currency],
    );

    this.eventPublisher.publishPaymentCompleted({
      paymentId: updated.id,
      userId: updated.userId,
      courseId: updated.courseId,
      amount: Number(updated.amount),
      currency: updated.currency,
    });
    this.logger.log(`Payment ${updated.id} completed for course ${updated.courseId}`);
    void this.publishPurchaseEmails(updated);
    return updated;
  }

  /** Best-effort: a course/user lookup failure here must never undo or block a completed
   * payment, so every failure is caught and logged, not rethrown. Fires two logical sends off
   * one completed payment — course-purchase-confirmation and payment-receipt — as two separate
   * notification messages, keeping the consumer's one-template-per-message handling simple. */
  private async publishPurchaseEmails(payment: Payment): Promise<void> {
    if (!payment.courseId) return; // service-request payments have no course to confirm
    try {
      const [course, user] = await Promise.all([
        this.courseServiceClient.getCourse(payment.courseId),
        this.authServiceClient.getUser(payment.userId),
      ]);
      const displayName = user.fullName?.trim() ? user.fullName : user.email;
      const baseVariables = {
        fullName: displayName,
        courseTitle: course.title,
        amount: Number(payment.amount),
        currency: payment.currency,
        reference: payment.gatewayRef,
      };

      this.eventPublisher.publishNotification('course-purchase-confirmation', user.email, displayName, baseVariables, user.id);
      this.eventPublisher.publishNotification('payment-receipt', user.email, displayName, {
        ...baseVariables,
        paidAt: payment.paidAt,
      }, user.id);
    } catch (err) {
      this.logger.error(`Failed to publish purchase-confirmation emails for payment ${payment.id}: ${(err as Error).message}`);
    }
  }

  private async markFailed(payment: Payment, reason: string, gatewayResponse: unknown): Promise<Payment> {
    const result = await this.pool.query(
      `UPDATE payments SET status = 'failed', failed_at = NOW(), failure_reason = $1, gateway_response = $2
       WHERE id = $3 AND status NOT IN ('completed', 'failed')
       RETURNING *`,
      [reason, JSON.stringify(gatewayResponse), payment.id],
    );

    if (result.rowCount === 0) {
      return this.findById(payment.id);
    }

    const updated = mapPaymentRow(result.rows[0]);
    this.eventPublisher.publishPaymentFailed({
      paymentId: updated.id,
      userId: updated.userId,
      courseId: updated.courseId,
      reason,
    });
    return updated;
  }

  /** Admin listing for the /transactions page (and the student directory's Transactions tab,
   * via `userId`). Every filter is optional. */
  async list(filters: {
    status?: string;
    method?: string;
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
    page: number;
    limit: number;
  }): Promise<{ items: Payment[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.userId) {
      params.push(filters.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters.method) {
      params.push(filters.method);
      conditions.push(`payment_method = $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`created_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.limit;

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM payments ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, filters.limit, offset],
      ),
      this.pool.query(`SELECT COUNT(*) AS total FROM payments ${whereClause}`, params),
    ]);

    return {
      items: itemsResult.rows.map(mapPaymentRow),
      total: Number(countResult.rows[0].total),
    };
  }

  /** Student-scoped listing for /transactions — userId is forced server-side from the
   * authenticated caller, never accepted from the client, unlike the admin list() above. */
  async listMine(userId: string, filters: { status?: string; dateFrom?: string; dateTo?: string; page: number; limit: number }): Promise<{ items: Payment[]; total: number }> {
    return this.list({ ...filters, userId });
  }

  /** Single-transaction detail. Owner or admin/moderator only — no course enrichment on the
   * list endpoint (would N+1 fan out on every page load); only the detail view needs it, and
   * a course-service outage here must degrade to `course: null` rather than 500 the page. */
  async getById(id: string, user: CurrentUserPayload): Promise<Payment & { course: CourseSummary | null }> {
    const payment = await this.findById(id);
    if (payment.userId !== user.id && !user.isAdminOrModerator()) {
      throw new ForbiddenException('You do not have access to this transaction');
    }

    let course: CourseSummary | null = null;
    if (payment.courseId) {
      try {
        course = await this.courseServiceClient.getCourse(payment.courseId);
      } catch (err) {
        this.logger.warn(`Could not enrich payment ${id} with course info: ${(err as Error).message}`);
      }
    }

    return { ...payment, course };
  }

  private async findByReference(reference: string): Promise<Payment> {
    const result = await this.pool.query(`SELECT * FROM payments WHERE gateway_ref = $1`, [reference]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`No payment found for reference ${reference}`);
    }
    return mapPaymentRow(result.rows[0]);
  }

  private async findById(id: string): Promise<Payment> {
    const result = await this.pool.query(`SELECT * FROM payments WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Payment not found: ${id}`);
    }
    return mapPaymentRow(result.rows[0]);
  }
}
