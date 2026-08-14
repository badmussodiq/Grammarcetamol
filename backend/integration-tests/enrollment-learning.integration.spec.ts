/**
 * Enrollment + learning-loop integration tests — a fresh student free-enrolls in a real
 * published course, sees it in "my enrollments", opens the curriculum with no lesson
 * locked (Task 30 deliberately removed sequential prerequisite gating), marks the one
 * lesson complete, and sees completion reflected both in the learn-state and the
 * completion percentage. Also confirms enrollment is idempotent (re-enrolling is a no-op,
 * not a duplicate) and that a paid course can't be free-enrolled into directly.
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

describe('Enrollment + learning loop — real running stack', () => {
  let adminToken: string;
  let studentToken: string;
  let freeCourseId: string;
  let lessonId: string;
  let paidCourseId: string;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const student = await registerAndLogin('enrollment-learning');
    studentToken = student.token;

    const free = await createPublishedCourse(adminToken, { price: 0 });
    freeCourseId = free.courseId;
    lessonId = free.lessonId;

    const paid = await createPublishedCourse(adminToken, { price: 5000, currency: 'NGN' });
    paidCourseId = paid.courseId;
  });

  afterAll(async () => {
    await deleteCourse(adminToken, freeCourseId);
    await deleteCourse(adminToken, paidCourseId);
  });

  it('POST /api/enrollments — free-enrolls a student in a free published course', async () => {
    const { status, body } = await api<{ courseId: string; status: string }>('/api/enrollments', {
      method: 'POST',
      token: studentToken,
      body: { courseId: freeCourseId },
    });
    expect(status).toBe(201);
    expect(body?.data.status).toBe('active');
  });

  it('POST /api/enrollments — re-enrolling the same course is idempotent, not a duplicate', async () => {
    const { status } = await api('/api/enrollments', {
      method: 'POST',
      token: studentToken,
      body: { courseId: freeCourseId },
    });
    expect([200, 201]).toContain(status);

    const { body: mine } = await api<{ courseId: string }[]>('/api/enrollments/mine', { token: studentToken });
    const matches = mine?.data.filter((e) => e.courseId === freeCourseId) ?? [];
    expect(matches.length).toBe(1);
  });

  it('POST /api/enrollments — rejects free-enrolling into a paid course', async () => {
    const { status } = await api('/api/enrollments', {
      method: 'POST',
      token: studentToken,
      body: { courseId: paidCourseId },
    });
    expect(status).toBe(400);
  });

  it('GET /api/enrollments/course/{id}/learn — the lesson is reachable immediately, not locked', async () => {
    const { status, body } = await api<{ modules: { lessons: { id: string; state: string }[] }[] }>(
      `/api/enrollments/course/${freeCourseId}/learn`,
      { token: studentToken },
    );
    expect(status).toBe(200);
    const lesson = body?.data.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
    expect(lesson).toBeDefined();
    expect(lesson?.state).not.toBe('locked');
  });

  it('PATCH /api/progress — marks the lesson completed', async () => {
    const { status, body } = await api<{ status: string }>('/api/progress', {
      method: 'PATCH',
      token: studentToken,
      body: { courseId: freeCourseId, lessonId, currentTime: 100, completed: true },
    });
    expect(status).toBe(200);
    expect(body?.data.status).toBe('completed');
  });

  it('GET /api/enrollments/course/{id}/learn — completion percentage reflects the completed lesson', async () => {
    const { body } = await api<{ completionPct: number; modules: { lessons: { id: string; state: string }[] }[] }>(
      `/api/enrollments/course/${freeCourseId}/learn`,
      { token: studentToken },
    );
    expect(body?.data.completionPct).toBe(100);
    const lesson = body?.data.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
    expect(lesson?.state).toBe('completed');
  });

  it('GET /api/enrollments/course/{id}/learn — 401 with no token', async () => {
    expect((await api(`/api/enrollments/course/${freeCourseId}/learn`)).status).toBe(401);
  });
});
