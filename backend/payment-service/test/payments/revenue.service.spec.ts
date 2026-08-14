import {formatBucketLabel} from '../../src/payments/revenue.service';

describe('formatBucketLabel', () => {
  it('formats a day bucket as "Mon D"', () => {
    expect(formatBucketLabel(new Date('2026-08-05T00:00:00Z'), 'day')).toMatch(/^Aug 5$/);
  });

  it('formats a week bucket as "Wk of Mon D"', () => {
    expect(formatBucketLabel(new Date('2026-08-03T00:00:00Z'), 'week')).toMatch(/^Wk of Aug 3$/);
  });

  it('formats a month bucket as "Mon YY"', () => {
    expect(formatBucketLabel(new Date('2026-08-01T00:00:00Z'), 'month')).toMatch(/^Aug 26$/);
  });
});
