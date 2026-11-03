'use client';

import React from 'react';

export type StatCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'purple';

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: StatCardVariant;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<
  StatCardVariant,
  { card: string; title: string; value: string; iconBg: string; iconColor: string }
> = {
  default: {
    card: 'bg-white border-slate-200/90 hover:border-slate-300',
    title: 'text-slate-500',
    value: 'text-slate-900',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
  },
  primary: {
    card: 'bg-white border-indigo-200/80 hover:border-indigo-300 bg-indigo-50/20',
    title: 'text-indigo-900',
    value: 'text-indigo-600',
    iconBg: 'bg-indigo-50 border border-indigo-100',
    iconColor: 'text-indigo-600',
  },
  success: {
    card: 'bg-white border-emerald-200/80 hover:border-emerald-300 bg-emerald-50/20',
    title: 'text-emerald-900',
    value: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border border-emerald-100',
    iconColor: 'text-emerald-600',
  },
  warning: {
    card: 'bg-white border-amber-200/80 hover:border-amber-300 bg-amber-50/20',
    title: 'text-amber-900',
    value: 'text-amber-600',
    iconBg: 'bg-amber-50 border border-amber-100',
    iconColor: 'text-amber-600',
  },
  danger: {
    card: 'bg-white border-rose-200/80 hover:border-rose-300 bg-rose-50/20',
    title: 'text-rose-900',
    value: 'text-rose-600',
    iconBg: 'bg-rose-50 border border-rose-100',
    iconColor: 'text-rose-600',
  },
  purple: {
    card: 'bg-white border-purple-200/80 hover:border-purple-300 bg-purple-50/20',
    title: 'text-purple-900',
    value: 'text-purple-600',
    iconBg: 'bg-purple-50 border border-purple-100',
    iconColor: 'text-purple-600',
  },
};

export function StatCard({
  title,
  value,
  subtext,
  icon,
  badge,
  variant = 'default',
  onClick,
  selected = false,
  className = '',
}: StatCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-2xl border shadow-2xs transition-all relative overflow-hidden ${
        styles.card
      } ${
        onClick
          ? 'cursor-pointer hover:shadow-xs active:scale-[0.99]'
          : ''
      } ${
        selected ? 'ring-2 ring-indigo-500 border-indigo-500' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-xs font-bold truncate ${styles.title}`}>
          {title}
        </span>
        {icon ? (
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${styles.iconBg} ${styles.iconColor}`}
          >
            {icon}
          </div>
        ) : badge ? (
          <div className="shrink-0">{badge}</div>
        ) : null}
      </div>

      <div className={`text-2xl font-black font-mono tracking-tight my-0.5 ${styles.value}`}>
        {value}
      </div>

      {subtext && (
        <div className="text-[11px] text-slate-400 font-medium truncate mt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}

export interface StatGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

const GRID_COLS = {
  2: 'grid grid-cols-1 sm:grid-cols-2 gap-3',
  3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
  4: 'grid grid-cols-2 lg:grid-cols-4 gap-3',
};

export function StatGrid({ children, columns = 4, className = '' }: StatGridProps) {
  return (
    <div className={`${GRID_COLS[columns]} ${className}`}>
      {children}
    </div>
  );
}

export default StatCard;
