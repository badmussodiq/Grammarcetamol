import { apiFetch } from '@grammarcetamol/utilities';

export interface AuthUser {
  userId: string;
  email: string;
  roles: string;
  /** Only populated once refreshUser() has run — the login response itself doesn't include it. */
  fullName?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export const authApi = {
  register(body: { email: string; password: string; fullName: string }) {
    return apiFetch<ApiResponse<string>>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  login(body: { email: string; password: string }) {
    return apiFetch<ApiResponse<AuthUser>>('/api/auth/login', {
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

  verifyEmail(email: string, otp: string) {
    return apiFetch<ApiResponse<string>>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  resendVerification(email: string) {
    return apiFetch<ApiResponse<string>>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
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
