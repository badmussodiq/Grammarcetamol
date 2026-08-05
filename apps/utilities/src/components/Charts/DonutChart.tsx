export interface DonutChartDatum {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutChartDatum[];
  size?: number;
  strokeWidth?: number;
}

/** Hand-rolled SVG (stroke-dasharray technique) — see BarChart's doc comment for why not a
 * charting library. */
export function DonutChart({ data, size = 160, strokeWidth = 24 }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offsetAccum = 0;
  const segments = data.map((d) => {
    const fraction = d.value / total;
    const dash = fraction * circumference;
    const segment = { ...d, fraction, dash, offset: offsetAccum };
    offsetAccum += dash;
    return segment;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
            >
              <title>{`${s.label}: ${Math.round(s.fraction * 100)}%`}</title>
            </circle>
          ))}
        </g>
      </svg>
      <ul style={{ fontSize: 12, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'none', padding: 0, margin: 0 }}>
        {segments.map((s) => (
          <li key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: s.color, display: 'inline-block' }} />
            {s.label} — {Math.round(s.fraction * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}
