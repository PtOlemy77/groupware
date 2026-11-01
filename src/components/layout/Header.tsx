'use client';
import { AuthUser, TabKey } from '@/types/groupware';
import { RefreshCw, LogOut, Plus } from 'lucide-react';
interface Props {
  activeTab: TabKey;
  currentUser: AuthUser;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onOpenCreateModal?: () => void;
}
const titles: Record<TabKey, string> = {
  dashboard: '통합 대시보드',
  projects: '프로젝트 관리',
  approvals: '계약품의 · 결재',
  reports: '주간/월간 보고',
  business_deals: '영업 · 수주 관리',
  employees: '직원 관리',
  equipments: '자산 관리',
  evaluations: '인사 평가',
  master_data: '기준정보 관리',
};
export default function Header({
  activeTab,
  currentUser,
  loading,
  onRefresh,
  onLogout,
  onOpenCreateModal,
}: Props) {
  return (
    <header className="min-h-16 py-3 pl-14 pr-3 md:px-6 bg-white border-b border-slate-200 flex items-center gap-2 sticky top-0 z-20">
      <h1 className="text-base md:text-lg font-bold truncate min-w-0 flex-1">
        {titles[activeTab]}
      </h1>
      <span className="hidden md:block text-sm text-slate-600">
        {currentUser.name} {currentUser.position} · {currentUser.role}
      </span>
      <button
        aria-label="새로고침"
        title="새로고침"
        disabled={loading}
        onClick={onRefresh}
        className="p-2 rounded hover:bg-slate-100 shrink-0"
      >
        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
      </button>
      {onOpenCreateModal && (
        <button
          aria-label="신규 등록"
          title="신규 등록"
          onClick={onOpenCreateModal}
          className="p-2 shrink-0"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
      <button
        aria-label="로그아웃"
        title="로그아웃"
        onClick={onLogout}
        className="flex items-center gap-1 p-2 rounded hover:bg-rose-50 text-rose-700 shrink-0"
      >
        <LogOut className="w-5 h-5" />
        <span className="hidden sm:inline text-sm">로그아웃</span>
      </button>
    </header>
  );
}
