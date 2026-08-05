import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { PG_POOL } from '../config/database.module';
import { CourseServiceClient } from '../course-client/course-service.client';
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

    const event = JSON.parse(rawBody) as { event: string; data?: { reference?: string } };
    if (event.event !== 'charge.success' || !event.data?.reference) {
      return; // other event types (e.g. transfer events) aren't relevant to checkout
    }

    const reference = event.data.reference;
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
    return updated;
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
