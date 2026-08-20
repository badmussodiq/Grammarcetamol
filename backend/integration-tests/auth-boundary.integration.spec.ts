/**
 * Auth-boundary integration tests — proves the write/admin-gated endpoints on
 * enrollment-service, payment-service, and review-service actually enforce their auth
 * boundary (401 with no token, 403 for the wrong role) through the real gateway, not
 * against mocks. Companion to backend/upload-service/e2e/upload-flow.e2e.ts (same "hits
 * the real running stack" idea), but written as real Jest tests instead of a one-off
 * console script — and cross-service, which is why it lives in its own sibling project
 * rather than inside any one service (matches the "no root project" convention: this
 * folder is its own independently-installable project, same as every other backend/*).
 *
 * Requires the full local stack up (gateway + auth-service + enrollment/payment/review-service)
 * and a seeded SUPER_ADMIN plus one ordinary STUDENT account. Run: npm test (from this dir).
 */
import {ADMIN_EMAIL, ADMIN_PASSWORD, api, login, NONEXISTENT_ID, STUDENT_EMAIL, STUDENT_PASSWORD} from './helpers';

describe('Auth boundary — real running stack', () => {
  let adminToken: string;
  let studentToken: string;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    studentToken = await login(STUDENT_EMAIL, STUDENT_PASSWORD);
  });

  describe('enrollment-service', () => {
    it('POST /api/enrollments — 401 with no token', async () => {
      const { status } = await api('/api/enrollments', { method: 'POST', body: { courseId: NONEXISTENT_ID } });
      expect(status).toBe(401);
    });

    it('PATCH /api/progress — 401 with no token', async () => {
      expect((await api('/api/progress', { method: 'PATCH', body: {} })).status).toBe(401);
    });

    it('GET /api/enrollments/mine — 401 with no token', async () => {
      expect((await api('/api/enrollments/mine')).status).toBe(401);
    });

    it('GET /api/enrollments/at-risk — 401 with no token', async () => {
      expect((await api('/api/enrollments/at-risk')).status).toBe(401);
    });

    it('GET /api/enrollments/at-risk — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api('/api/enrollments/at-risk', { token: studentToken })).status).toBe(403);
    });

    it('GET /api/enrollments/at-risk — 200 for a SUPER_ADMIN (sanity check)', async () => {
      expect((await api('/api/enrollments/at-risk', { token: adminToken })).status).toBe(200);
    });

    it('GET /api/enrollments/user/{id} — 401 with no token', async () => {
      expect((await api(`/api/enrollments/user/${NONEXISTENT_ID}`)).status).toBe(401);
    });

    it('GET /api/enrollments/user/{id} — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/enrollments/user/${NONEXISTENT_ID}`, { token: studentToken })).status).toBe(403);
    });
  });

  describe('payment-service', () => {
    it('POST /api/payments/initialize — 401 with no token', async () => {
      const { status } = await api('/api/payments/initialize', { method: 'POST', body: { courseId: NONEXISTENT_ID } });
      expect(status).toBe(401);
    });

    it('GET /api/payments — 401 with no token', async () => {
      expect((await api('/api/payments')).status).toBe(401);
    });

    it('GET /api/payments — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api('/api/payments', { token: studentToken })).status).toBe(403);
    });

    it('GET /api/payments — 200 for a SUPER_ADMIN (sanity check)', async () => {
      expect((await api('/api/payments', { token: adminToken })).status).toBe(200);
    });

    it('GET /api/payments/revenue/summary — 401 with no token', async () => {
      expect((await api('/api/payments/revenue/summary')).status).toBe(401);
    });

    it('GET /api/payments/revenue/summary — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api('/api/payments/revenue/summary', { token: studentToken })).status).toBe(403);
    });

    it('POST /api/payments/{id}/refund — 401 with no token', async () => {
      const status = (
        await api(`/api/payments/${NONEXISTENT_ID}/refund`, { method: 'POST', body: { amount: 1, reason: 'integration test' } })
      ).status;
      expect(status).toBe(401);
    });

    it('POST /api/payments/{id}/refund — 403 for a STUDENT (SUPER_ADMIN only)', async () => {
      // Body must pass DTO validation (amount/reason required) so the request actually
      // reaches the controller's role check instead of failing validation first — an
      // earlier manual run of this exact check got a false-positive 400 from an empty body.
      const status = (
        await api(`/api/payments/${NONEXISTENT_ID}/refund`, {
          method: 'POST',
          token: studentToken,
          body: { amount: 1, reason: 'integration test' },
        })
      ).status;
      expect(status).toBe(403);
    });
  });

  describe('review-service', () => {
    it('POST /api/reviews — 401 with no token', async () => {
      expect((await api('/api/reviews', { method: 'POST', body: {} })).status).toBe(401);
    });

    it('GET /api/reviews — 401 with no token (admin list)', async () => {
      expect((await api('/api/reviews')).status).toBe(401);
    });

    it('GET /api/reviews — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api('/api/reviews', { token: studentToken })).status).toBe(403);
    });

    it('GET /api/reviews — 200 for a SUPER_ADMIN (sanity check)', async () => {
      expect((await api('/api/reviews', { token: adminToken })).status).toBe(200);
    });

    it('GET /api/reviews/{id} — 401 with no token (admin detail)', async () => {
      expect((await api(`/api/reviews/${NONEXISTENT_ID}`)).status).toBe(401);
    });

    it('GET /api/reviews/{id} — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/reviews/${NONEXISTENT_ID}`, { token: studentToken })).status).toBe(403);
    });

    it('PATCH /api/reviews/{id}/moderate — 401 with no token', async () => {
      const status = (await api(`/api/reviews/${NONEXISTENT_ID}/moderate`, { method: 'PATCH', body: { status: 'approved' } }))
        .status;
      expect(status).toBe(401);
    });

    it('PATCH /api/reviews/{id}/moderate — 403 for a STUDENT (admin/moderator only)', async () => {
      const status = (
        await api(`/api/reviews/${NONEXISTENT_ID}/moderate`, {
          method: 'PATCH',
          token: studentToken,
          body: { status: 'approved' },
        })
      ).status;
      expect(status).toBe(403);
    });
  });

  // Task 45 — nothing before this covered live-class-service's admin-gated endpoints (all of
  // Task 43's admin scheduler surface) or notification-service's announcement endpoints (Task
  // 44). Every admin-only route below checks requireAdminOrModerator(user) as its first line,
  // before ever touching the path id, so a syntactically-valid-but-nonexistent id is safe to use
  // for these 401/403 checks — the same reasoning payment-service's refund check above already
  // established for this file.
  describe('live-class-service', () => {
    it('POST /api/classes — 401 with no token', async () => {
      expect((await api('/api/classes', { method: 'POST', body: { title: 't', description: 'd', classType: 'GROUP', accessMode: 'OPEN', paymentModel: 'FREE' } })).status).toBe(401);
    });

    it('POST /api/classes — 403 for a STUDENT (admin/moderator only)', async () => {
      const status = (
        await api('/api/classes', {
          method: 'POST',
          token: studentToken,
          body: { title: 't', description: 'd', classType: 'GROUP', accessMode: 'OPEN', paymentModel: 'FREE' },
        })
      ).status;
      expect(status).toBe(403);
    });

    it('PATCH /api/classes/{id} — 401 with no token', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}`, { method: 'PATCH', body: {} })).status).toBe(401);
    });

    it('PATCH /api/classes/{id} — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}`, { method: 'PATCH', token: studentToken, body: {} })).status).toBe(403);
    });

    it('POST /api/classes/{id}/publish — 401 with no token', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/publish`, { method: 'POST' })).status).toBe(401);
    });

    it('POST /api/classes/{id}/publish — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/publish`, { method: 'POST', token: studentToken })).status).toBe(403);
    });

    it('POST /api/classes/{id}/end — 401 with no token', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/end`, { method: 'POST' })).status).toBe(401);
    });

    it('POST /api/classes/{id}/end — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/end`, { method: 'POST', token: studentToken })).status).toBe(403);
    });

    it('PATCH /api/classes/{id}/chat-lock — 401 with no token', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/chat-lock`, { method: 'PATCH', body: { locked: true } })).status).toBe(401);
    });

    it('PATCH /api/classes/{id}/chat-lock — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/chat-lock`, { method: 'PATCH', token: studentToken, body: { locked: true } })).status).toBe(403);
    });

    it('POST /api/classes/{id}/sessions — 401 with no token', async () => {
      const body = { startTime: new Date().toISOString(), endTime: new Date().toISOString(), timezone: 'UTC' };
      expect((await api(`/api/classes/${NONEXISTENT_ID}/sessions`, { method: 'POST', body })).status).toBe(401);
    });

    it('POST /api/classes/{id}/sessions — 403 for a STUDENT (admin/moderator only)', async () => {
      const body = { startTime: new Date().toISOString(), endTime: new Date().toISOString(), timezone: 'UTC' };
      expect((await api(`/api/classes/${NONEXISTENT_ID}/sessions`, { method: 'POST', token: studentToken, body })).status).toBe(403);
    });

    it('POST /api/classes/{id}/invite — 401 with no token', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/invite`, { method: 'POST', body: { studentId: NONEXISTENT_ID } })).status).toBe(401);
    });

    it('POST /api/classes/{id}/invite — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/invite`, { method: 'POST', token: studentToken, body: { studentId: NONEXISTENT_ID } })).status).toBe(403);
    });

    it('GET /api/classes/{id}/enrollments — 401 with no token', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/enrollments`)).status).toBe(401);
    });

    it('GET /api/classes/{id}/enrollments — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/enrollments`, { token: studentToken })).status).toBe(403);
    });

    it('GET /api/classes/{id}/invitations — 401 with no token', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/invitations`)).status).toBe(401);
    });

    it('GET /api/classes/{id}/invitations — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/invitations`, { token: studentToken })).status).toBe(403);
    });

    it('POST /api/classes/{id}/materials — 401 with no token', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/materials`, { method: 'POST', body: { title: 't', fileUrl: 'https://example.com/f.pdf' } })).status).toBe(401);
    });

    it('POST /api/classes/{id}/materials — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/classes/${NONEXISTENT_ID}/materials`, { method: 'POST', token: studentToken, body: { title: 't', fileUrl: 'https://example.com/f.pdf' } })).status).toBe(403);
    });

    it('GET /api/instructors/{id}/availability — 401 with no token', async () => {
      expect((await api(`/api/instructors/${NONEXISTENT_ID}/availability?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`)).status).toBe(401);
    });

    it('GET /api/instructors/{id}/availability — 403 for a STUDENT (admin/moderator only)', async () => {
      const url = `/api/instructors/${NONEXISTENT_ID}/availability?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`;
      expect((await api(url, { token: studentToken })).status).toBe(403);
    });

    it('GET /api/instructors/{id}/availability — 200 for a SUPER_ADMIN (sanity check)', async () => {
      const url = `/api/instructors/${NONEXISTENT_ID}/availability?from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`;
      expect((await api(url, { token: adminToken })).status).toBe(200);
    });

    it('DELETE /api/classes/enrollments/{id} — 401 with no token', async () => {
      // Authenticated-only, not admin-gated — ownership is checked at the service layer (a
      // student can cancel their own, an admin can cancel anyone's), exhaustively unit-tested in
      // enrollments.service.spec.ts. Only the 401 boundary belongs in this sweep.
      expect((await api(`/api/classes/enrollments/${NONEXISTENT_ID}`, { method: 'DELETE' })).status).toBe(401);
    });
  });

  describe('notification-service — announcements (Task 44)', () => {
    it('POST /api/announcements — 401 with no token', async () => {
      const body = { title: 't', body: 'b', targetType: 'all', priority: 'low' };
      expect((await api('/api/announcements', { method: 'POST', body })).status).toBe(401);
    });

    it('POST /api/announcements — 403 for a STUDENT (admin/moderator only)', async () => {
      const body = { title: 't', body: 'b', targetType: 'all', priority: 'low' };
      expect((await api('/api/announcements', { method: 'POST', token: studentToken, body })).status).toBe(403);
    });

    it('GET /api/announcements — 401 with no token', async () => {
      expect((await api('/api/announcements')).status).toBe(401);
    });

    it('GET /api/announcements — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api('/api/announcements', { token: studentToken })).status).toBe(403);
    });

    it('GET /api/announcements — 200 for a SUPER_ADMIN (sanity check)', async () => {
      expect((await api('/api/announcements', { token: adminToken })).status).toBe(200);
    });

    it('GET /api/announcements/{id} — 401 with no token', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}`)).status).toBe(401);
    });

    it('GET /api/announcements/{id} — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}`, { token: studentToken })).status).toBe(403);
    });

    it('PATCH /api/announcements/{id} — 401 with no token', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}`, { method: 'PATCH', body: {} })).status).toBe(401);
    });

    it('PATCH /api/announcements/{id} — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}`, { method: 'PATCH', token: studentToken, body: {} })).status).toBe(403);
    });

    it('DELETE /api/announcements/{id} — 401 with no token', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}`, { method: 'DELETE' })).status).toBe(401);
    });

    it('DELETE /api/announcements/{id} — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}`, { method: 'DELETE', token: studentToken })).status).toBe(403);
    });

    it('POST /api/announcements/{id}/publish — 401 with no token', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}/publish`, { method: 'POST' })).status).toBe(401);
    });

    it('POST /api/announcements/{id}/publish — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}/publish`, { method: 'POST', token: studentToken })).status).toBe(403);
    });

    it('POST /api/announcements/{id}/send-test — 401 with no token', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}/send-test`, { method: 'POST' })).status).toBe(401);
    });

    it('POST /api/announcements/{id}/send-test — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}/send-test`, { method: 'POST', token: studentToken })).status).toBe(403);
    });

    it('GET /api/announcements/{id}/recipient-count — 401 with no token', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}/recipient-count`)).status).toBe(401);
    });

    it('GET /api/announcements/{id}/recipient-count — 403 for a STUDENT (admin/moderator only)', async () => {
      expect((await api(`/api/announcements/${NONEXISTENT_ID}/recipient-count`, { token: studentToken })).status).toBe(403);
    });
  });
});
