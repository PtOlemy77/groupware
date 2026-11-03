'use client';

import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  value: string;
  onClear?: () => void;
  size?: 'sm' | 'md';
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = '검색어를 입력하세요...',
      size = 'md',
      className = '',
      ...rest
    },
    ref
  ) => {
    const isSm = size === 'sm';

    return (
      <div className={`relative flex items-center ${className}`}>
        <Search
          className={`absolute left-3 text-slate-400 pointer-events-none shrink-0 ${
            isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'
          }`}
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-300/90 bg-white text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
            isSm
              ? 'py-1.5 pl-8 pr-8 text-xs'
              : 'py-2 pl-9 pr-8 text-xs sm:text-sm'
          }`}
          {...rest}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="검색어 지우기"
            className="absolute right-2.5 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
export default SearchInput;
