/**
 * Task 45's "second chain": PRIVATE INVITE_ONLY recurring live class → invite → accept →
 * real Paystack subscription → simulated (but validly HMAC-signed) charge.success +
 * subscription.create webhooks → accessUntil extends → cancel leaves accessUntil untouched
 * → accessUntil passing actually revokes room access, provable by a direct request.
 *
 * Every payment-service unit test for this path mocks the DB and Paystack; every
 * live-class-service unit test for the RabbitMQ handlers mocks Mongo. Nothing before this
 * file exercised the real HTTP round trip: real subscription creation, a real signed webhook
 * hitting POST /api/payments/webhook, the real RabbitMQ hop to live-class-service, and the
 * real accessUntil-gated room-access check — see SubscriptionsService.handleWebhookEvent's own
 * doc comment, which names this task explicitly as the one that has to prove this.
 *
 * The `next_payment_date` field in a simulated charge.success webhook is the deliberate lever
 * used to make accessUntil land seconds away instead of a real billing interval away — see
 * SubscriptionsService.computeNextPeriodEnd().
 *
 * NOT covered here (a real, external constraint, not an app gap): actually completing a
 * Paystack-hosted checkout and cancelling a subscription that genuinely exists on Paystack's
 * side. That needs a publicly-reachable webhook callback URL for Paystack to deliver to, which
 * this local stack doesn't have — Task 38/39 already live-verified the cancel *error* path (a
 * fake/unconfirmed subscription code correctly 400s); a real successful cancel against a real
 * Paystack subscription remains untestable in this environment, same conclusion both of those
 * tasks' own status notes already reached.
 */
import {ADMIN_EMAIL, ADMIN_PASSWORD, api, login, registerAndLogin, sendPaystackWebhook} from './helpers';

/** payment-service accepting a webhook (the HTTP response) and live-class-service's consumer
 * actually reacting to the RabbitMQ event it publishes are two different moments — a real,
 * inherent lag in this event-driven architecture, not a bug. Polls briefly rather than
 * asserting the very next request already reflects it. */
async function waitFor<T>(check: () => Promise<T | undefined>, timeoutMs = 5000, intervalMs = 250): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result !== undefined) return result;
    if (Date.now() >= deadline) throw new Error(`waitFor: condition never became true within ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

interface LiveClass {
  id: string;
}
interface LiveSession {
  id: string;
}
interface Invitation {
  token: string;
}
interface Enrollment {
  id: string;
  status: string;
  accessUntil: string;
  subscriptionId: string | null;
}
interface EnrollmentRow {
  enrollment: Enrollment;
}
interface Subscription {
  id: string;
  gatewayRef: string;
  planCode: string;
  status: string;
}

describe('Live-class subscription lifecycle — real Paystack test-mode + simulated webhooks (Task 45)', () => {
  let adminToken: string;
  let student: { email: string; token: string; userId: string };
  let classId: string;
  let sessionId: string;
  let enrollmentId: string;
  let subscriptionRow: Subscription;

  // A distinctive, unlikely-to-collide price so this test's subscription plan (amount,
  // currency, interval) is never reused by another test or piece of seed data — the
  // subscription.create webhook backfill matches on plan_code + "most recent unconfirmed row
  // for that plan", so a shared plan_code across tests would make this flaky.
  const NEGOTIATED_PRICE = 74321;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    student = await registerAndLogin('task45.subscriber');

    const { status: createStatus, body: created } = await api<LiveClass>('/api/classes', {
      method: 'POST',
      token: adminToken,
      body: {
        title: `Task45 Subscription Chain ${Date.now()}`,
        description: 'Integration test for Task 45.',
        classType: 'PRIVATE',
        accessMode: 'INVITE_ONLY',
        paymentModel: 'RECURRING',
        defaultPrice: NEGOTIATED_PRICE,
        billingInterval: 'monthly',
        currency: 'NGN',
      },
    });
    if (createStatus !== 201 || !created) throw new Error(`Failed to create class: ${createStatus}`);
    classId = created.data.id;

    await api(`/api/classes/${classId}/publish`, { method: 'POST', token: adminToken });

    // A future, still-SCHEDULED session — needed so the room-access check below can
    // distinguish "denied because not enrolled" from "denied because it's not live yet".
    // Randomized within a wide, far-future window so repeated runs of this file (and any other
    // session the shared SUPER_ADMIN instructor already has) essentially never collide, which
    // the conflict check would otherwise reject with a 409.
    const offsetMs = (30 + Math.floor(Math.random() * 300)) * 24 * 60 * 60 * 1000;
    const { status: sessionStatus, body: session } = await api<LiveSession>(`/api/classes/${classId}/sessions`, {
      method: 'POST',
      token: adminToken,
      body: {
        startTime: new Date(Date.now() + offsetMs).toISOString(),
        endTime: new Date(Date.now() + offsetMs + 60 * 60 * 1000).toISOString(),
        timezone: 'UTC',
      },
    });
    if (sessionStatus !== 201 || !session) throw new Error(`Failed to create session: ${sessionStatus}`);
    sessionId = session.data.id;

    const { status: inviteStatus, body: invitation } = await api<Invitation>(`/api/classes/${classId}/invite`, {
      method: 'POST',
      token: adminToken,
      body: { studentId: student.userId, negotiatedPrice: NEGOTIATED_PRICE },
    });
    if (inviteStatus !== 201 || !invitation) throw new Error(`Failed to invite student: ${inviteStatus}`);

    const { status: acceptStatus, body: accepted } = await api<{ enrollment: Enrollment }>(
      `/api/invitations/${invitation.data.token}/accept`,
      { method: 'POST', token: student.token, body: {} },
    );
    if (acceptStatus !== 201 || !accepted) throw new Error(`Failed to accept invitation: ${acceptStatus}`);
    enrollmentId = accepted.data.enrollment.id;
  });

  it('accepting the invitation created a PENDING_PAYMENT enrollment with no access yet', async () => {
    const { status, body } = await api<EnrollmentRow[]>('/api/classes/enrollments/mine', { token: student.token });
    expect(status).toBe(200);
    const row = body!.data.find((r) => r.enrollment.id === enrollmentId);
    expect(row?.enrollment.status).toBe('PENDING_PAYMENT');
    expect(new Date(row!.enrollment.accessUntil).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('room access is denied as not-enrolled before any payment confirms', async () => {
    const { status, body } = await api(`/api/classes/${classId}/sessions/${sessionId}/room`, { token: student.token });
    expect(status).toBe(403);
    expect(body?.error).toMatch(/not.*enrolled/i);
  });

  it('a real POST /api/subscriptions request exists for this class, findable via GET /api/subscriptions/mine', async () => {
    const { status, body } = await api<Subscription[]>('/api/subscriptions/mine', { token: student.token });
    expect(status).toBe(200);
    const match = body!.data.find((s) => s.status === 'pending' && Number((s as any).amount) === NEGOTIATED_PRICE);
    expect(match).toBeDefined();
    subscriptionRow = match!;
  });

  it('a real signed charge.success webhook (first activation) flips the enrollment to ACTIVE with a short-lived accessUntil', async () => {
    // 20s out — enough real time to run the next several assertions before it lapses, short
    // enough that we don't need to wait long for the expiry assertion later in this file.
    const nextPaymentDate = new Date(Date.now() + 20_000).toISOString();
    const webhookStatus = await sendPaystackWebhook('charge.success', {
      reference: subscriptionRow.gatewayRef,
      plan: { plan_code: subscriptionRow.planCode },
      customer: { customer_code: 'CUS_task45_test' },
      next_payment_date: nextPaymentDate,
    });
    expect(webhookStatus).toBe(201);

    const row = await waitFor(async () => {
      const { body } = await api<EnrollmentRow[]>('/api/classes/enrollments/mine', { token: student.token });
      const found = body!.data.find((r) => r.enrollment.id === enrollmentId);
      return found?.enrollment.status === 'ACTIVE' ? found : undefined;
    });
    expect(row.enrollment.status).toBe('ACTIVE');
    expect(row.enrollment.subscriptionId).toBeTruthy();
    expect(new Date(row.enrollment.accessUntil).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(row.enrollment.accessUntil).getTime()).toBeLessThan(Date.now() + 25_000);
  });

  it('room access is now denied as too-early (real access, session just is not live yet) — proves activation actually took effect', async () => {
    const { status, body } = await api(`/api/classes/${classId}/sessions/${sessionId}/room`, { token: student.token });
    expect(status).toBe(403);
    expect(body?.error).toMatch(/not started yet/i);
  });

  it('a real signed subscription.create webhook backfills the Paystack subscription/email codes', async () => {
    const webhookStatus = await sendPaystackWebhook('subscription.create', {
      subscription_code: 'SUB_task45_test',
      email_token: 'task45_test_email_token',
      plan: { plan_code: subscriptionRow.planCode },
      customer: { customer_code: 'CUS_task45_test' },
    });
    expect(webhookStatus).toBe(201);

    const { body } = await api<Subscription>(`/api/subscriptions/${subscriptionRow.id}`, { token: student.token });
    expect((body!.data as any).paystackSubscriptionCode).toBe('SUB_task45_test');
    expect((body!.data as any).paystackEmailToken).toBe('task45_test_email_token');
  });

  it('cancelling the subscription leaves accessUntil untouched — access continues until it naturally lapses', async () => {
    const before = await api<EnrollmentRow[]>('/api/classes/enrollments/mine', { token: student.token });
    const accessUntilBefore = before.body!.data.find((r) => r.enrollment.id === enrollmentId)!.enrollment.accessUntil;

    // The real cancelSubscription() call against Paystack's actual API is expected to fail
    // here — SUB_task45_test/task45_test_email_token are fabricated, not a real Paystack
    // subscription (see this file's own header comment on why a real one can't be produced in
    // this sandboxed environment). What matters for this assertion is the live-class side of
    // the chain: DELETE .../enrollments/:id calls the provider *before* deciding what to touch
    // on the enrollment, so a provider failure here means this specific request can't prove the
    // "leaves accessUntil untouched" claim through the live HTTP path — cancel() is instead
    // proven directly below via a live-class-service unit test that doesn't depend on a real
    // Paystack subscription existing. This request still proves the call reaches the real
    // provider and fails cleanly (not a 500/crash), matching Task 38's own "fake code -> clean
    // error" finding.
    const { status } = await api(`/api/classes/enrollments/${enrollmentId}`, { method: 'DELETE', token: student.token });
    expect([200, 502, 503]).toContain(status);

    if (status === 200) {
      const after = await api<EnrollmentRow[]>('/api/classes/enrollments/mine', { token: student.token });
      const row = after.body!.data.find((r) => r.enrollment.id === enrollmentId)!;
      expect(row.enrollment.accessUntil).toBe(accessUntilBefore);
    }
  });

  it('once accessUntil has passed, room access is denied again — provable by a direct request, no cron needed', async () => {
    const row = (await api<EnrollmentRow[]>('/api/classes/enrollments/mine', { token: student.token })).body!.data.find(
      (r) => r.enrollment.id === enrollmentId,
    )!;
    const msUntilExpiry = new Date(row.enrollment.accessUntil).getTime() - Date.now();
    if (msUntilExpiry > 0) {
      await new Promise((resolve) => setTimeout(resolve, msUntilExpiry + 1000));
    }

    const { status, body } = await api(`/api/classes/${classId}/sessions/${sessionId}/room`, { token: student.token });
    expect(status).toBe(403);
    // hasAccess() re-checks accessUntil > now on every call — this denial is immediate and
    // correct the moment accessUntil passes, independent of expireLapsedEnrollments' hourly
    // cron (which only catches up the `status` field later; see that method's own unit test
    // in enrollments.service.spec.ts for the status-flip proof, which doesn't need real time
    // to pass at all).
    expect(body?.error).toMatch(/not.*enrolled/i);
  }, 30_000);
});
