import { apiFetch } from '@grammarcetamol/utilities';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';

export interface Transaction {
  id: string;
  userId: string;
  courseId: string | null;
  serviceRequestId: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  gateway: string;
  gatewayRef: string;
  description: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionCourse {
  id: string;
  title: string;
  slug: string;
}

export interface TransactionDetail extends Transaction {
  course: TransactionCourse | null;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export interface TransactionListFilters {
  status?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const transactionsApi = {
  listMine(filters: TransactionListFilters = {}) {
    return apiFetch<ApiResponse<Paged<Transaction>>>(`/api/payments/me${buildTransactionsQuery(filters)}`);
  },

  getById(id: string) {
    return apiFetch<ApiResponse<TransactionDetail>>(`/api/payments/${id}`);
  },
};

/** Pure — colocated so it's testable without mocking fetch. */
export function buildTransactionsQuery(filters: TransactionListFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
