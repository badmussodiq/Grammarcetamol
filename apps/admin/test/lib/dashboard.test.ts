import {describe, expect, it} from 'vitest';
import {formatCurrency} from '../../lib/dashboard';

describe('formatCurrency', () => {
  it('formats a whole number as NGN with no decimals', () => {
    expect(formatCurrency(5000)).toBe('₦5,000');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('₦0');
  });

  it('rounds fractional amounts', () => {
    expect(formatCurrency(1234.56)).toBe('₦1,235');
  });
});
