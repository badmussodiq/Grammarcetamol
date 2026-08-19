/**
 * Live-class enrollment routing + invitation preview — Task 41 groundwork.
 *
 * Building the student frontend surfaced two real backend gaps that had no coverage:
 *  1. There was no way at all to list a student's own live-class enrollments. Adding
 *     GET /api/classes/enrollments/mine also surfaced a genuine route collision: it would have
 *     been silently swallowed by course-enrollment-service's broader, first-registered
 *     /api/enrollments/** gateway route — which already owns its own GET /api/enrollments/mine
 *     for course enrollments, a real name collision between two different domains, not just an
 *     ordering fix. Nesting under /api/classes/enrollments/** (a prefix live-class-service
 *     already exclusively owns) was the fix; this file proves both routes now resolve to the
 *     right service and neither shadows the other.
 *  2. There was no way to preview an invitation (class/instructor/schedule/price) before
 *     accepting it, despite PLAN.md's own spec calling for exactly that. Added
 *     GET /api/invitations/:token, public (no auth) but never exposing the invited student's
 *     identity — only accepting it needs a real session.
 *
 * Requires the full local stack up (gateway + auth-service + live-class-service +
 * enrollment-service) and a seeded SUPER_ADMIN.
 */
import {ADMIN_EMAIL, ADMIN_PASSWORD, api, login, NONEXISTENT_ID, registerAndLogin} from './helpers';

describe('Live-class enrollments + invitation preview — real running stack (Task 41)', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  }, 30000);

  describe('GET /api/classes/enrollments/mine vs. GET /api/enrollments/mine — no collision', () => {
    let student: { email: string; token: string };
    let classId: string;

    beforeAll(async () => {
      student = await registerAndLogin('liveclass-mine');

      const { status: createStatus, body: created } = await api<{ id: string }>('/api/classes', {
        method: 'POST',
        token: adminToken,
        body: {
          title: `Integration Test Class ${Date.now()}`,
          description: 'Verifies /api/classes/enrollments/mine does not collide with course enrollments.',
          classType: 'GROUP',
          accessMode: 'OPEN',
          paymentModel: 'FREE',
        },
      });
      expect(createStatus).toBe(201);
      classId = created!.data.id;
      await api(`/api/classes/${classId}/publish`, { method: 'POST', token: adminToken });
      const { status: enrollStatus } = await api(`/api/classes/${classId}/enroll`, { method: 'POST', token: student.token, body: {} });
      expect(enrollStatus).toBe(201);
    }, 30000);

    afterAll(async () => {
      if (classId) await api(`/api/classes/${classId}/end`, { method: 'POST', token: adminToken });
    }, 30000);

    it('GET /api/classes/enrollments/mine returns the real live-class enrollment, resolved with its class', async () => {
      const { status, body } = await api<{ enrollment: { classId: string; status: string }; class: { id: string; title: string } }[]>(
        '/api/classes/enrollments/mine',
        { token: student.token },
      );
      expect(status).toBe(200);
      const row = body?.data.find((r) => r.enrollment.classId === classId);
      expect(row).toBeDefined();
      expect(row?.enrollment.status).toBe('ACTIVE');
      expect(row?.class.id).toBe(classId);
    });

    it('GET /api/enrollments/mine (course-enrollment-service) is untouched — returns course data, not live-class data', async () => {
      const { status, body } = await api<unknown[]>('/api/enrollments/mine', { token: student.token });
      expect(status).toBe(200);
      // Whatever it returns, it must never contain a live-class row — proves the routes
      // actually resolved to two different services rather than one swallowing the other.
      expect(JSON.stringify(body)).not.toContain(classId);
    });

    it('DELETE /api/classes/enrollments/{id} reaches live-class-service, not course-enrollment-service (distinct 404 shape)', async () => {
      const { status, body } = await api(`/api/classes/enrollments/${NONEXISTENT_ID}`, { method: 'DELETE', token: student.token });
      expect(status).toBe(404);
      expect(body?.error).toMatch(/Enrollment not found/);
    });
  });

  describe('GET /api/invitations/:token — public preview', () => {
    let student: { email: string; token: string; userId: string };
    let classId: string;
    let token: string;

    beforeAll(async () => {
      student = await registerAndLogin('invite-preview');

      const { body: created } = await api<{ id: string }>('/api/classes', {
        method: 'POST',
        token: adminToken,
        body: {
          title: `Invite-Only Test Class ${Date.now()}`,
          description: 'Verifies the invitation preview endpoint.',
          classType: 'PRIVATE',
          accessMode: 'INVITE_ONLY',
          paymentModel: 'ONE_TIME',
          defaultPrice: 15000,
        },
      });
      classId = created!.data.id;
      await api(`/api/classes/${classId}/publish`, { method: 'POST', token: adminToken });

      const { status: inviteStatus, body: invitation } = await api<{ token: string }>(`/api/classes/${classId}/invite`, {
        method: 'POST',
        token: adminToken,
        body: { studentId: student.userId, negotiatedPrice: 10000 },
      });
      expect(inviteStatus).toBe(201);
      token = invitation!.data.token;
    }, 30000);

    afterAll(async () => {
      if (classId) await api(`/api/classes/${classId}/end`, { method: 'POST', token: adminToken });
    }, 30000);

    it('is viewable with no auth token at all — a visitor must see it before logging in', async () => {
      const { status, body } = await api<{ status: string; negotiatedPrice: number; class: { id: string; title: string } }>(
        `/api/invitations/${token}`,
      );
      expect(status).toBe(200);
      expect(body?.data.status).toBe('pending');
      expect(body?.data.negotiatedPrice).toBe(10000);
      expect(body?.data.class.id).toBe(classId);
    });

    it('never includes the invited student\'s identity in the preview response', async () => {
      const { body } = await api(`/api/invitations/${token}`);
      expect(JSON.stringify(body)).not.toContain(student.userId);
    });

    it('404s for an unknown token', async () => {
      const { status } = await api('/api/invitations/not-a-real-token-at-all');
      expect(status).toBe(404);
    });
  });
});
