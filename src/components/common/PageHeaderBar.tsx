'use client';

import React from 'react';

export interface PageHeaderBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bordered?: boolean;
}

/**
 * 그룹웨어 각 화면 최상단에 위치하는 공통 툴바 / 필터 바 컴포넌트
 * - 화면별로 상이하던 패딩, 보더, 라운딩, 그림자를 통일합니다.
 * - 좌측: 서브탭, 상태 필터 그룹, 분류 셀렉트
 * - 우측: 검색창, 보기방식 전환, 액션 버튼(신규 등록 등)
 */
export function PageHeaderBar({
  left,
  right,
  children,
  className = '',
  bordered = true,
}: PageHeaderBarProps) {
  if (children) {
    return (
      <div
        className={`bg-white p-3 sm:p-4 rounded-2xl ${
          bordered ? 'border border-slate-200/90' : ''
        } shadow-2xs ${className}`}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`bg-white p-3 sm:p-4 rounded-2xl ${
        bordered ? 'border border-slate-200/90' : ''
      } shadow-2xs flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      {left && (
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          {left}
        </div>
      )}
      {right && (
        <div className="flex items-center gap-2.5 flex-wrap ml-auto">
          {right}
        </div>
      )}
    </div>
  );
}

export default PageHeaderBar;
