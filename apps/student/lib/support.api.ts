import {apiFetch} from '@grammarcetamol/utilities';

export interface CreateTicketInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  courseId?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export const supportApi = {
  submit(input: CreateTicketInput) {
    return apiFetch<ApiResponse<{ _id: string }>>('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
