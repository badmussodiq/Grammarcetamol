/**
 * Auth flow integration tests — register, duplicate-email rejection, login (including the
 * documented "login works before email verification" behavior — verification only blocks
 * SUSPENDED/DELETED accounts, not PENDING_VERIFICATION), wrong-password rejection, and
 * fetching one's own profile — all against the real running auth-service through the
 * gateway.
 */
import { api, login, uniqueEmail } from './helpers';

describe('Auth flow — real running stack', () => {
  const email = uniqueEmail('auth-flow');
  const password = 'IntegrationTest123!';

  it('POST /api/auth/register — creates a new account', async () => {
    const { status, body } = await api('/api/auth/register', {
      method: 'POST',
      body: { email, password, fullName: 'Integration Test User' },
    });
    expect(status).toBe(200);
    expect(body?.success).toBe(true);
  });

  it('POST /api/auth/register — 409 for a duplicate email', async () => {
    const { status } = await api('/api/auth/register', {
      method: 'POST',
      body: { email, password, fullName: 'Integration Test User' },
    });
    expect(status).toBe(409);
  });

  it('POST /api/auth/login — 401 for the wrong password', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'TotallyWrongPassword123!' },
    });
    expect(status).toBe(401);
  });

  it('POST /api/auth/login — succeeds immediately, before email verification', async () => {
    const token = await login(email, password);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it("GET /api/users/me — returns the logged-in user's own profile", async () => {
    const token = await login(email, password);
    const { status, body } = await api<{ email: string; status: string }>('/api/users/me', { token });
    expect(status).toBe(200);
    expect(body?.data.email).toBe(email);
    // Confirms the "login works before verification" claim isn't just about the login
    // call succeeding — the account genuinely is still unverified at this point.
    expect(body?.data.status).toBe('PENDING_VERIFICATION');
  });

  it('GET /api/users/me — 401 with no token', async () => {
    expect((await api('/api/users/me')).status).toBe(401);
  });
});
