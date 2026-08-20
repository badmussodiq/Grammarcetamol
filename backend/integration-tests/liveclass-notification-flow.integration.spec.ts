/**
 * Live class + notification-service extension integration tests — Task 40 (Notification
 * Service: in-app center population, SSE, preferences, Announcements) and the cross-service
 * wiring it depends on in live-class-service (EnrolledStudentNotifier -> liveclass.exchange).
 *
 * This file exists because Task 40 was previously only proven with ad-hoc manual `curl`
 * verification against a live stack, not automated coverage — a real gap the project's own
 * "verify against the real stack, not mocks, and keep the proof" discipline calls out
 * (see notification-flow.integration.spec.ts's own header for the established pattern this
 * file follows). Everything here hits the real running stack through the gateway.
 *
 * Requires the full local stack up (gateway + auth-service + enrollment-service +
 * live-class-service + payment-service + notification-service + Redis + the dedicated
 * notification/live-class MongoDB + RabbitMQ) and a seeded SUPER_ADMIN. Run: npm test.
 */
import Redis from 'ioredis';
import {ADMIN_EMAIL, ADMIN_PASSWORD, api, GATEWAY_URL, login, registerAndLogin, uniqueEmail} from './helpers';

const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 9010);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface InAppNotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

interface ChannelPreference {
  inApp: boolean;
  email: boolean;
}

interface Preferences {
  course: ChannelPreference;
  payment: ChannelPreference;
  live_class: ChannelPreference;
  announcement: ChannelPreference;
}

/** Same rationale as notification-flow.integration.spec.ts's own readOtp: the OTP is only
 * ever emailed, never returned by an API response, so Redis is the one place a test can
 * legitimately read it from. Duplicated here rather than hoisted into helpers.ts, matching
 * that file's own precedent of keeping each flow's OTP reading local to itself. */
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

/** `listActiveStudents()` (auth-service, backing 'all'-targeted announcements) filters on
 * `status = ACTIVE` — a freshly `registerAndLogin`-ed account is `PENDING_VERIFICATION` and
 * would silently never receive an 'all' announcement, which would make this file's fan-out
 * assertions pass or fail for the wrong reason. Verifying for real, the same OTP round-trip a
 * real student goes through, is what actually exercises the real recipient-resolution path. */
async function registerVerifiedStudent(prefix: string): Promise<{ email: string; token: string }> {
  const email = uniqueEmail(prefix);
  const password = 'IntegrationTest123!';
  const { status: regStatus } = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password, fullName: 'Live Class Notification Tester' },
  });
  if (regStatus !== 200) throw new Error(`Failed to register ${email}: status ${regStatus}`);
  const otp = await readOtp('verify', email);
  const { status: verifyStatus } = await api('/api/auth/verify-email', { method: 'POST', body: { email, otp } });
  if (verifyStatus !== 200) throw new Error(`Failed to verify ${email}: status ${verifyStatus}`);
  const token = await login(email, password);
  return { email, token };
}

/** Polls a student's own in-app notification list for a row matching `type`+`title` — the
 * consumer that writes these processes the underlying RabbitMQ message asynchronously, so a
 * row isn't guaranteed to exist the instant the triggering API call returns (same rationale
 * as notification-flow.integration.spec.ts's findNotificationLog). */
async function findInAppNotification(
  studentToken: string,
  type: string,
  title: string,
  attempts = 15,
): Promise<InAppNotification | undefined> {
  for (let i = 0; i < attempts; i++) {
    const { body } = await api<{ items: InAppNotification[] }>('/api/notifications?limit=50', { token: studentToken });
    const match = body?.data.items.find((n) => n.type === type && n.title === title);
    if (match) return match;
    await sleep(300);
  }
  return undefined;
}

/** Opens a real SSE connection through the gateway and resolves with the first event's parsed
 * JSON payload, or `null` if nothing arrives before `timeoutMs`. This is the actual automated
 * check for the risk PLAN.md/PHASE4.md flagged by name: SSE must genuinely stream through
 * Spring Cloud Gateway's Netty reactive proxy without being buffered — a manual `curl -N`
 * during Task 40's build proved this once; this is what keeps it proven. */
async function captureSseEvent(studentToken: string, timeoutMs: number): Promise<{ type: string; title: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GATEWAY_URL}/api/notifications/stream`, {
      headers: { Cookie: `access_token=${studentToken}` },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) return null;
      buffer += decoder.decode(value, { stream: true });
      const match = /^data: (.+)$/m.exec(buffer);
      if (match) {
        const parsed = JSON.parse(match[1]);
        return { type: parsed.type, title: parsed.title };
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

describe('Live class + notification extension flow — real running stack (Task 40)', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  describe('Notification preferences — partial update (regression for a real Task 40 bug)', () => {
    let student: { email: string; token: string };

    beforeAll(async () => {
      student = await registerAndLogin('prefs-partial');
    }, 30000);

    it('GET /api/notification-preferences defaults every type to fully opted-in', async () => {
      const { status, body } = await api<Preferences>('/api/notification-preferences', { token: student.token });
      expect(status).toBe(200);
      expect(body?.data).toEqual({
        course: { inApp: true, email: true },
        payment: { inApp: true, email: true },
        live_class: { inApp: true, email: true },
        announcement: { inApp: true, email: true },
      });
    });

    it('PUT with only one type present succeeds — previously 400ed because @IsOptional() was missing from UpdatePreferencesDto', async () => {
      const { status, body } = await api<Preferences>('/api/notification-preferences', {
        method: 'PUT',
        token: student.token,
        body: { announcement: { inApp: false, email: true } },
      });
      expect(status).toBe(200);
      expect(body?.data.announcement).toEqual({ inApp: false, email: true });
      // The three untouched types must survive the partial update, not get dropped/reset.
      expect(body?.data.course).toEqual({ inApp: true, email: true });
      expect(body?.data.payment).toEqual({ inApp: true, email: true });
      expect(body?.data.live_class).toEqual({ inApp: true, email: true });
    });

    it('the partial update actually persisted — a fresh GET reflects it', async () => {
      const { body } = await api<Preferences>('/api/notification-preferences', { token: student.token });
      expect(body?.data.announcement).toEqual({ inApp: false, email: true });
    });

    it('a still-malformed channel preference is still rejected (the fix did not just disable validation)', async () => {
      const { status } = await api('/api/notification-preferences', {
        method: 'PUT',
        token: student.token,
        body: { course: { inApp: 'not-a-boolean', email: true } },
      });
      expect(status).toBe(400);
    });
  });

  describe('Announcement fan-out + SSE (Task 40)', () => {
    let student: { email: string; token: string };

    beforeAll(async () => {
      student = await registerVerifiedStudent('announce-fanout');
    }, 30000);

    it('a high-priority "all" announcement resolves the verified student as a real recipient and writes an in-app row', async () => {
      const title = `Integration test announcement ${Date.now()}`;
      const { status: createStatus, body: created } = await api<{ id: string }>('/api/announcements', {
        method: 'POST',
        token: adminToken,
        body: { title, body: 'Fan-out coverage for Task 40.', targetType: 'all', priority: 'high' },
      });
      expect(createStatus).toBe(201);
      const id = created!.data.id;

      const { status: publishStatus, body: published } = await api<{ recipientCount: number }>(
        `/api/announcements/${id}/publish`,
        { method: 'POST', token: adminToken },
      );
      expect(publishStatus).toBe(201);
      // At minimum the freshly-verified student itself, plus whatever other real ACTIVE
      // students already exist in this environment.
      expect(published!.data.recipientCount).toBeGreaterThanOrEqual(1);

      const row = await findInAppNotification(student.token, 'announcement', title);
      expect(row).toBeDefined();
      expect(row?.message).toBe('Fan-out coverage for Task 40.');
    }, 30000);

    // Task 45's own third chain: "the recipient-count estimate matches the actual fan-out
    // count" — the pre-publish GET .../recipient-count preview and doPublish()'s own resolved
    // recipient list call the exact same resolveRecipients() under the hood, so this is really
    // proving they haven't drifted apart (a low priority announcement, deliberately — no real
    // email is sent for it, keeping this test independent of the SMTP-volume timing concern the
    // high/critical-priority tests above are already subject to).
    it('the pre-publish recipient-count estimate matches the real fan-out count on publish', async () => {
      const title = `Integration test recipient-count parity ${Date.now()}`;
      const { body: created } = await api<{ id: string }>('/api/announcements', {
        method: 'POST',
        token: adminToken,
        body: { title, body: 'Recipient-count parity coverage for Task 45.', targetType: 'all', priority: 'low' },
      });
      const id = created!.data.id;

      const { status: countStatus, body: estimate } = await api<{ count: number }>(`/api/announcements/${id}/recipient-count`, { token: adminToken });
      expect(countStatus).toBe(200);

      const { status: publishStatus, body: published } = await api<{ recipientCount: number }>(`/api/announcements/${id}/publish`, { method: 'POST', token: adminToken });
      expect(publishStatus).toBe(201);

      expect(published!.data.recipientCount).toBe(estimate!.data.count);
    }, 30000);

    it('SSE stream delivers that same event live through the gateway, with no buffering', async () => {
      const title = `Integration test SSE announcement ${Date.now()}`;
      const ssePromise = captureSseEvent(student.token, 10000);
      await sleep(500); // let the SSE connection actually establish before publishing

      const { body: created } = await api<{ id: string }>('/api/announcements', {
        method: 'POST',
        token: adminToken,
        body: { title, body: 'SSE coverage for Task 40.', targetType: 'all', priority: 'critical' },
      });
      await api(`/api/announcements/${created!.data.id}/publish`, { method: 'POST', token: adminToken });

      const event = await ssePromise;
      expect(event).not.toBeNull();
      expect(event?.type).toBe('announcement');
      expect(event?.title).toBe(title);
    }, 30000);
  });

  describe('Preference gating actually suppresses delivery (regression for the same Task 40 bug)', () => {
    it('disabling in-app announcements means the next published announcement leaves no new row for that student', async () => {
      const student = await registerVerifiedStudent('gating');
      const { status: prefStatus } = await api('/api/notification-preferences', {
        method: 'PUT',
        token: student.token,
        body: { announcement: { inApp: false, email: true } },
      });
      expect(prefStatus).toBe(200);

      const title = `Should not appear in-app ${Date.now()}`;
      const { body: created } = await api<{ id: string }>('/api/announcements', {
        method: 'POST',
        token: adminToken,
        body: { title, body: 'Gating coverage for Task 40.', targetType: 'all', priority: 'high' },
      });
      const { status: publishStatus, body: published } = await api<{ recipientCount: number }>(
        `/api/announcements/${created!.data.id}/publish`,
        { method: 'POST', token: adminToken },
      );
      expect(publishStatus).toBe(201);
      // Still a real resolved recipient — gating happens at delivery time, not resolution time.
      expect(published!.data.recipientCount).toBeGreaterThanOrEqual(1);

      // Give the async consumer a fair chance to have written a row if the gate failed open.
      await sleep(2000);
      const { body } = await api<{ items: InAppNotification[] }>('/api/notifications?limit=50', { token: student.token });
      expect(body?.data.items.some((n) => n.title === title)).toBe(false);
    }, 30000);
  });

  describe('Live-class session-start fan-out via the new liveclass.exchange binding (Task 40)', () => {
    let student: { email: string; token: string };
    let classId: string;
    let sessionId: string;

    beforeAll(async () => {
      student = await registerVerifiedStudent('liveclass-notif');

      const { status: createStatus, body: created } = await api<{ id: string }>('/api/classes', {
        method: 'POST',
        token: adminToken,
        body: {
          title: `Integration Test Class ${Date.now()}`,
          description: 'Verifies live-class-service -> liveclass.exchange -> notification-service.',
          classType: 'GROUP',
          accessMode: 'OPEN',
          paymentModel: 'FREE',
        },
      });
      expect(createStatus).toBe(201);
      classId = created!.data.id;

      const { status: publishStatus } = await api(`/api/classes/${classId}/publish`, { method: 'POST', token: adminToken });
      expect(publishStatus).toBe(201);

      const { status: enrollStatus } = await api(`/api/classes/${classId}/enroll`, {
        method: 'POST',
        token: student.token,
        body: {},
      });
      expect(enrollStatus).toBe(201);

      // Randomized far-future window (SessionsService.start() has no time-window check — only
      // status === SCHEDULED matters) rather than a fixed near-term offset, so this doesn't
      // collide with any other test's or manual-testing's session for this same shared
      // SUPER_ADMIN instructor — a real, repeatedly-observed flakiness source (Task 45).
      const offsetMs = (30 + Math.floor(Math.random() * 300)) * 24 * 60 * 60 * 1000;
      const startTime = new Date(Date.now() + offsetMs).toISOString();
      const endTime = new Date(Date.now() + offsetMs + 60 * 60_000).toISOString();
      const { status: sessionStatus, body: session } = await api<{ id: string }>(`/api/classes/${classId}/sessions`, {
        method: 'POST',
        token: adminToken,
        body: { startTime, endTime, timezone: 'UTC' },
      });
      expect(sessionStatus).toBe(201);
      sessionId = session!.data.id;
    }, 30000);

    afterAll(async () => {
      if (sessionId) await api(`/api/sessions/${sessionId}/end`, { method: 'POST', token: adminToken });
      if (classId) await api(`/api/classes/${classId}/end`, { method: 'POST', token: adminToken });
    }, 30000);

    it('created session never leaks roomId/videoDomain in the API response', async () => {
      const { body } = await api<Record<string, unknown>>(`/api/classes/${classId}/sessions`, { token: student.token });
      expect(JSON.stringify(body)).not.toMatch(/roomId|videoDomain/);
    });

    it('starting the session publishes a real live-class-starting notification to the enrolled student', async () => {
      const { status } = await api(`/api/sessions/${sessionId}/start`, { method: 'POST', token: adminToken });
      expect(status).toBe(201);

      const row = await findInAppNotification(student.token, 'live_class', 'Class is starting');
      expect(row).toBeDefined();
    });
  });
});
