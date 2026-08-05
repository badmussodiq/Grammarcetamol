export interface Payment {
  id: string;
  userId: string;
  courseId: string | null;
  serviceRequestId: string | null;
  amount: string;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  paymentMethod: string;
  gateway: string;
  gatewayRef: string | null;
  description: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TransactionFilters {
  status: string;
  method: string;
  dateFrom: string;
  dateTo: string;
  page: number;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  status: '',
  method: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
};

/** Pure — turns filter state into the query string /api/payments accepts. Mirrors
 * course.api.ts's buildCourseQuery pattern. */
export function buildTransactionsQuery(filters: TransactionFilters, limit = 20): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.method) params.set('method', filters.method);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  params.set('page', String(filters.page));
  params.set('limit', String(limit));
  return params.toString();
}
