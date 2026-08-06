import { describe, expect, it } from 'vitest';
import { isWithinEditWindow, type Review } from '../../lib/reviews.api';

function review(createdAt: string): Review {
  return {
    id: 'r1',
    userId: 'u1',
    courseId: 'c1',
    enrollmentId: 'e1',
    rating: 5,
    title: null,
    comment: null,
    status: 'pending',
    edited: false,
    editedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('isWithinEditWindow', () => {
  it('returns true just inside the 7-day window', () => {
    const createdAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinEditWindow(review(createdAt))).toBe(true);
  });

  it('returns false once past 7 days', () => {
    const createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinEditWindow(review(createdAt))).toBe(false);
  });

  it('returns true for a review created just now', () => {
    expect(isWithinEditWindow(review(new Date().toISOString()))).toBe(true);
  });
});
