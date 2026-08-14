/**
 * Payment integration tests — real calls to payment-service's Paystack integration
 * (test-mode keys, real HTTP calls to Paystack's API, not mocked). Actually *completing* a
 * charge needs Paystack's hosted popup + a test card, which isn't automatable headlessly —
 * that part is proven manually (see PLAN.md Task 30's real completed transaction). What
 * this suite proves instead: initialize() correctly rejects a free course and an
 * unpublished course before ever calling Paystack, succeeds for a real paid published NGN
 * course, and confirm() correctly reports "not yet paid" for a reference nobody has
 * actually paid, and 404s for a reference that was never initialized at all.
 */
import {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    api,
    createPublishedCourse,
    deleteCourse,
    login,
    NONEXISTENT_ID,
    registerAndLogin
} from './helpers';

describe('Payment flow — real running stack (real Paystack test-mode calls)', () => {
  let adminToken: string;
  let studentToken: string;
  let studentEmail: string;
  let paidCourseId: string;
  let draftCourseId: string;
  let freeCourseId: string;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const student = await registerAndLogin('payment-flow');
    studentToken = student.token;
    studentEmail = student.email;

    const paid = await createPublishedCourse(adminToken, { price: 5000, currency: 'NGN' });
    paidCourseId = paid.courseId;

    const free = await createPublishedCourse(adminToken, { price: 0 });
    freeCourseId = free.courseId;

    // A draft (never-published) course to exercise the "not published" rejection.
    const { body: draft } = await api<{ id: string }>('/api/courses', {
      method: 'POST',
      token: adminToken,
      body: {
        title: `Integration Test Draft Course ${Date.now()}`,
        description: 'Draft, never published.',
        price: 5000,
        currency: 'NGN',
        difficulty: 'beginner',
        instructorName: 'Integration Tester',
      },
    });
    draftCourseId = draft!.data.id;
  }, 30000);

  afterAll(async () => {
    await deleteCourse(adminToken, paidCourseId);
    await deleteCourse(adminToken, freeCourseId);
    await deleteCourse(adminToken, draftCourseId);
  });

  it('POST /api/payments/initialize — 400 for a free course (checkout is for paid courses only)', async () => {
    const { status } = await api('/api/payments/initialize', {
      method: 'POST',
      token: studentToken,
      body: { courseId: freeCourseId },
    });
    expect(status).toBe(400);
  });

  it('POST /api/payments/initialize — 400 for an unpublished (draft) course', async () => {
    const { status } = await api('/api/payments/initialize', {
      method: 'POST',
      token: studentToken,
      body: { courseId: draftCourseId },
    });
    expect(status).toBe(400);
  });

  let reference: string;
  it('POST /api/payments/initialize — succeeds for a real paid, published, NGN-priced course', async () => {
    // email is required by Paystack's own API even though the DTO field is optional here —
    // the real checkout page always supplies it from the logged-in user's own profile.
    const { status, body } = await api<{ reference: string; accessCode: string; publicKey: string }>(
      '/api/payments/initialize',
      { method: 'POST', token: studentToken, body: { courseId: paidCourseId, email: studentEmail } },
    );
    expect(status).toBe(201);
    expect(typeof body?.data.reference).toBe('string');
    expect(typeof body?.data.accessCode).toBe('string');
    reference = body!.data.reference;
  }, 15000);

  it('POST /api/payments/{reference}/confirm — reports the payment as not completed (nobody has paid it)', async () => {
    // NestJS defaults @Post() handlers to 201 with no explicit @HttpCode override — this
    // endpoint isn't "creating" anything new (it's re-verifying an existing payment), but
    // that's the framework default here, not a bug worth fighting in a test.
    const { status, body } = await api<{ status: string }>(`/api/payments/${reference}/confirm`, {
      method: 'POST',
      token: studentToken,
    });
    expect(status).toBe(201);
    expect(body?.data.status).not.toBe('completed');
  }, 15000);

  it('POST /api/payments/{reference}/confirm — 404 for a reference that was never initialized', async () => {
    const { status } = await api(`/api/payments/never-initialized-${NONEXISTENT_ID}/confirm`, {
      method: 'POST',
      token: studentToken,
    });
    expect(status).toBe(404);
  });
});
