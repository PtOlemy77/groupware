'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs hover:shadow-sm border border-transparent disabled:bg-indigo-300 disabled:shadow-none',
  secondary:
    'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200',
  outline:
    'bg-transparent hover:bg-indigo-50 text-indigo-600 border border-indigo-300 active:bg-indigo-100 disabled:border-slate-200 disabled:text-slate-300',
  danger:
    'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs border border-transparent disabled:bg-rose-300',
  ghost:
    'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 border border-transparent disabled:text-slate-300',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1.5 font-medium',
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5 font-semibold',
  md: 'px-4 py-2 text-sm rounded-xl gap-2 font-semibold',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2.5 font-bold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconRight,
      loading = false,
      fullWidth = false,
      disabled,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center transition-all select-none cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
          VARIANT_STYLES[variant]
        } ${SIZE_STYLES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...rest}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0 flex items-center">{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
        {!loading && iconRight && (
          <span className="shrink-0 flex items-center">{iconRight}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
