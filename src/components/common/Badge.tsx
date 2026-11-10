'use client';

import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'purple';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
  icon?: React.ReactNode;
}

const BADGE_STYLES: Record<BadgeVariant, { bg: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    dot: 'bg-emerald-500',
  },
  info: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200/70',
    dot: 'bg-blue-500',
  },
  warning: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200/70',
    dot: 'bg-amber-500',
  },
  danger: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200/70',
    dot: 'bg-rose-500',
  },
  neutral: {
    bg: 'bg-slate-100 text-slate-700 border-slate-200/80',
    dot: 'bg-slate-400',
  },
  purple: {
    bg: 'bg-purple-50 text-purple-700 border-purple-200/70',
    dot: 'bg-purple-500',
  },
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  pulse = false,
  icon,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  const styles = BADGE_STYLES[variant];
  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${styles.bg} ${sizeClass} ${className}`}
      {...rest}
    >
      {pulse && (
        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} animate-pulse shrink-0`} />
      )}
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

export default Badge;
