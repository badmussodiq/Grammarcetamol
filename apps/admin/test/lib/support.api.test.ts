import {describe, expect, it} from 'vitest';
import {buildSupportQuery} from '../../lib/support.api';

describe('buildSupportQuery', () => {
  it('always sets page and limit', () => {
    expect(buildSupportQuery('', 1)).toBe('page=1&limit=20');
  });

  it('includes status only when set', () => {
    expect(buildSupportQuery('open', 2, 10)).toBe('page=2&limit=10&status=open');
  });
});
