import { describe, expect, it } from 'vitest';
import { buildReviewsQuery, DEFAULT_REVIEW_FILTERS } from '../../lib/reviews.api';

describe('buildReviewsQuery', () => {
  it('always sets page and limit', () => {
    expect(buildReviewsQuery(DEFAULT_REVIEW_FILTERS)).toBe('page=1&limit=20');
  });

  it('includes only the filters that are set', () => {
    const query = buildReviewsQuery({ ...DEFAULT_REVIEW_FILTERS, status: 'pending', rating: '5' });
    expect(query).toBe('status=pending&rating=5&page=1&limit=20');
  });

  it('includes courseId when set', () => {
    const query = buildReviewsQuery({ ...DEFAULT_REVIEW_FILTERS, courseId: 'abc-123' });
    expect(query).toBe('courseId=abc-123&page=1&limit=20');
  });
});
