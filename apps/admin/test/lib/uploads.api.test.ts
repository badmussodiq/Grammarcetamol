import {describe, expect, it} from 'vitest';
import {sha256Hex} from '../../lib/uploads.api';

describe('sha256Hex', () => {
  it('returns a 64-character lowercase hex digest', async () => {
    const digest = await sha256Hex(new Blob(['hello world']));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same content', async () => {
    const a = await sha256Hex(new Blob(['same content']));
    const b = await sha256Hex(new Blob(['same content']));
    expect(a).toBe(b);
  });

  it('produces different digests for different content', async () => {
    const a = await sha256Hex(new Blob(['a']));
    const b = await sha256Hex(new Blob(['b']));
    expect(a).not.toBe(b);
  });
});
