/**
 * Course catalog integration tests — an admin builds a real course (draft → module → lesson
 * → publish) through the real API, and the public catalog only ever shows it once it's
 * actually published. Also exercises the publish-validation guard (Task 12's own rule:
 * needs a cover image, price, and at least one module+lesson before it can publish).
 */
import {ADMIN_EMAIL, ADMIN_PASSWORD, api, createPublishedCourse, deleteCourse, login} from './helpers';

describe('Course catalog — real running stack', () => {
  let adminToken: string;
  let courseId: string | undefined;
  const title = `Integration Test Course ${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  beforeAll(async () => {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  afterAll(async () => {
    if (courseId) await deleteCourse(adminToken, courseId);
  });

  it('POST /api/courses — 401 with no token', async () => {
    const { status } = await api('/api/courses', {
      method: 'POST',
      body: { title: 'Should not be created', description: 'x', price: 1000, difficulty: 'beginner', instructorName: 'Nobody' },
    });
    expect(status).toBe(401);
  });

  it('POST /api/courses — SUPER_ADMIN creates a draft course', async () => {
    const { status, body } = await api<{ id: string; status: string }>('/api/courses', {
      method: 'POST',
      token: adminToken,
      body: {
        title,
        description: 'Created by the integration test suite.',
        price: 5000,
        currency: 'NGN',
        difficulty: 'beginner',
        instructorName: 'Integration Tester',
        coverImageUrl: 'https://example.com/cover.jpg',
      },
    });
    expect(status).toBe(201);
    expect(body?.data.status).toBe('draft');
    courseId = body?.data.id;
  });

  it('GET /api/courses — a draft course does not appear in the public catalog', async () => {
    const { body } = await api<{ items: { id: string }[] }>(`/api/courses?q=${encodeURIComponent(title)}`);
    expect(body?.data.items.some((c) => c.id === courseId)).toBe(false);
  });

  it('POST /api/courses/{id}/publish — rejected before any module/lesson exists', async () => {
    const { status } = await api(`/api/courses/${courseId}/publish`, { method: 'POST', token: adminToken });
    expect(status).toBe(400);
  });

  let moduleId: string | undefined;
  it('POST /api/courses/{id}/modules — adds a module', async () => {
    const { status, body } = await api<{ id: string }>(`/api/courses/${courseId}/modules`, {
      method: 'POST',
      token: adminToken,
      body: { title: 'Module 1' },
    });
    expect(status).toBe(201);
    moduleId = body?.data.id;
  });

  it('POST .../modules/{moduleId}/lessons — adds a video lesson', async () => {
    const { status } = await api(`/api/courses/${courseId}/modules/${moduleId}/lessons`, {
      method: 'POST',
      token: adminToken,
      body: { title: 'Lesson 1', type: 'video', videoUrl: 'https://example.com/video.mp4' },
    });
    expect(status).toBe(201);
  });

  it('POST /api/courses/{id}/publish — succeeds once cover image + module + lesson exist', async () => {
    const { status, body } = await api<{ status: string }>(`/api/courses/${courseId}/publish`, {
      method: 'POST',
      token: adminToken,
    });
    expect(status).toBe(200);
    expect(body?.data.status).toBe('published');
  });

  it('GET /api/courses — the now-published course appears in the public catalog, no auth needed', async () => {
    const { status, body } = await api<{ items: { id: string }[] }>(`/api/courses?q=${encodeURIComponent(title)}`);
    expect(status).toBe(200);
    expect(body?.data.items.some((c) => c.id === courseId)).toBe(true);
  });

  it('GET /api/courses/{slugOrId} — course detail is publicly readable', async () => {
    const { status, body } = await api<{ course: { title: string } }>(`/api/courses/${courseId}`);
    expect(status).toBe(200);
    expect(body?.data.course.title).toBe(title);
  });

  it('createPublishedCourse helper — produces an already-published free course (used by other spec files)', async () => {
    const created = await createPublishedCourse(adminToken, { title: `${title} (helper)` });
    expect(created.courseId).toBeTruthy();
    const { body } = await api<{ course: { status: string } }>(`/api/courses/${created.courseId}`);
    expect(body?.data.course.status).toBe('published');
    await deleteCourse(adminToken, created.courseId);
  });
});
