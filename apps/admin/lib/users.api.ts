import { apiFetch } from '@grammarcetamol/utilities';

export interface StaffUser {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'STUDENT' | 'MODERATOR' | 'CUSTOMER_SUPPORT';
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  fullName: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface UserListResult {
  data: StaffUser[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserBody {
  email: string;
  password: string;
  fullName: string;
  role: 'MODERATOR' | 'CUSTOMER_SUPPORT';
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export const usersApi = {
  create(body: CreateUserBody) {
    return apiFetch<ApiResponse<StaffUser>>('/api/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
