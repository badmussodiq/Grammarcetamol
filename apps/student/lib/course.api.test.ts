import { describe, it, expect } from 'vitest';
import { buildCourseQuery, filtersFromSearchParams, DEFAULT_FILTERS } from './course.api';

describe('buildCourseQuery', () => {
  it('omits filters that are unset', () => {
    const qs = buildCourseQuery(DEFAULT_FILTERS);
    expect(qs).toBe('page=1&limit=12');
  });

  it('includes every set filter', () => {
    const qs = buildCourseQuery({
      category: 'business-english',
      difficulty: 'beginner',
      price: 'free',
      q: 'grammar',
      sort: 'popular',
      page: 2,
    });
    const params = new URLSearchParams(qs);
    expect(params.get('category')).toBe('business-english');
    expect(params.get('difficulty')).toBe('beginner');
    expect(params.get('price')).toBe('free');
    expect(params.get('q')).toBe('grammar');
    expect(params.get('sort')).toBe('popular');
    expect(params.get('page')).toBe('2');
  });

  it('trims whitespace-only search to nothing', () => {
    const qs = buildCourseQuery({ ...DEFAULT_FILTERS, q: '   ' });
    expect(qs).not.toContain('q=');
  });

  it('omits sort when it is the default (newest)', () => {
    const qs = buildCourseQuery({ ...DEFAULT_FILTERS, sort: 'newest' });
    expect(qs).not.toContain('sort=');
  });

  it('respects a custom page size', () => {
    const qs = buildCourseQuery(DEFAULT_FILTERS, 24);
    expect(qs).toContain('limit=24');
  });
});

describe('filtersFromSearchParams', () => {
  it('round-trips through buildCourseQuery', () => {
    const original = {
      category: 'ielts-toefl-prep',
      difficulty: 'advanced' as const,
      price: 'paid' as const,
      q: 'exam prep',
      sort: 'rating' as const,
      page: 3,
    };
    const roundTripped = filtersFromSearchParams(new URLSearchParams(buildCourseQuery(original)));
    expect(roundTripped).toEqual(original);
  });

  it('falls back to defaults for missing or invalid params', () => {
    const result = filtersFromSearchParams(new URLSearchParams('difficulty=expert&sort=bogus'));
    expect(result).toEqual(DEFAULT_FILTERS);
  });

  it('defaults page to 1 when missing or non-numeric', () => {
    expect(filtersFromSearchParams(new URLSearchParams('page=abc')).page).toBe(1);
    expect(filtersFromSearchParams(new URLSearchParams()).page).toBe(1);
  });
});
