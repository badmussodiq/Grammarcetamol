import {describe, expect, it} from 'vitest';
import {buildStudentsQuery, DEFAULT_STUDENT_FILTERS} from '@/lib/students.api';

describe('buildStudentsQuery', () => {
  it('always scopes to role=STUDENT and sets page/limit', () => {
    expect(buildStudentsQuery(DEFAULT_STUDENT_FILTERS)).toBe('role=STUDENT&page=1&limit=20');
  });

  it('includes q and status when set', () => {
    const query = buildStudentsQuery({ ...DEFAULT_STUDENT_FILTERS, q: 'jane', status: 'ACTIVE' });
    expect(query).toBe('role=STUDENT&q=jane&status=ACTIVE&page=1&limit=20');
  });
});
