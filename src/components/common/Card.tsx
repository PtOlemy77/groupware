'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const PADDING_STYLES = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export function Card({
  header,
  footer,
  padding = 'md',
  hoverable = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs transition-all overflow-hidden ${
        hoverable ? 'hover:border-slate-300 hover:shadow-xs' : ''
      } ${className}`}
      {...rest}
    >
      {header && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          {header}
        </div>
      )}
      <div className={PADDING_STYLES[padding]}>{children}</div>
      {footer && (
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
