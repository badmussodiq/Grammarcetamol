export interface BarChartDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartDatum[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
}

/**
 * Hand-rolled SVG, no charting library — matches the frontend's standing "minimize external
 * packages" constraint and the existing custom-built-primitive pattern (Button, Badge,
 * ProgressBar, ...). No zoom/pan/brush; a `<title>` per bar is the only interactivity, via the
 * browser's native tooltip.
 */
export function BarChart({ data, color = '#0EA5E9', height = 200, formatValue }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const chartHeight = height - 20;
  const barWidth = data.length > 0 ? 100 / data.length : 100;

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
        role="img"
        aria-label="Bar chart"
      >
        {data.map((d, i) => {
          const barHeight = (d.value / max) * chartHeight;
          const x = i * barWidth + barWidth * 0.15;
          const w = barWidth * 0.7;
          const y = chartHeight - barHeight;
          return (
            <rect key={d.label} x={x} y={y} width={w} height={Math.max(barHeight, 0)} fill={color} rx={1}>
              <title>{`${d.label}: ${formatValue ? formatValue(d.value) : d.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: 'flex' }}>
        {data.map((d) => (
          <div key={d.label} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
