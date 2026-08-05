export interface LineChartSeries {
  label: string;
  color: string;
  data: number[];
}

export interface LineChartProps {
  categories: string[];
  series: LineChartSeries[];
  height?: number;
}

/** Hand-rolled SVG — see BarChart's doc comment for why not a charting library. Multi-series
 * (e.g. gross/net/refunds on the same axis) via multiple polylines and a plain legend row. */
export function LineChart({ categories, series, height = 200 }: LineChartProps) {
  const allValues = series.flatMap((s) => s.data);
  const max = Math.max(1, ...allValues);
  const min = Math.min(0, ...allValues);
  const range = max - min || 1;
  const chartHeight = height - 20;
  const stepX = categories.length > 1 ? 100 / (categories.length - 1) : 100;

  function pointsFor(data: number[]): string {
    return data
      .map((v, i) => {
        const x = i * stepX;
        const y = chartHeight - ((v - min) / range) * chartHeight;
        return `${x},${y}`;
      })
      .join(' ');
  }

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
        role="img"
        aria-label="Line chart"
      >
        {series.map((s) => (
          <polyline
            key={s.label}
            points={pointsFor(s.data)}
            fill="none"
            stroke={s.color}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div style={{ display: 'flex' }}>
        {categories.map((c) => (
          <div key={c} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#64748B' }}>{c}</div>
        ))}
      </div>
      {series.length > 1 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: '#475569', flexWrap: 'wrap' }}>
          {series.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 9999, background: s.color, display: 'inline-block' }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
