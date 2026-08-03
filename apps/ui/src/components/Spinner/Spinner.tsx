'use client';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

const sizeMap: Record<NonNullable<SpinnerProps['size']>, number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function Spinner({ size = 'md', color = 'currentColor', className }: SpinnerProps) {
  const px = sizeMap[size];
  return (
    <span
      role="status"
      aria-label="Loading"
      className={className}
      style={{
        display: 'inline-block',
        width: px,
        height: px,
        borderRadius: '50%',
        border: `${Math.max(2, px / 8)}px solid ${color}`,
        borderTopColor: 'transparent',
        animation: 'spin 0.75s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}
