'use client';

import React from 'react';
import { AuthUser, UserRole, normalizeUserRole, TabKey } from '@/types/groupware';
import { ChevronRight, RefreshCw, Plus, LogOut, ShieldCheck, Crown, Briefcase, User } from 'lucide-react';

interface Props {
  activeTab: TabKey;
  currentUser: AuthUser;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onOpenCreateModal?: () => void;
}

const TAB_TITLES: Record<TabKey, { label: string; sub: string }> = {
  dashboard: { label: '통합 대시보드', sub: '스패셜티 전사 운영 현황' },
  approvals: { label: '프로젝트 관리 (계약품의서)', sub: '원가 및 손익 계산' },
  projects: { label: '프로젝트 관리', sub: '과제수행 · 계약품의 · 투입공수' },
  reports: { label: '주간/월간 보고', sub: 'PM 금주/차주 작성 · 이사 취합/보완 · 사장님 최종 보고' },
  business_deals: { label: '프로젝트 관리', sub: '수주 파이프라인 및 연도별 목표매출' },
  employees: { label: '직원 관리', sub: '임직원 명부 및 조직도' },
  equipments: { label: '자산 관리', sub: 'IT 자산/워크스테이션/서버' },
  evaluations: { label: '인사 평가', sub: 'KPI/역량/다면평가 등급' },
  master_data: { label: '기준정보 관리', sub: '연도별 SW 기술자 노임단가 및 사내 공통 코드 관리' },
};

export default function Header({
  activeTab,
  currentUser,
  loading,
  onRefresh,
  onLogout,
  onOpenCreateModal,
}: Props) {
  const currentTabInfo = TAB_TITLES[activeTab] || { label: '그룹웨어', sub: '' };
  const currentRole = normalizeUserRole(currentUser.role, currentUser.position);

  const getAddButtonLabel = () => {
    // 스프링 시큐리티 권한별 등록 권한 제어
    switch (activeTab) {
      case 'employees':
        return currentRole === '시스템 관리자' ? '신규 직원 등록' : null;
      case 'projects':
        return currentRole !== '일반직원' ? '신규 프로젝트 생성' : null;
      case 'equipments':
        return currentRole === '시스템 관리자' ? '신규 자산 등록' : null;
      case 'business_deals':
        return currentRole !== '일반직원' ? '신규 사업기회 등록' : null;
      case 'evaluations':
        return currentRole === '시스템 관리자' || currentRole === '임원 권한' || currentRole === 'PM 권한'
          ? '인사평가 작성'
          : null;
      default:
        return null;
    }
  };

  const addBtnLabel = getAddButtonLabel();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-slate-900">{currentTabInfo.label}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* 로그인 사용자 정보 및 보안 권한 뱃지 (스프링 시큐리티 연동) */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
            {currentUser.name ? currentUser.name.slice(0, 1) : 'U'}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800">
              {currentUser.name} {currentUser.position}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                currentRole === '시스템 관리자'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : currentRole === '임원 권한'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : currentRole === 'PM 권한'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {currentRole}
            </span>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
          title="DB 최신 데이터 새로고침"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          새로고침
        </button>

        {/* Module Add button */}
        {addBtnLabel && onOpenCreateModal && (
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            {addBtnLabel}
          </button>
        )}

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
          title="로그아웃"
        >
          <LogOut className="w-3.5 h-3.5" />
          로그아웃
        </button>
      </div>
    </header>
  );
}

