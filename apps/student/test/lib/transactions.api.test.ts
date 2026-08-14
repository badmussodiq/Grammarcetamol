import {describe, expect, it} from 'vitest';
import {buildTransactionsQuery} from '../../lib/transactions.api';

describe('buildTransactionsQuery', () => {
  it('returns an empty string when no filters are set', () => {
    expect(buildTransactionsQuery({})).toBe('');
  });

  it('includes status when set', () => {
    expect(buildTransactionsQuery({ status: 'completed' })).toBe('?status=completed');
  });

  it('combines multiple filters', () => {
    const qs = buildTransactionsQuery({ status: 'failed', dateFrom: '2026-01-01', page: 2, limit: 10 });
    expect(qs).toBe('?status=failed&dateFrom=2026-01-01&page=2&limit=10');
  });
});
