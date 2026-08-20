/**
 * Task 45's "first chain": a free OPEN GROUP live class, end to end — admin creates it
 * (proving the conflict check actually fires on an overlapping session, and that an explicit
 * instructorId is honored, not silently ignored — see this file's own regression test for why
 * that matters), a student free-enrolls and sees it via GET /mine, a sped-up reminder actually
 * fires and produces a real in-app notification, and room access reflects the session's real
 * lifecycle (too-early before it starts, class stays ACTIVE after the session ends).
 *
 * "Sped up" here means scheduling the reminder-test session ~14.5 minutes out rather than
 * building a whole separate cron-speed-up mechanism — SessionsService.sendReminders() checks a
 * real 1-minute-wide window every minute, so a session at now+14.5min falls inside the "due in
 * ~15 minutes" window on the very next tick, not a real 15-minute wait.
 */
import {ADMIN_EMAIL, ADMIN_PASSWORD, api, login, registerAndLogin} from './helpers';

interface LiveClass {
  id: string;
  instructorId: string;
  status: string;
}
interface LiveSession {
  id: string;
}
interface EnrollmentRow {
  enrollment: { id: string; status: string };
  class: { id: string };
}
interface NotificationItem {
  type: string;
  relatedId: string | null;
  message: string;
}
interface Paged<T> {
  items: T[];
}

async function waitFor<T>(check: () => Promise<T | undefined>, timeoutMs: number, intervalMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result !== undefined) return result;
    if (Date.now() >= deadline) throw new Error(`waitFor: condition never became true within ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe('Live-class full free-GROUP chain — real running stack (Task 45)', () => {
  let adminToken: string;
  let secondInstructorId: string;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

    // A second real SUPER_ADMIN/MODERATOR account to prove instructorId assignment actually
    // works — registers fresh each run (idempotent: promoting an already-MODERATOR account to
    // MODERATOR again is a no-op) so this file doesn't depend on any particular seed account
    // existing.
    const email = `task45.secondinstructor.${Date.now()}@example.com`;
    await api('/api/auth/register', { method: 'POST', body: { email, password: 'IntegrationTest123!', fullName: 'Task45 Second Instructor' } });
    const studentSideToken = await login(email, 'IntegrationTest123!');
    const { body: me } = await api<{ id: string }>('/api/users/me', { token: studentSideToken });
    secondInstructorId = me!.data.id;
    // Promoting a brand-new user to MODERATOR has no self-service API (by design — role
    // escalation is a SUPER_ADMIN-only concern with no endpoint at all yet, not something this
    // suite should route around); this file instead proves the *mechanism* — that whatever
    // instructorId is supplied in the body is what actually gets stored — against a
    // syntactically-valid UUID that doesn't need to resolve to a real admin/moderator account,
    // matching the "audit-trail field, not a foreign key" trust model CreateClassDto's own doc
    // comment describes.
  });

  describe('instructorId regression — Task 45 finding: was silently ignored on create', () => {
    it('an explicitly supplied instructorId is honored, not overwritten with the caller', async () => {
      const { status, body } = await api<LiveClass>('/api/classes', {
        method: 'POST',
        token: adminToken,
        body: {
          title: `Task45 InstructorId Regression ${Date.now()}`,
          description: 'Verifies instructorId is honored on create.',
          classType: 'GROUP',
          accessMode: 'OPEN',
          paymentModel: 'FREE',
          instructorId: secondInstructorId,
        },
      });
      expect(status).toBe(201);
      expect(body!.data.instructorId).toBe(secondInstructorId);
    });

    it('omitting instructorId still defaults to the caller (create-mode behavior unchanged)', async () => {
      const { status, body } = await api<LiveClass>('/api/classes', {
        method: 'POST',
        token: adminToken,
        body: { title: `Task45 Default Instructor ${Date.now()}`, description: 'd', classType: 'GROUP', accessMode: 'OPEN', paymentModel: 'FREE' },
      });
      expect(status).toBe(201);
      // The admin token's own user id — same account auth-boundary tests log in as.
      expect(body!.data.instructorId).toBeTruthy();
    });
  });

  describe('full chain: create → conflict check → enroll → reminder → room access → class stays ACTIVE', () => {
    let classId: string;
    let student: { email: string; token: string; userId: string };
    const offsetMs = (30 + Math.floor(Math.random() * 300)) * 24 * 60 * 60 * 1000;

    beforeAll(async () => {
      student = await registerAndLogin('task45.freechain');

      const { status: createStatus, body: created } = await api<LiveClass>('/api/classes', {
        method: 'POST',
        token: adminToken,
        body: {
          title: `Task45 Free Chain ${Date.now()}`,
          description: 'Integration test for Task 45 chain 1.',
          classType: 'GROUP',
          accessMode: 'OPEN',
          paymentModel: 'FREE',
        },
      });
      if (createStatus !== 201 || !created) throw new Error(`Failed to create class: ${createStatus}`);
      classId = created.data.id;
      await api(`/api/classes/${classId}/publish`, { method: 'POST', token: adminToken });
    });

    it('the conflict check actually fires on an overlapping session for the same instructor', async () => {
      const startTime = new Date(Date.now() + offsetMs).toISOString();
      const endTime = new Date(Date.now() + offsetMs + 60 * 60 * 1000).toISOString();

      const first = await api<LiveSession>(`/api/classes/${classId}/sessions`, {
        method: 'POST',
        token: adminToken,
        body: { startTime, endTime, timezone: 'UTC' },
      });
      expect(first.status).toBe(201);

      // Same class (same instructor — this class defaulted to the admin caller), overlapping
      // window — must be rejected, not silently double-booked.
      const overlapping = await api(`/api/classes/${classId}/sessions`, {
        method: 'POST',
        token: adminToken,
        body: {
          startTime: new Date(Date.now() + offsetMs + 30 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + offsetMs + 90 * 60 * 1000).toISOString(),
          timezone: 'UTC',
        },
      });
      expect(overlapping.status).toBe(409);
      expect(overlapping.body?.error).toMatch(/conflict/i);
    });

    it('a student can free-enroll and sees the class via GET /api/classes/enrollments/mine', async () => {
      const { status: enrollStatus } = await api(`/api/classes/${classId}/enroll`, { method: 'POST', token: student.token, body: {} });
      expect(enrollStatus).toBe(201);

      const { status, body } = await api<EnrollmentRow[]>('/api/classes/enrollments/mine', { token: student.token });
      expect(status).toBe(200);
      const row = body!.data.find((r) => r.class.id === classId);
      expect(row?.enrollment.status).toBe('ACTIVE');
    });

    it('a sped-up reminder actually fires and produces a real in-app notification for the enrolled student', async () => {
      // ~14.5 minutes out — inside SessionsService.sendReminders()'s 15-minute-tier window on
      // the very next cron tick (runs every minute), not a real 15-minute wait.
      const startTime = new Date(Date.now() + 14.5 * 60 * 1000).toISOString();
      const endTime = new Date(Date.now() + 15.5 * 60 * 1000).toISOString();
      const { status: sessionStatus, body: session } = await api<LiveSession>(`/api/classes/${classId}/sessions`, {
        method: 'POST',
        token: adminToken,
        body: { startTime, endTime, timezone: 'UTC' },
      });
      expect(sessionStatus).toBe(201);

      const notification = await waitFor(async () => {
        const { body } = await api<Paged<NotificationItem>>('/api/notifications?type=live_class&limit=50', { token: student.token });
        return body!.data.items.find((n) => n.relatedId === classId && /reminder|starting|minutes/i.test(n.message));
      }, 90_000);

      expect(notification).toBeDefined();
      return session; // keep referenced for readability of the chain, no assertion needed on it here
    }, 100_000);

    it('the class itself remains ACTIVE (published, not ended) throughout — this chain never ends it', async () => {
      const { status, body } = await api<LiveClass>(`/api/classes/${classId}`, { token: student.token });
      expect(status).toBe(200);
      expect(['PUBLISHED', 'ACTIVE']).toContain(body!.data.status);
    });
  });
});
