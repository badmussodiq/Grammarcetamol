import {describe, expect, it} from 'vitest';
import type {AdminUser} from '../../lib/auth.api';
import {computeHasPermission} from '../../lib/auth.api';

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return { userId: 'u1', email: 'admin@example.com', roles: 'SUPER_ADMIN', ...overrides };
}

describe('computeHasPermission', () => {
  // Regression test for the bug where this compared the roles string against the lowercase
  // literal 'super_admin' — always false, since the backend returns roles uppercase.
  it('grants everything to a super admin (uppercase role, as the backend actually returns it)', () => {
    expect(computeHasPermission(user({ roles: 'SUPER_ADMIN' }), 'courses', 'delete')).toBe(true);
  });

  it('grants everything to a super admin even when roles is a comma-separated list', () => {
    expect(computeHasPermission(user({ roles: 'MODERATOR,SUPER_ADMIN' }), 'settings', 'edit')).toBe(true);
  });

  it('denies a moderator without a matching permission', () => {
    expect(computeHasPermission(user({ roles: 'MODERATOR', permissions: ['courses:view'] }), 'courses', 'delete')).toBe(false);
  });

  it('grants a moderator an exact matching permission', () => {
    expect(computeHasPermission(user({ roles: 'MODERATOR', permissions: ['courses:edit'] }), 'courses', 'edit')).toBe(true);
  });

  it('grants a moderator a wildcard-action permission', () => {
    expect(computeHasPermission(user({ roles: 'MODERATOR', permissions: ['courses:*'] }), 'courses', 'delete')).toBe(true);
  });

  it('denies when there is no user', () => {
    expect(computeHasPermission(null, 'courses', 'view')).toBe(false);
  });
});
