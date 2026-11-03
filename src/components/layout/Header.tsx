'use client';

import React from 'react';
import {
  AuthUser,
  normalizeUserRole,
  isSystemAdmin,
  isPmOrAbove,
  getRoleCode,
  TabKey,
} from '@/types/groupware';
import { RefreshCw, Plus, LogOut, ChevronLeft, Globe } from 'lucide-react';

interface Props {
  activeTab: TabKey;
  currentUser: AuthUser;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onOpenCreateModal?: () => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
}

const TAB_TITLES: Partial<Record<TabKey, { label: string; sub: string }>> = {
  dashboard: { label: '통합 대시보드', sub: '스패셜티 전사 운영 현황' },
  projects: { label: '프로젝트 관리', sub: '과제수행 · 계약품의 · 투입공수' },
  reports: { label: '주간/월간 보고', sub: 'PM 금주/차주 작성 · 이사 취합/보완 · 사장님 최종 보고' },
  employees: { label: '직원 관리', sub: '임직원 명부 및 조직도' },
  equipments: { label: 'IT 자산 관리', sub: '모니터 · 데스크탑 · 노트북' },
  evaluations: { label: '인사 평가 관리', sub: 'KPI/역량/다면평가 등급' },
  master_data: { label: '기준정보 관리', sub: '연도별 SW 기술자 노임단가 및 사내 공통 코드 관리' },
};

export default function Header({
  activeTab,
  currentUser,
  loading,
  onRefresh,
  onLogout,
  onOpenCreateModal,
  onGoBack,
  canGoBack = false,
}: Props) {
  const currentTabInfo = TAB_TITLES[activeTab] || { label: '그룹웨어', sub: '' };
  const roleCode = getRoleCode(currentUser);
  const currentRole = normalizeUserRole(currentUser);

  const getAddButtonLabel = () => {
    switch (activeTab) {
      case 'employees':
        return isSystemAdmin(currentUser) ? '신규 직원 등록' : null;
      case 'projects':
        return isPmOrAbove(currentUser) ? '신규 프로젝트 생성' : null;
      case 'equipments':
        return isSystemAdmin(currentUser) ? '신규 자산 등록' : null;
      case 'evaluations':
        return isPmOrAbove(currentUser) ? '인사평가 작성' : null;
      default:
        return null;
    }
  };

  const addBtnLabel = getAddButtonLabel();

  return (
    <header className="h-16 shrink-0 bg-white border-b border-slate-200 pl-12 pr-3 md:px-6 flex items-center justify-between gap-2 sticky top-0 z-20 shadow-2xs">
      <div className="flex min-w-0 items-center gap-2">
        {onGoBack && (
          <button
            type="button"
            onClick={onGoBack}
            disabled={!canGoBack}
            className={`p-2 rounded-xl border transition flex items-center justify-center ${
              canGoBack
                ? 'bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border-slate-200 shadow-2xs hover:border-slate-300 cursor-pointer'
                : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-40'
            }`}
            title={canGoBack ? '이전 화면으로 뒤로가기' : '이전 화면 없음'}
            aria-label="이전 화면으로 뒤로가기"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-sm sm:text-base md:text-lg font-bold text-slate-900">{currentTabInfo.label}</h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 lg:gap-3">
        {/* 로그인 사용자 정보 및 보안 권한 뱃지 */}
        <div className="hidden xl:flex whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
            {currentUser.name ? currentUser.name.slice(0, 1) : 'U'}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800">
              {currentUser.name} {currentUser.position}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                roleCode === 'ROLE_ADMIN'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : roleCode === 'ROLE_EXEC'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : roleCode === 'ROLE_PM'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {currentRole}
            </span>
          </div>
        </div>

        <a href="#top" aria-label="스패셜티 포털" title="스패셜티 공개 포털로 이동"
          className="flex items-center justify-center rounded-xl border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/25">
          <Globe className="h-4 w-4" />
        </a>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
          title="최신 데이터 새로고침"
          aria-label="최신 데이터 새로고침"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span className="hidden sm:inline">새로고침</span>
        </button>

        {/* Module Add button */}
        {addBtnLabel && onOpenCreateModal && (
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{addBtnLabel}</span>
          </button>
        )}

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
          title="로그아웃"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">로그아웃</span>
        </button>
      </div>
    </header>
  );
}
