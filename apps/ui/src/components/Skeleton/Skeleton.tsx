import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circle' | 'rect';
  className?: string;
}

export function Skeleton({ width, height, variant = 'rect', className }: SkeletonProps) {
  const baseStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, #E2E8F0 25%, #F8FAFC 50%, #E2E8F0 75%)',
    backgroundSize: '400px 100%',
    animation: 'shimmer 1.5s infinite',
    display: 'block',
  };

  if (variant === 'text') {
    baseStyle.height = height ?? '1em';
    baseStyle.width = width ?? '100%';
    baseStyle.borderRadius = '4px';
  } else if (variant === 'circle') {
    const size = width ?? height ?? 40;
    baseStyle.width = size;
    baseStyle.height = size;
    baseStyle.borderRadius = '9999px';
  } else {
    baseStyle.width = width ?? '100%';
    baseStyle.height = height ?? 20;
    baseStyle.borderRadius = '8px';
  }

  return <span style={baseStyle} className={className} aria-hidden="true" />;
}
