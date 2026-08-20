/**
 * Notification flow integration tests — Task 37 (MVP Integration & Verification), closing
 * out Phase 3.5. Covers everything Tasks 31-36 built but never had automated cross-service
 * coverage for: the OTP verify/reset round-trip (reading the code straight out of Redis, the
 * exact same place auth-service's own checkOtp() reads it from — nothing here is mocked or
 * stubbed), the account-lockout -> locked-email -> OTP-reset recovery chain, a full
 * support-ticket create->close lifecycle with notification_logs assertions proving both
 * emails were actually attempted, and a 401/403 sweep on notification-service's own
 * admin-gated endpoints, mirroring the pattern auth-boundary.integration.spec.ts already
 * established for the other services.
 *
 * Requires the full local stack up (gateway + auth-service + notification-service + Redis +
 * MongoDB) and a seeded SUPER_ADMIN. Run: npm test (from this dir).
 */
import Redis from 'ioredis';
import {ADMIN_EMAIL, ADMIN_PASSWORD, api, login, NONEXISTENT_ID, uniqueEmail} from './helpers';

const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 9010);

/** Gateway's authRateLimiter (RateLimitConfig.java) allows 1 req/s replenish, burst 5, across
 * the whole /api/auth/** path. 1100ms comfortably clears one token's regeneration window. */
const RATE_LIMIT_GAP_MS = 1100;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface NotificationLog {
  service: string;
  templateName: string;
  to: string;
  status: 'sent' | 'failed';
}

interface SupportTicket {
  _id: string;
  status: 'open' | 'closed';
  email: string;
  subject: string;
}

/** Reads an OTP straight out of Redis — the only place it actually lives once issued (it's
 * emailed, never returned by any API response). Mirrors auth-service's own
 * `otp:<purpose>:<email>` key shape from AuthService.issueOtp()/checkOtp(). A short-lived
 * connection per call keeps this test file from needing its own beforeAll/afterAll teardown. */
async function readOtp(purpose: 'verify' | 'fp', email: string): Promise<string> {
  const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    const otp = await redis.get(`otp:${purpose}:${email}`);
    if (!otp) throw new Error(`No OTP found in Redis at otp:${purpose}:${email} — was it issued and not yet expired?`);
    return otp;
  } finally {
    redis.disconnect();
  }
}

/** Polls notification-logs for a specific (templateName, recipient) row — the consumer that
 * writes these processes RabbitMQ messages asynchronously, so the row isn't guaranteed to
 * exist the instant the triggering API call returns. */
async function findNotificationLog(
  adminToken: string,
  templateName: string,
  to: string,
  attempts = 10,
): Promise<NotificationLog | undefined> {
  for (let i = 0; i < attempts; i++) {
    const { body } = await api<{ items: NotificationLog[] }>(
      `/api/notification-logs?limit=100`,
      { token: adminToken },
    );
    const match = body?.data.items.find((l) => l.templateName === templateName && l.to === to);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return undefined;
}

describe('Notification flow — real running stack', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  describe('OTP email verification (Task 32/34)', () => {
    const email = uniqueEmail('notif-verify');
    const password = 'IntegrationTest123!';

    it('register issues a real 6-digit OTP, retrievable from Redis', async () => {
      const { status } = await api('/api/auth/register', {
        method: 'POST',
        body: { email, password, fullName: 'Notification Flow Tester' },
      });
      expect(status).toBe(200);
      const otp = await readOtp('verify', email);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('POST /api/auth/verify-email — 401 for the wrong code', async () => {
      const wrongOtp = (await readOtp('verify', email)) === '000000' ? '111111' : '000000';
      const { status } = await api('/api/auth/verify-email', { method: 'POST', body: { email, otp: wrongOtp } });
      expect(status).toBe(401);
    });

    it('POST /api/auth/verify-email — correct code activates the account', async () => {
      const otp = await readOtp('verify', email);
      const { status } = await api('/api/auth/verify-email', { method: 'POST', body: { email, otp } });
      expect(status).toBe(200);

      const token = await login(email, password);
      const { body } = await api<{ status: string }>('/api/users/me', { token });
      expect(body?.data.status).toBe('ACTIVE');
    });

    it('the verification email was actually attempted — a real notification_logs row exists', async () => {
      const log = await findNotificationLog(adminToken, 'email-verification-otp', email);
      expect(log).toBeDefined();
      expect(log?.status).toBe('sent');
      expect(log?.service).toBe('auth-service');
    });
  });

  describe('Account lockout -> locked email -> OTP password-reset recovery (Task 32/33)', () => {
    const email = uniqueEmail('notif-lockout');
    const originalPassword = 'IntegrationTest123!';
    const newPassword = 'BrandNewPass123!';

    beforeAll(async () => {
      const { status } = await api('/api/auth/register', {
        method: 'POST',
        body: { email, password: originalPassword, fullName: 'Lockout Test User' },
      });
      expect(status).toBe(200);
    });

    it('5 wrong-password attempts locks the account (423) and fires the locked email', async () => {
      // The gateway's authRateLimiter (RateLimitConfig.java: 1 req/s, burst 5) is bound to the
      // whole /api/auth/** path, not just login/register despite its own comment — a tight
      // loop of 5 rapid requests can collide with it and get 429'd before ever reaching
      // auth-service, undercounting real failed attempts. RATE_LIMIT_GAP_MS spaces requests
      // past the 1 req/s replenish rate so every attempt genuinely lands.
      let lastStatus = 0;
      for (let i = 0; i < 5; i++) {
        if (i > 0) await sleep(RATE_LIMIT_GAP_MS);
        const { status } = await api('/api/auth/login', {
          method: 'POST',
          body: { email, password: 'DefinitelyWrongPassword123!' },
        });
        lastStatus = status;
      }
      expect(lastStatus).toBe(423);

      const log = await findNotificationLog(adminToken, 'account-locked', email);
      expect(log).toBeDefined();
      expect(log?.status).toBe('sent');
    });

    it('a 6th attempt, even with the correct password, still 423s while locked', async () => {
      await sleep(RATE_LIMIT_GAP_MS);
      const { status } = await api('/api/auth/login', { method: 'POST', body: { email, password: originalPassword } });
      expect(status).toBe(423);
    });

    it('forgot-password issues a reset OTP even while the account is locked', async () => {
      await sleep(RATE_LIMIT_GAP_MS);
      const { status } = await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      expect(status).toBe(200);
      const otp = await readOtp('fp', email);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('POST /api/auth/reset-password — 401 for the wrong code', async () => {
      await sleep(RATE_LIMIT_GAP_MS);
      const wrongOtp = (await readOtp('fp', email)) === '000000' ? '111111' : '000000';
      const { status } = await api('/api/auth/reset-password', {
        method: 'POST',
        body: { email, otp: wrongOtp, newPassword },
      });
      expect(status).toBe(401);
    });

    it('correct OTP resets the password AND lifts the lockout — login succeeds immediately after', async () => {
      await sleep(RATE_LIMIT_GAP_MS);
      const otp = await readOtp('fp', email);
      const { status: resetStatus } = await api('/api/auth/reset-password', {
        method: 'POST',
        body: { email, otp, newPassword },
      });
      expect(resetStatus).toBe(200);

      await sleep(RATE_LIMIT_GAP_MS);
      // Regression check: resetPassword() previously left failedAttempts/lockedUntil
      // untouched, so a correctly-reset account still 423'd until the 15-minute lock expired
      // naturally. Fixed alongside this test — see AuthService.resetPassword().
      const token = await login(email, newPassword);
      expect(typeof token).toBe('string');
    });

    it('the password-reset email was actually attempted', async () => {
      const log = await findNotificationLog(adminToken, 'password-reset-otp', email);
      expect(log).toBeDefined();
      expect(log?.status).toBe('sent');
    });
  });

  describe('Support ticket create -> close lifecycle (Task 31/34/35)', () => {
    const submitterEmail = uniqueEmail('notif-support');
    let ticketId: string;

    it('POST /api/support/tickets — public, no auth required, creates the ticket', async () => {
      const { status, body } = await api<SupportTicket>('/api/support/tickets', {
        method: 'POST',
        body: {
          name: 'Notification Flow Tester',
          email: submitterEmail,
          subject: 'Integration test enquiry',
          message: 'This ticket exists only to verify the submitted/closed email round-trip.',
        },
      });
      expect(status).toBe(201);
      expect(body?.data._id).toBeDefined();
      expect(body?.data.status).toBe('open');
      ticketId = body!.data._id;
    });

    it('the submitted email was actually attempted', async () => {
      const log = await findNotificationLog(adminToken, 'support-ticket-submitted', submitterEmail);
      expect(log).toBeDefined();
      expect(log?.status).toBe('sent');
    });

    it('GET /api/support/tickets — admin sees the new ticket, filterable by status', async () => {
      const { status, body } = await api<{ items: SupportTicket[] }>('/api/support/tickets?status=open&limit=100', {
        token: adminToken,
      });
      expect(status).toBe(200);
      expect(body?.data.items.some((t) => t._id === ticketId)).toBe(true);
    });

    it('GET /api/support/tickets/{id} — admin sees the submitter email prominently', async () => {
      const { status, body } = await api<SupportTicket>(`/api/support/tickets/${ticketId}`, { token: adminToken });
      expect(status).toBe(200);
      expect(body?.data.email).toBe(submitterEmail);
    });

    it('PATCH /api/support/tickets/{id}/close — closes the ticket and fires the closed email', async () => {
      const { status, body } = await api<SupportTicket>(`/api/support/tickets/${ticketId}/close`, {
        method: 'PATCH',
        token: adminToken,
      });
      expect(status).toBe(200);
      expect(body?.data.status).toBe('closed');

      const log = await findNotificationLog(adminToken, 'support-ticket-closed', submitterEmail);
      expect(log).toBeDefined();
      expect(log?.status).toBe('sent');
    });
  });

  describe('notification-service auth boundary — 401/403 sweep', () => {
    let studentToken: string;

    beforeAll(async () => {
      const email = uniqueEmail('notif-boundary-student');
      const password = 'IntegrationTest123!';
      await api('/api/auth/register', { method: 'POST', body: { email, password, fullName: 'Boundary Test Student' } });
      studentToken = await login(email, password);
    });

    it('GET /api/support/tickets — 401 with no token', async () => {
      expect((await api('/api/support/tickets')).status).toBe(401);
    });

    it('GET /api/support/tickets — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api('/api/support/tickets', { token: studentToken })).status).toBe(403);
    });

    it('GET /api/support/tickets/{id} — 401 with no token', async () => {
      expect((await api(`/api/support/tickets/${NONEXISTENT_ID}`)).status).toBe(401);
    });

    it('PATCH /api/support/tickets/{id}/close — 401 with no token', async () => {
      expect((await api(`/api/support/tickets/${NONEXISTENT_ID}/close`, { method: 'PATCH' })).status).toBe(401);
    });

    it('PATCH /api/support/tickets/{id}/close — 403 for a STUDENT', async () => {
      expect((await api(`/api/support/tickets/${NONEXISTENT_ID}/close`, { method: 'PATCH', token: studentToken })).status).toBe(
        403,
      );
    });

    it('GET /api/notification-logs — 401 with no token', async () => {
      expect((await api('/api/notification-logs')).status).toBe(401);
    });

    it('GET /api/notification-logs — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api('/api/notification-logs', { token: studentToken })).status).toBe(403);
    });

    it('GET /api/notification-logs — 200 for a SUPER_ADMIN (sanity check)', async () => {
      expect((await api('/api/notification-logs', { token: adminToken })).status).toBe(200);
    });
  });
});
