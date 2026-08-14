import {apiFetch} from '@grammarcetamol/utilities';

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  country: string | null;
  timezone: string | null;
  bio: string | null;
  learningGoals: string[] | null;
  dateOfBirth: string | null;
  preferences: Record<string, unknown> | null;
}

export interface UpdateProfileDto {
  fullName?: string;
  phone?: string;
  country?: string;
  timezone?: string;
  bio?: string;
  learningGoals?: string[];
  avatarUrl?: string;
  dateOfBirth?: string;
  preferences?: Record<string, unknown>;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export const profileApi = {
  getMe() {
    return apiFetch<ApiResponse<UserProfile>>('/api/users/me');
  },

  updateMe(dto: UpdateProfileDto) {
    return apiFetch<ApiResponse<UserProfile>>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },

  changePassword(dto: ChangePasswordDto) {
    return apiFetch<ApiResponse<string>>('/api/users/me/change-password', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },
};

/** Pure — turns the comma-separated learning-goals input into the string[] the backend expects,
 * dropping blank entries from stray commas/whitespace. */
export function parseLearningGoals(input: string): string[] {
  return input
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
}
