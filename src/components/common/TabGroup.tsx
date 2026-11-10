'use client';

import React from 'react';

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number | string;
  badge?: string;
  disabled?: boolean;
}

export interface TabGroupProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: 'segmented' | 'pills';
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function TabGroup({
  items,
  activeKey,
  onChange,
  variant = 'segmented',
  size = 'md',
  fullWidth = false,
  className = '',
  ariaLabel = '분류 탭',
}: TabGroupProps) {
  const isSegmented = variant === 'segmented';

  const containerPadding = size === 'sm' ? 'p-1' : 'p-1.5';
  const itemPadding =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs rounded-lg'
      : 'px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold';

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex max-w-full flex-wrap items-center gap-1 bg-slate-100 rounded-xl border border-slate-200/80 ${containerPadding} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {items.map((tab) => {
        const isActive = activeKey === tab.key;

        let activeStyle = '';
        if (isActive) {
          activeStyle = isSegmented
            ? 'bg-white text-indigo-700 shadow-xs font-bold border border-slate-200/60'
            : 'bg-indigo-600 text-white shadow-xs font-bold';
        } else {
          activeStyle =
            'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium border border-transparent';
        }

        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.key)}
            className={`flex items-center justify-center gap-2 transition-all select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${itemPadding} ${activeStyle} ${
              fullWidth ? 'flex-1' : ''
            }`}
          >
            {tab.icon && (
              <span
                className={`shrink-0 flex items-center ${
                  isActive ? (isSegmented ? 'text-indigo-600' : 'text-white') : 'text-slate-500'
                }`}
              >
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`font-mono text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? isSegmented
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            )}
            {tab.badge && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default TabGroup;
