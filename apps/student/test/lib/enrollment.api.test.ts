import { describe, expect, it } from 'vitest';
import { findDefaultLesson, hasEnrollmentFor, type Enrollment, type LearnLesson, type LearnModule } from '../../lib/enrollment.api';

function enrollment(courseId: string): Enrollment {
  return {
    id: 'e1',
    userId: 'u1',
    courseId,
    status: 'active',
    pricePaid: 0,
    currency: 'USD',
    paymentId: null,
    enrolledAt: '2026-08-05T00:00:00Z',
    completedAt: null,
    expiresAt: null,
  };
}

describe('hasEnrollmentFor', () => {
  it('returns true when the course id is present among the enrollments', () => {
    expect(hasEnrollmentFor([enrollment('course-1'), enrollment('course-2')], 'course-2')).toBe(true);
  });

  it('returns false when the course id is absent', () => {
    expect(hasEnrollmentFor([enrollment('course-1')], 'course-2')).toBe(false);
  });

  it('returns false for an empty list', () => {
    expect(hasEnrollmentFor([], 'course-1')).toBe(false);
  });
});

function lesson(id: string, state: LearnLesson['state']): LearnLesson {
  return { id, title: id, description: null, type: 'video', duration: 300, position: 0, videoUrl: 'http://video', allowDownload: false, state, watchPosition: 0 };
}

function learnModule(id: string, lessons: LearnLesson[]): LearnModule {
  return { id, title: id, position: 0, lessons };
}

describe('findDefaultLesson', () => {
  it('prefers the "current" lesson over anything else', () => {
    const modules = [learnModule('m1', [lesson('l1', 'completed'), lesson('l2', 'current'), lesson('l3', 'unlocked')])];
    expect(findDefaultLesson(modules)?.id).toBe('l2');
  });

  it('falls back to the first "unlocked" lesson when nothing is current', () => {
    const modules = [learnModule('m1', [lesson('l1', 'completed'), lesson('l2', 'unlocked'), lesson('l3', 'unlocked')])];
    expect(findDefaultLesson(modules)?.id).toBe('l2');
  });

  it('falls back to the very first lesson when everything is already completed', () => {
    const modules = [learnModule('m1', [lesson('l1', 'completed'), lesson('l2', 'completed')])];
    expect(findDefaultLesson(modules)?.id).toBe('l1');
  });

  it('returns null for a course with no lessons', () => {
    expect(findDefaultLesson([])).toBeNull();
  });
});
