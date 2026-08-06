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
import { NONEXISTENT_ID, ADMIN_EMAIL, ADMIN_PASSWORD, STUDENT_EMAIL, STUDENT_PASSWORD, api, login } from './helpers';

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
});
