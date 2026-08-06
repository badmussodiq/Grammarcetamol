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

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@grammarcetamol.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
const STUDENT_EMAIL = process.env.STUDENT_EMAIL ?? 'checkout.tester@example.com';
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD ?? 'TestPass123!';

// A syntactically valid UUID that doesn't exist — every check here is about whether the
// auth boundary rejects the caller before the request ever reaches business logic, so the
// target resource never needs to be real.
const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const setCookie = res.headers.get('set-cookie') ?? '';
  const accessToken = /access_token=([^;]+)/.exec(setCookie)?.[1];
  if (!accessToken) {
    throw new Error(`No access_token cookie in login response for ${email}: ${setCookie}`);
  }
  return accessToken;
}

async function statusOf(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<number> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token ? { Cookie: `access_token=${options.token}` } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return res.status;
}

describe('Auth boundary — real running stack', () => {
  let adminToken: string;
  let studentToken: string;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    studentToken = await login(STUDENT_EMAIL, STUDENT_PASSWORD);
  });

  describe('enrollment-service', () => {
    it('POST /api/enrollments — 401 with no token', async () => {
      const status = await statusOf('/api/enrollments', { method: 'POST', body: { courseId: NONEXISTENT_ID } });
      expect(status).toBe(401);
    });

    it('PATCH /api/progress — 401 with no token', async () => {
      expect(await statusOf('/api/progress', { method: 'PATCH', body: {} })).toBe(401);
    });

    it('GET /api/enrollments/mine — 401 with no token', async () => {
      expect(await statusOf('/api/enrollments/mine')).toBe(401);
    });

    it('GET /api/enrollments/at-risk — 401 with no token', async () => {
      expect(await statusOf('/api/enrollments/at-risk')).toBe(401);
    });

    it('GET /api/enrollments/at-risk — 403 for a STUDENT (admin/moderator only)', async () => {
      expect(await statusOf('/api/enrollments/at-risk', { token: studentToken })).toBe(403);
    });

    it('GET /api/enrollments/at-risk — 200 for a SUPER_ADMIN (sanity check)', async () => {
      expect(await statusOf('/api/enrollments/at-risk', { token: adminToken })).toBe(200);
    });

    it('GET /api/enrollments/user/{id} — 401 with no token', async () => {
      expect(await statusOf(`/api/enrollments/user/${NONEXISTENT_ID}`)).toBe(401);
    });

    it('GET /api/enrollments/user/{id} — 403 for a STUDENT (admin/moderator only)', async () => {
      expect(await statusOf(`/api/enrollments/user/${NONEXISTENT_ID}`, { token: studentToken })).toBe(403);
    });
  });

  describe('payment-service', () => {
    it('POST /api/payments/initialize — 401 with no token', async () => {
      const status = await statusOf('/api/payments/initialize', { method: 'POST', body: { courseId: NONEXISTENT_ID } });
      expect(status).toBe(401);
    });

    it('GET /api/payments — 401 with no token', async () => {
      expect(await statusOf('/api/payments')).toBe(401);
    });

    it('GET /api/payments — 403 for a STUDENT (admin/moderator only)', async () => {
      expect(await statusOf('/api/payments', { token: studentToken })).toBe(403);
    });

    it('GET /api/payments — 200 for a SUPER_ADMIN (sanity check)', async () => {
      expect(await statusOf('/api/payments', { token: adminToken })).toBe(200);
    });

    it('GET /api/payments/revenue/summary — 401 with no token', async () => {
      expect(await statusOf('/api/payments/revenue/summary')).toBe(401);
    });

    it('GET /api/payments/revenue/summary — 403 for a STUDENT (admin/moderator only)', async () => {
      expect(await statusOf('/api/payments/revenue/summary', { token: studentToken })).toBe(403);
    });

    it('POST /api/payments/{id}/refund — 401 with no token', async () => {
      const status = await statusOf(`/api/payments/${NONEXISTENT_ID}/refund`, {
        method: 'POST',
        body: { amount: 1, reason: 'integration test' },
      });
      expect(status).toBe(401);
    });

    it('POST /api/payments/{id}/refund — 403 for a STUDENT (SUPER_ADMIN only)', async () => {
      // Body must pass DTO validation (amount/reason required) so the request actually
      // reaches the controller's role check instead of failing validation first — an
      // earlier manual run of this exact check got a false-positive 400 from an empty body.
      const status = await statusOf(`/api/payments/${NONEXISTENT_ID}/refund`, {
        method: 'POST',
        token: studentToken,
        body: { amount: 1, reason: 'integration test' },
      });
      expect(status).toBe(403);
    });
  });

  describe('review-service', () => {
    it('POST /api/reviews — 401 with no token', async () => {
      expect(await statusOf('/api/reviews', { method: 'POST', body: {} })).toBe(401);
    });

    it('GET /api/reviews — 401 with no token (admin list)', async () => {
      expect(await statusOf('/api/reviews')).toBe(401);
    });

    it('GET /api/reviews — 403 for a STUDENT (admin/moderator only)', async () => {
      expect(await statusOf('/api/reviews', { token: studentToken })).toBe(403);
    });

    it('GET /api/reviews — 200 for a SUPER_ADMIN (sanity check)', async () => {
      expect(await statusOf('/api/reviews', { token: adminToken })).toBe(200);
    });

    it('GET /api/reviews/{id} — 401 with no token (admin detail)', async () => {
      expect(await statusOf(`/api/reviews/${NONEXISTENT_ID}`)).toBe(401);
    });

    it('GET /api/reviews/{id} — 403 for a STUDENT (admin/moderator only)', async () => {
      expect(await statusOf(`/api/reviews/${NONEXISTENT_ID}`, { token: studentToken })).toBe(403);
    });

    it('PATCH /api/reviews/{id}/moderate — 401 with no token', async () => {
      const status = await statusOf(`/api/reviews/${NONEXISTENT_ID}/moderate`, {
        method: 'PATCH',
        body: { status: 'approved' },
      });
      expect(status).toBe(401);
    });

    it('PATCH /api/reviews/{id}/moderate — 403 for a STUDENT (admin/moderator only)', async () => {
      const status = await statusOf(`/api/reviews/${NONEXISTENT_ID}/moderate`, {
        method: 'PATCH',
        token: studentToken,
        body: { status: 'approved' },
      });
      expect(status).toBe(403);
    });
  });
});
