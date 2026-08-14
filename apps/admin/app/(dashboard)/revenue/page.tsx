'use client';

import {useEffect, useState} from 'react';
import {apiFetch, DonutChart, LineChart, Skeleton} from '@grammarcetamol/utilities';
import type {BestSeller, RevenueByMethod, RevenuePeriod, RevenueSummary, RevenueTrendPoint} from '@/lib/revenue.api';
import {formatMethodLabel, revenueApi} from '@/lib/revenue.api';

interface CourseTitleLookup {
  success: boolean;
  data: { course: { title: string } };
}

/** No "get many courses by id" endpoint exists, and best-sellers is capped at 10 rows, so a
 * small parallel fan-out per id is the pragmatic choice here rather than a new batch endpoint. */
async function fetchCourseTitles(courseIds: string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    courseIds.map(async (id) => {
      try {
        const res = await apiFetch<CourseTitleLookup>(`/api/courses/${id}`);
        return [id, res.data.course.title] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  return new Map(entries.filter((e): e is [string, string] => e[1] !== null));
}

const DONUT_COLORS = ['#0EA5E9', '#F59E0B', '#10B981', '#6366F1', '#EF4444'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function StatCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
      <p className="text-sm text-text-secondary mb-3">{label}</p>
      {loading ? <Skeleton variant="text" height={28} width="60%" /> : <p className="text-2xl font-bold text-text-primary">{value}</p>}
    </div>
  );
}

export default function RevenuePage() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [trend, setTrend] = useState<RevenueTrendPoint[] | null>(null);
  const [bestSellers, setBestSellers] = useState<BestSeller[] | null>(null);
  const [courseTitles, setCourseTitles] = useState<Map<string, string>>(new Map());
  const [byMethod, setByMethod] = useState<RevenueByMethod[] | null>(null);
  const [period, setPeriod] = useState<RevenuePeriod>('daily');

  useEffect(() => {
    revenueApi.getSummary().then((res) => setSummary(res.data)).catch(() => setSummary(null));
    revenueApi.getByMethod().then((res) => setByMethod(res.data)).catch(() => setByMethod([]));
    revenueApi.getBestSellers(10).then(async (res) => {
      setBestSellers(res.data);
      setCourseTitles(await fetchCourseTitles(res.data.map((s) => s.courseId)));
    }).catch(() => setBestSellers([]));
  }, []);

  useEffect(() => {
    setTrend(null);
    revenueApi.getTrend(period).then((res) => setTrend(res.data)).catch(() => setTrend([]));
  }, [period]);

  const methodDonutData = (byMethod ?? []).map((m, i) => ({
    label: formatMethodLabel(m.method),
    value: m.revenue,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Revenue</h1>
          <p className="text-text-secondary mt-1 text-sm">Track how the platform is earning.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Lifetime" value={summary ? formatCurrency(summary.lifetimeRevenue) : ''} loading={!summary} />
          <StatCard label="This Month" value={summary ? formatCurrency(summary.monthRevenue) : ''} loading={!summary} />
          <StatCard label="This Week" value={summary ? formatCurrency(summary.weekRevenue) : ''} loading={!summary} />
          <StatCard label="Today" value={summary ? formatCurrency(summary.todayRevenue) : ''} loading={!summary} />
          <StatCard label="Avg Transaction" value={summary ? formatCurrency(summary.avgTransactionValue) : ''} loading={!summary} />
          <StatCard label="Refund Rate" value={summary ? `${(summary.refundRate * 100).toFixed(1)}%` : ''} loading={!summary} />
        </div>

        <div className="bg-surface rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text-primary">Revenue Trend</h2>
            <div className="flex gap-1 bg-background rounded-md p-1">
              {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs font-medium rounded ${period === p ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary'}`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {trend === null ? (
            <Skeleton variant="rect" height={200} />
          ) : (
            <LineChart
              categories={trend.map((t) => t.label)}
              series={[
                { label: 'Gross', color: '#0EA5E9', data: trend.map((t) => t.gross) },
                { label: 'Net', color: '#10B981', data: trend.map((t) => t.net) },
                { label: 'Refunds', color: '#EF4444', data: trend.map((t) => t.refunds) },
              ]}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="font-semibold text-text-primary mb-4">Revenue by Payment Method</h2>
            {byMethod === null ? (
              <Skeleton variant="rect" height={160} />
            ) : methodDonutData.length === 0 ? (
              <p className="text-sm text-text-secondary">No completed payments yet.</p>
            ) : (
              <DonutChart data={methodDonutData} />
            )}
          </div>

          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="font-semibold text-text-primary mb-4">Best-Selling Courses</h2>
            {bestSellers === null ? (
              <Skeleton variant="rect" height={160} />
            ) : bestSellers.length === 0 ? (
              <p className="text-sm text-text-secondary">No sales yet.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {bestSellers.map((s, i) => (
                  <li key={s.courseId} className="flex items-center justify-between text-sm gap-4">
                    <span className="text-text-secondary truncate">
                      {i + 1}. {courseTitles.get(s.courseId) ?? `${s.courseId.slice(0, 8)}…`}{' '}
                      <span className="text-text-muted">({s.salesCount} sales)</span>
                    </span>
                    <span className="font-medium text-text-primary flex-shrink-0">{formatCurrency(s.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
