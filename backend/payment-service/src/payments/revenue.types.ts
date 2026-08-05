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

export const REVENUE_PERIOD_CONFIG: Record<RevenuePeriod, { unit: 'day' | 'week' | 'month'; count: number }> = {
  daily: { unit: 'day', count: 14 },
  weekly: { unit: 'week', count: 12 },
  monthly: { unit: 'month', count: 12 },
};
