import { apiFetch } from './api';

export interface AdminUser {
  userId: string;
  email: string;
  roles: string;
  permissions?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
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

  resetPassword(token: string, newPassword: string) {
    return apiFetch<ApiResponse<string>>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },
};
