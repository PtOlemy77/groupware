'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  showQuickJumper?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalCount,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className = '',
}: PaginationProps) {
  if (totalPages <= 0 && (!totalCount || totalCount <= 0)) {
    return null;
  }

  // 표시할 페이지 번호 범위 계산 (최대 5개 노출)
  const getPageNumbers = () => {
    const delta = 2;
    const range: number[] = [];
    const start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, currentPage + delta);

    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 py-3 px-2 text-xs sm:text-sm text-slate-600 ${className}`}
      aria-label="페이지 네비게이션"
    >
      <div className="flex items-center gap-3">
        {totalCount !== undefined && (
          <span className="text-xs text-slate-500 font-medium">
            총 <strong className="font-semibold text-slate-800">{totalCount.toLocaleString()}</strong>건
            {totalPages > 0 && (
              <span className="ml-1 text-slate-400">
                ({currentPage} / {totalPages} 페이지)
              </span>
            )}
          </span>
        )}

        {pageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-slate-400">목록 수:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 px-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}개씩
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* 맨 처음 페이지 버튼 */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          aria-label="첫 페이지"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* 이전 페이지 버튼 */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-7 px-2.5 flex items-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>이전</span>
        </button>

        {/* 첫 페이지 생략 표시 */}
        {pages[0] > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              1
            </button>
            {pages[0] > 2 && <span className="px-1 text-slate-400 text-xs">…</span>}
          </>
        )}

        {/* 페이지 번호 목록 */}
        {pages.map((p) => {
          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {p}
            </button>
          );
        })}

        {/* 마지막 페이지 생략 표시 */}
        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && (
              <span className="px-1 text-slate-400 text-xs">…</span>
            )}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {totalPages}
            </button>
          </>
        )}

        {/* 다음 페이지 버튼 */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-7 px-2.5 flex items-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span>다음</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* 맨 끝 페이지 버튼 */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          aria-label="마지막 페이지"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;

