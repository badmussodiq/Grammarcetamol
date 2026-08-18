import {describe, expect, it} from 'vitest';
import {toPaystackSubunit} from '@/lib/checkout.api';

describe('toPaystackSubunit', () => {
  it('converts a whole-dollar amount to the correct subunit', () => {
    expect(toPaystackSubunit('49.99')).toBe(4999);
  });

  it('rounds a sub-cent amount to the nearest whole subunit', () => {
    expect(toPaystackSubunit('10.999')).toBe(1100);
  });

  it('handles zero', () => {
    expect(toPaystackSubunit('0')).toBe(0);
  });
});
