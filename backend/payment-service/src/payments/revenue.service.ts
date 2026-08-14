import {Inject, Injectable} from '@nestjs/common';
import type {Pool} from 'pg';
import {PG_POOL} from '../config/database.module';
import {
    BestSeller,
    REVENUE_PERIOD_CONFIG,
    RevenueByMethod,
    RevenuePeriod,
    RevenueSummary,
    RevenueTrendPoint
} from './revenue.types';

const EVER_COMPLETED_STATUSES = ['completed', 'refunded', 'partially_refunded'];

@Injectable()
export class RevenueService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getSummary(): Promise<RevenueSummary> {
    const result = await this.pool.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = ANY($1)), 0) AS lifetime,
        COALESCE(SUM(amount) FILTER (WHERE status = ANY($1) AND paid_at >= date_trunc('month', now())), 0) AS month,
        COALESCE(SUM(amount) FILTER (WHERE status = ANY($1) AND paid_at >= date_trunc('week', now())), 0) AS week,
        COALESCE(SUM(amount) FILTER (WHERE status = ANY($1) AND paid_at >= date_trunc('day', now())), 0) AS today,
        COALESCE(AVG(amount) FILTER (WHERE status = ANY($1)), 0) AS avg_transaction,
        COUNT(*) FILTER (WHERE status = ANY($1)) AS ever_completed_count,
        COUNT(*) FILTER (WHERE status IN ('refunded', 'partially_refunded')) AS refunded_count
      FROM payments
    `, [EVER_COMPLETED_STATUSES]);

    const row = result.rows[0];
    const everCompleted = Number(row.ever_completed_count);
    const refunded = Number(row.refunded_count);

    return {
      lifetimeRevenue: Number(row.lifetime),
      monthRevenue: Number(row.month),
      weekRevenue: Number(row.week),
      todayRevenue: Number(row.today),
      avgTransactionValue: Number(row.avg_transaction),
      refundRate: everCompleted === 0 ? 0 : refunded / everCompleted,
    };
  }

  /** Delegates all date-bucket math to Postgres (generate_series + date_trunc) rather than
   * reimplementing week/month boundary logic in JS, where it's easy to drift out of sync with
   * how Postgres actually buckets (ISO week start day, timezone handling, etc.). `unit`/`count`
   * are interpolated into the query, but only ever from the fixed REVENUE_PERIOD_CONFIG map keyed
   * by the `period` enum — never from raw request input — so this isn't a SQL-injection surface. */
  async getTrend(period: RevenuePeriod): Promise<RevenueTrendPoint[]> {
    const { unit, count } = REVENUE_PERIOD_CONFIG[period];

    const result = await this.pool.query(`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc('${unit}', now()) - interval '${count - 1} ${unit}',
          date_trunc('${unit}', now()),
          interval '1 ${unit}'
        ) AS bucket
      ),
      gross AS (
        SELECT date_trunc('${unit}', paid_at) AS bucket, SUM(amount) AS total
        FROM payments
        WHERE status = ANY($1)
        GROUP BY 1
      ),
      refunded AS (
        SELECT date_trunc('${unit}', processed_at) AS bucket, SUM(amount) AS total
        FROM refunds
        WHERE status = 'completed'
        GROUP BY 1
      )
      SELECT b.bucket, COALESCE(g.total, 0) AS gross, COALESCE(r.total, 0) AS refunds
      FROM buckets b
      LEFT JOIN gross g ON g.bucket = b.bucket
      LEFT JOIN refunded r ON r.bucket = b.bucket
      ORDER BY b.bucket
    `, [EVER_COMPLETED_STATUSES]);

    return result.rows.map((row) => {
      const gross = Number(row.gross);
      const refunds = Number(row.refunds);
      return { label: formatBucketLabel(new Date(row.bucket), unit), gross, net: gross - refunds, refunds };
    });
  }

  async getBestSellers(limit: number): Promise<BestSeller[]> {
    const result = await this.pool.query(`
      SELECT course_id, SUM(amount) AS revenue, COUNT(*) AS sales_count
      FROM payments
      WHERE status = ANY($1) AND course_id IS NOT NULL
      GROUP BY course_id
      ORDER BY revenue DESC
      LIMIT $2
    `, [EVER_COMPLETED_STATUSES, limit]);

    return result.rows.map((row) => ({
      courseId: row.course_id,
      revenue: Number(row.revenue),
      salesCount: Number(row.sales_count),
    }));
  }

  async getRevenueByMethod(): Promise<RevenueByMethod[]> {
    const result = await this.pool.query(`
      SELECT payment_method, SUM(amount) AS revenue
      FROM payments
      WHERE status = ANY($1)
      GROUP BY payment_method
      ORDER BY revenue DESC
    `, [EVER_COMPLETED_STATUSES]);

    return result.rows.map((row) => ({ method: row.payment_method, revenue: Number(row.revenue) }));
  }
}

// Postgres's date_trunc buckets are UTC-midnight boundaries — formatting with the server's local
// timezone instead of UTC could shift the displayed day (e.g. a US timezone rendering a UTC
// midnight bucket as the previous evening), so timeZone is pinned explicitly here.
export function formatBucketLabel(date: Date, unit: 'day' | 'week' | 'month'): string {
  if (unit === 'month') return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  if (unit === 'week') return `Wk of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
