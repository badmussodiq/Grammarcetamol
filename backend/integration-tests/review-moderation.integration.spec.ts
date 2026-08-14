/**
 * Review + moderation integration tests — the 50%-completion gate (real cross-service call
 * to enrollment-service, not a mocked flag), duplicate-submission rejection, the admin
 * moderation transition, and confirms the public reviews endpoint only ever shows
 * `approved` reviews — a `pending` one must not leak through.
 */
import {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    api,
    createPublishedCourse,
    deleteCourse,
    login,
    registerAndLogin
} from './helpers';

describe('Review + moderation — real running stack', () => {
  let adminToken: string;
  let studentToken: string;
  let courseId: string;
  let lessonId: string;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const student = await registerAndLogin('review-moderation');
    studentToken = student.token;

    const course = await createPublishedCourse(adminToken, { price: 0 });
    courseId = course.courseId;
    lessonId = course.lessonId;

    const { status: enrollStatus } = await api('/api/enrollments', {
      method: 'POST',
      token: studentToken,
      body: { courseId },
    });
    if (enrollStatus !== 201) throw new Error(`Setup: failed to enroll, status ${enrollStatus}`);
  }, 20000);

  afterAll(async () => {
    await deleteCourse(adminToken, courseId);
  });

  it('POST /api/reviews — 403 before crossing the 50% completion threshold', async () => {
    const { status } = await api('/api/reviews', {
      method: 'POST',
      token: studentToken,
      body: { courseId, rating: 5, title: 'Too early', comment: 'Should be blocked.' },
    });
    expect(status).toBe(403);
  });

  it('GET /api/courses/{courseId}/reviews — public endpoint works with no auth (empty so far)', async () => {
    const { status } = await api(`/api/courses/${courseId}/reviews`);
    expect(status).toBe(200);
  });

  let reviewId: string;
  it('completing the course, then POST /api/reviews — succeeds once past 50%', async () => {
    const { status: progressStatus } = await api('/api/progress', {
      method: 'PATCH',
      token: studentToken,
      body: { courseId, lessonId, currentTime: 100, completed: true },
    });
    expect(progressStatus).toBe(200);

    const { status, body } = await api<{ id: string; status: string }>('/api/reviews', {
      method: 'POST',
      token: studentToken,
      body: { courseId, rating: 5, title: 'Great course', comment: 'Loved the content.' },
    });
    expect(status).toBe(201);
    expect(body?.data.status).toBe('pending');
    reviewId = body!.data.id;
  });

  it('POST /api/reviews — 409 for a duplicate submission on the same course', async () => {
    const { status } = await api('/api/reviews', {
      method: 'POST',
      token: studentToken,
      body: { courseId, rating: 4, title: 'Again', comment: 'Trying to double-submit.' },
    });
    expect(status).toBe(409);
  });

  it('GET /api/courses/{courseId}/reviews — a pending review does not leak into the public list', async () => {
    const { body } = await api<{ items: { id: string }[] } | { id: string }[]>(`/api/courses/${courseId}/reviews`);
    const items = Array.isArray(body?.data) ? body!.data : (body!.data as { items: { id: string }[] }).items;
    expect(items.some((r) => r.id === reviewId)).toBe(false);
  });

  it('PATCH /api/reviews/{id}/moderate — admin approves the review', async () => {
    const { status, body } = await api<{ status: string }>(`/api/reviews/${reviewId}/moderate`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'approved', note: 'Looks good.' },
    });
    expect(status).toBe(200);
    expect(body?.data.status).toBe('approved');
  });

  it('GET /api/courses/{courseId}/reviews — the now-approved review is publicly visible', async () => {
    const { status, body } = await api<{ items: { id: string }[] } | { id: string }[]>(`/api/courses/${courseId}/reviews`);
    expect(status).toBe(200);
    const items = Array.isArray(body?.data) ? body!.data : (body!.data as { items: { id: string }[] }).items;
    expect(items.some((r) => r.id === reviewId)).toBe(true);
  });
});
