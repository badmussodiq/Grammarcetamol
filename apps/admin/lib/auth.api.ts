import { apiFetch } from '@grammarcetamol/utilities';

export interface AdminUser {
  userId: string;
  email: string;
  roles: string;
  permissions?: string[];
  /** Only populated once refreshUser() has run — the login response itself doesn't include it. */
  fullName?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

/** Pure — extracted from AuthContext for testability. Regression coverage for the bug where this
 * used to compare the whole roles string against the lowercase literal 'super_admin' (always
 * false, since the backend returns roles uppercase and possibly comma-separated). */
export function computeHasPermission(user: AdminUser | null, resource: string, action: string): boolean {
  if (!user) return false;
  const roles = user.roles.split(',').map((r) => r.trim());
  if (roles.includes('SUPER_ADMIN')) return true;
  const perms = user.permissions ?? [];
  return perms.includes(`${resource}:${action}`) || perms.includes(`${resource}:*`);
}

export const authApi = {
  login(body: { email: string; password: string }) {
    return apiFetch<ApiResponse<AdminUser>>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  logout() {
    return apiFetch<ApiResponse<string>>('/api/auth/logout', { method: 'POST' });
  },

  refresh() {
    return apiFetch<ApiResponse<string>>('/api/auth/refresh', { method: 'POST' });
  },

  forgotPassword(email: string) {
    return apiFetch<ApiResponse<string>>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(email: string, otp: string, newPassword: string) {
    return apiFetch<ApiResponse<string>>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  },
};
