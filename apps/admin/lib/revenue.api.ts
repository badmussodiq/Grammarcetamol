import { apiFetch } from '@grammarcetamol/utilities';

export interface RevenueSummary {
  lifetimeRevenue: number;
  monthRevenue: number;
  weekRevenue: number;
  todayRevenue: number;
  avgTransactionValue: number;
  refundRate: number;
}

export interface RevenueTrendPoint {
  label: string;
  gross: number;
  net: number;
  refunds: number;
}

export interface BestSeller {
  courseId: string;
  revenue: number;
  salesCount: number;
}

export interface RevenueByMethod {
  method: string;
  revenue: number;
}

export type RevenuePeriod = 'daily' | 'weekly' | 'monthly';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const revenueApi = {
  getSummary() {
    return apiFetch<ApiResponse<RevenueSummary>>('/api/payments/revenue/summary');
  },
  getTrend(period: RevenuePeriod) {
    return apiFetch<ApiResponse<RevenueTrendPoint[]>>(`/api/payments/revenue/trend?period=${period}`);
  },
  getBestSellers(limit = 10) {
    return apiFetch<ApiResponse<BestSeller[]>>(`/api/payments/revenue/best-sellers?limit=${limit}`);
  },
  getByMethod() {
    return apiFetch<ApiResponse<RevenueByMethod[]>>('/api/payments/revenue/by-method');
  },
};

/** Pure — payment_method values are lowercase snake-ish tokens from the DB; render as Title Case. */
export function formatMethodLabel(method: string): string {
  return method
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
