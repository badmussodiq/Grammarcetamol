/**
 * Shared helpers for every *.integration.spec.ts in this project — all of them hit the
 * real running stack through the gateway via `fetch`, never mocks. Centralized here so
 * each spec file only contains the behavior it's actually asserting.
 */
import {createHmac} from 'crypto';

export const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:9000';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@grammarcetamol.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
export const STUDENT_EMAIL = process.env.STUDENT_EMAIL ?? 'checkout.tester@example.com';
export const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD ?? 'TestPass123!';
// A real Paystack test-mode secret key (sk_test_...) — same low-sensitivity local-dev-default
// pattern as ADMIN_PASSWORD above. Needed to compute a signature payment-service's
// verifyWebhookSignature() will actually accept, for tests that simulate a real webhook
// delivery (Paystack has no test-mode way to trigger one against a non-public callback URL).
export const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? 'sk_test_627e02df4c7884bdf9161f0f613ba92c409ba1ea';

// A syntactically valid UUID that doesn't exist — useful for checks that only care whether
// a request is rejected before it reaches the point where the target resource matters.
export const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export async function login(email: string, password: string): Promise<string> {
  // Same 429-retry rationale as api() below — /api/auth/login shares the gateway's
  // suite-wide rate-limit bucket with every other /api/auth/** call.
  let res: Response;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status !== 429 || attempt >= 4) break;
    await sleep(1100);
  }
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function api<T = unknown>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<{ status: number; body: ApiEnvelope<T> | null }> {
  // The gateway's authRateLimiter (1 req/s, burst 5) is bound to the whole /api/auth/** path
  // — this whole test suite runs serially against one shared IP-scoped bucket, so a spec file
  // that legitimately needs several rapid auth calls (e.g. notification-flow's OTP/lockout
  // tests) can leave the bucket depleted for whichever spec file runs next. Retrying 429s with
  // a backoff here — the one place every spec file's auth traffic already funnels through —
  // fixes it for the whole suite instead of hand-pacing each caller. No test in this suite
  // asserts a 429 response itself, so this can't mask a real assertion.
  const isAuthPath = path.startsWith('/api/auth/');
  const maxAttempts = isAuthPath ? 4 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.token ? { Cookie: `access_token=${options.token}` } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 429 && attempt < maxAttempts) {
      await sleep(1100);
      continue;
    }

    let body: ApiEnvelope<T> | null = null;
    try {
      body = (await res.json()) as ApiEnvelope<T>;
    } catch {
      body = null;
    }
    return { status: res.status, body };
  }
  // Unreachable — the loop always returns on its last iteration — but keeps TypeScript happy.
  throw new Error(`api(${path}): exhausted retries`);
}

export function uniqueEmail(prefix: string): string {
  // example.com (RFC 2606 reserved) rather than a made-up TLD like .local or .test — payment
  // flow tests send this straight to Paystack's real API, which validates the email format
  // and rejects non-standard TLDs with "Invalid Email Address Passed".
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.com`;
}

/** Registers a fresh student account and returns a logged-in session for it. */
export async function registerAndLogin(
  prefix: string,
  password = 'IntegrationTest123!',
): Promise<{ email: string; token: string; userId: string }> {
  const email = uniqueEmail(prefix);
  const { status } = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password, fullName: 'Integration Test Student' },
  });
  if (status !== 200) {
    throw new Error(`Failed to register ${email}: status ${status}`);
  }
  const token = await login(email, password);
  const { body } = await api<{ id: string }>('/api/users/me', { token });
  if (!body) {
    throw new Error(`No profile returned for freshly-registered ${email}`);
  }
  return { email, token, userId: body.data.id };
}

let cachedCategoryId: string | null = null;

/** Reuses an existing category if one exists — no delete endpoint exists for categories,
 * so creating a fresh one on every test run would accumulate junk indefinitely. */
async function getOrCreateCategoryId(adminToken: string): Promise<string> {
  if (cachedCategoryId) return cachedCategoryId;
  const { body: existing } = await api<{ id: string }[]>('/api/categories');
  if (existing && existing.data.length > 0) {
    cachedCategoryId = existing.data[0].id;
    return cachedCategoryId;
  }
  const { body: created } = await api<{ id: string }>('/api/categories', {
    method: 'POST',
    token: adminToken,
    body: { name: `Integration Test Category ${Date.now()}` },
  });
  if (!created) throw new Error('Failed to create a fallback category');
  cachedCategoryId = created.data.id;
  return cachedCategoryId;
}

/** Creates and publishes a real course with one module and one video lesson, via the real
 * admin API — not a DB seed. Defaults to a free (price 0) course; pass a positive `price`
 * for a paid one. Courses created here should be cleaned up with `deleteCourse` in an
 * `afterAll`; the delete guard checks `enrollment_count`, which nothing here increments. */
export async function createPublishedCourse(
  adminToken: string,
  overrides: Partial<{ price: number; currency: string; title: string }> = {},
): Promise<{ courseId: string; moduleId: string; lessonId: string }> {
  const categoryId = await getOrCreateCategoryId(adminToken);
  const title = overrides.title ?? `Integration Test Course ${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const { status: courseStatus, body: course } = await api<{ id: string }>('/api/courses', {
    method: 'POST',
    token: adminToken,
    body: {
      title,
      description: 'Created by the integration test suite.',
      price: overrides.price ?? 0,
      currency: overrides.currency ?? 'NGN',
      difficulty: 'beginner',
      categoryId,
      instructorName: 'Integration Tester',
      coverImageUrl: 'https://example.com/cover.jpg',
    },
  });
  if (courseStatus !== 201 || !course) {
    throw new Error(`Failed to create course "${title}": status ${courseStatus}`);
  }
  const courseId = course.data.id;

  const { status: moduleStatus, body: module_ } = await api<{ id: string }>(`/api/courses/${courseId}/modules`, {
    method: 'POST',
    token: adminToken,
    body: { title: 'Module 1' },
  });
  if (moduleStatus !== 201 || !module_) {
    throw new Error(`Failed to create module for course ${courseId}: status ${moduleStatus}`);
  }
  const moduleId = module_.data.id;

  const { status: lessonStatus, body: lesson } = await api<{ id: string }>(
    `/api/courses/${courseId}/modules/${moduleId}/lessons`,
    {
      method: 'POST',
      token: adminToken,
      body: { title: 'Lesson 1', type: 'video', videoUrl: 'https://example.com/video.mp4' },
    },
  );
  if (lessonStatus !== 201 || !lesson) {
    throw new Error(`Failed to create lesson for course ${courseId}: status ${lessonStatus}`);
  }
  const lessonId = lesson.data.id;

  const { status: publishStatus } = await api(`/api/courses/${courseId}/publish`, {
    method: 'POST',
    token: adminToken,
  });
  if (publishStatus !== 200) {
    throw new Error(`Failed to publish course ${courseId}: status ${publishStatus}`);
  }

  return { courseId, moduleId, lessonId };
}

export async function deleteCourse(adminToken: string, courseId: string): Promise<void> {
  await api(`/api/courses/${courseId}`, { method: 'DELETE', token: adminToken });
}

/**
 * POSTs a real, validly-signed simulated Paystack webhook to POST /api/payments/webhook —
 * the same route real webhook deliveries hit, public through the gateway (self-authenticates
 * via the signature, no session token). This is the only way to exercise the
 * subscription.create/charge.success/subscription.disable handlers in
 * SubscriptionsService.handleWebhookEvent() without a publicly-reachable callback URL for
 * Paystack to actually call — see that method's own doc comment.
 */
export async function sendPaystackWebhook(event: string, data: Record<string, unknown>): Promise<number> {
  const rawBody = JSON.stringify({ event, data });
  const signature = createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const res = await fetch(`${GATEWAY_URL}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
    body: rawBody,
  });
  return res.status;
}
