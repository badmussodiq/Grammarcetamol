import { apiFetch } from '@grammarcetamol/utilities';

export interface AuthUser {
  userId: string;
  email: string;
  roles: string;
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

  verifyEmail(token: string) {
    return apiFetch<ApiResponse<string>>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
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

  resetPassword(token: string, newPassword: string) {
    return apiFetch<ApiResponse<string>>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },
};
