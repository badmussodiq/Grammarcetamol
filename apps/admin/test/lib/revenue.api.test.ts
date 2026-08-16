import {describe, expect, it} from 'vitest';
import {formatMethodLabel} from '@/lib/revenue.api';

describe('formatMethodLabel', () => {
  it('title-cases a single word', () => {
    expect(formatMethodLabel('card')).toBe('Card');
  });

  it('title-cases and joins a snake_case value', () => {
    expect(formatMethodLabel('mobile_money')).toBe('Mobile Money');
    expect(formatMethodLabel('bank_transfer')).toBe('Bank Transfer');
  });
});
