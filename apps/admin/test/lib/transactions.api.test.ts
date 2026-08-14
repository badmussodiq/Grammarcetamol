import {describe, expect, it} from 'vitest';
import {buildTransactionsQuery, DEFAULT_TRANSACTION_FILTERS} from '../../lib/transactions.api';

describe('buildTransactionsQuery', () => {
  it('always sets page and limit', () => {
    expect(buildTransactionsQuery(DEFAULT_TRANSACTION_FILTERS)).toBe('page=1&limit=20');
  });

  it('includes only the filters that are set', () => {
    const query = buildTransactionsQuery({ ...DEFAULT_TRANSACTION_FILTERS, status: 'completed', method: 'card' });
    expect(query).toBe('status=completed&method=card&page=1&limit=20');
  });

  it('includes a date range when both dates are set', () => {
    const query = buildTransactionsQuery({ ...DEFAULT_TRANSACTION_FILTERS, dateFrom: '2026-01-01', dateTo: '2026-01-31' });
    expect(query).toBe('dateFrom=2026-01-01&dateTo=2026-01-31&page=1&limit=20');
  });
});
