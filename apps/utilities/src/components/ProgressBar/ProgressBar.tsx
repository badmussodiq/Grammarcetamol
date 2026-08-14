import {cn} from '../../utils/cn';

export interface ProgressBarProps {
  value: number;
  color?: string;
  height?: string | number;
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  color = 'var(--color-primary)',
  height = 8,
  showLabel,
  animated,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ height, backgroundColor: '#E2E8F0', borderRadius: 9999, flex: 1, overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 9999,
            transition: animated ? 'none' : 'width 200ms ease-out',
          }}
        />
      </div>
      {showLabel && (
        <span style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap', minWidth: 32, textAlign: 'right' }}>
          {clamped}%
        </span>
      )}
    </div>
  );
}
