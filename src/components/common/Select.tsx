'use client';

import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  size?: SelectSize;
  options?: SelectOption[];
  fullWidth?: boolean;
  containerClassName?: string;
}

const SIZE_STYLES: Record<SelectSize, string> = {
  sm: 'h-8 px-2.5 py-1 text-xs rounded-lg pr-7',
  md: 'h-10 px-3 py-2 text-sm rounded-xl pr-9',
  lg: 'h-12 px-4 py-2.5 text-base rounded-xl pr-10',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      size = 'md',
      options,
      fullWidth = false,
      containerClassName = '',
      className = '',
      id,
      children,
      disabled,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className={`inline-flex flex-col ${fullWidth ? 'w-full' : ''} ${containerClassName}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-bold text-slate-700 mb-1.5 select-none"
          >
            {label}
          </label>
        )}
        <div className="relative inline-block w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`w-full appearance-none bg-white border font-medium text-slate-800 transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-200 hover:border-slate-300'
            } ${SIZE_STYLES[size]} ${className}`}
            {...rest}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;

