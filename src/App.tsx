import { apiFetch } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import {
  AuthUser,
  UserRole,
  normalizeUserRole,
  isPmOrAbove,
  isExecutiveOrAbove,
  TabKey,
  Employee,
  Project,
  Equipment,
  BusinessDeal,
  Evaluation,
  Approval,
  CommonCode,
} from '@/types/groupware';
import LoginPage from '@/components/LoginPage';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DashboardView from '@/components/dashboard/DashboardView';
import EmployeesView from '@/components/employees/EmployeesView';
import ProjectsView from '@/components/projects/ProjectsView';
import EquipmentsView from '@/components/equipments/EquipmentsView';
import EvaluationsView from '@/components/evaluations/EvaluationsView';
import MasterDataView from '@/components/master/MasterDataView';
import PasswordChange from '@/components/PasswordChange';
import InteractionGuard from '@/components/InteractionGuard';
import WeeklyMonthlyReportView from '@/components/projects/WeeklyMonthlyReportView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [selectedReportProjectId, setSelectedReportProjectId] = useState<
    number | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState('');
  const [page, setPage] = useState(0),
    [pageTotal, setPageTotal] = useState(0);
  const [counts, setCounts] = useState({
    employees: 0,
    projects: 0,
    equipments: 0,
    deals: 0,
    evaluations: 0,
    approvals: 0,
  });

  // Core Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [deals, setDeals] = useState<BusinessDeal[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [commonCodes, setCommonCodes] = useState<CommonCode[]>([]);

  const clearData = () => {
    setEmployees([]);
    setProjects([]);
    setEquipments([]);
    setDeals([]);
    setEvaluations([]);
    setApprovals([]);
    setCommonCodes([]);
  };
  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const me = await apiFetch('/api/auth/me');
      const user = (await me.json()).user;
      setCurrentUser(user);
      if (user.password_change_required) return;
      const res = await apiFetch(
        `/api/groupware?scope=${activeTab}&page=${page}&size=50`,
      );
      const data = await res.json();
      setEmployees(data.employees);
      setProjects(data.projects);
      setEquipments(data.equipments);
      setDeals(data.business_deals);
      setEvaluations(data.evaluations);
      setApprovals(data.approvals);
      setCommonCodes(data.common_codes);
      setCounts(data.counts);
      setPageTotal(data.page_total || 0);
      setLoadedAt(new Date(data.loaded_at).toLocaleString('ko-KR'));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
      setRestoring(false);
    }
  };
  useEffect(() => {
    const expire = () => {
      setCurrentUser(null);
      clearData();
      setRestoring(false);
    };
    const fail = (e: Event) => setError((e as CustomEvent<string>).detail);
    const unhandled = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof Error) {
        setError(e.reason.message);
        e.preventDefault();
      }
    };
    const hash = () => {
      const key = location.hash.slice(1);
      if (
        [
          'dashboard',
          'projects',
          'approvals',
          'business_deals',
          'reports',
          'employees',
          'equipments',
          'evaluations',
          'master_data',
        ].includes(key)
      )
        setActiveTab(key as TabKey);
    };
    window.addEventListener('session-expired', expire);
    window.addEventListener('api-error', fail);
    window.addEventListener('unhandledrejection', unhandled);
    window.addEventListener('hashchange', hash);
    hash();
    fetchAllData();
    return () => {
      window.removeEventListener('session-expired', expire);
      window.removeEventListener('api-error', fail);
      window.removeEventListener('unhandledrejection', unhandled);
      window.removeEventListener('hashchange', hash);
    };
  }, []);
  useEffect(() => {
    if (!restoring) {
      window.location.hash = activeTab;
      if (currentUser && !currentUser.password_change_required)
        void fetchAllData();
    }
  }, [activeTab, page]);
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    clearData();
    setError('');
    if (!user.password_change_required) void fetchAllData();
  };
  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      clearData();
      setActiveTab('dashboard');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그아웃하지 못했습니다.');
    }
  };
  useEffect(() => {
    if (!currentUser) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          void handleLogout();
        },
        30 * 60 * 1000,
      );
    };
    reset();
    for (const event of ['pointerdown', 'keydown', 'touchstart'])
      window.addEventListener(event, reset, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const event of ['pointerdown', 'keydown', 'touchstart'])
        window.removeEventListener(event, reset);
    };
  }, [currentUser?.id]);
  if (restoring)
    return (
      <div role="status" className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-400">스패셜티 그룹웨어 연결 중…</p>
      </div>
    );
  if (!currentUser) return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  if (currentUser.password_change_required)
    return (
      <PasswordChange onChanged={handleLoginSuccess} onLogout={handleLogout} />
    );

  // 기준정보 관리 권한 가드 (일반직원/PM은 접근 불가 -> 대시보드로 전환)
  const isSysOrExec = isExecutiveOrAbove(currentUser);
  // 주간/월간보고 권한 가드 (PM 권한 이상만 접근 가능)
  const canAccessReports = isPmOrAbove(currentUser);

  let effectiveTab = activeTab;
  if (effectiveTab === 'approvals' || effectiveTab === 'business_deals') {
    effectiveTab = 'projects';
  } else if (effectiveTab === 'master_data' && !isSysOrExec) {
    effectiveTab = 'dashboard';
  } else if (effectiveTab === 'reports' && !canAccessReports) {
    effectiveTab = 'dashboard';
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <InteractionGuard />
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={effectiveTab}
        onTabChange={(tab) => {
          setPage(0);
          setActiveTab(tab);
        }}
        currentUser={currentUser}
        counts={counts}
      />

      {/* 2. Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          activeTab={effectiveTab}
          currentUser={currentUser}
          loading={loading}
          onRefresh={fetchAllData}
          onLogout={handleLogout}
        />

        {/* Dynamic Tab Body */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0 bg-slate-50/70">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs font-semibold text-rose-800 shadow-2xs"
            >
              <span>{error}</span>
              <button
                onClick={fetchAllData}
                className="px-2.5 py-1 rounded-xl bg-white text-rose-700 border border-rose-200 hover:bg-rose-100 transition font-bold"
              >
                다시 불러오기
              </button>
            </div>
          )}

          {effectiveTab === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              employees={employees}
              projects={projects}
              equipments={equipments}
              deals={deals}
              evaluations={evaluations}
              approvals={approvals}
              onNavigateTab={(tab) => {
                // 제거된 탭(approvals, business_deals)은 projects로 이동
                if (tab === 'approvals' || tab === 'business_deals') {
                  setActiveTab('projects');
                } else {
                  setActiveTab(tab);
                }
              }}
            />
          )}

          {effectiveTab === 'projects' && (
            <ProjectsView
              projects={projects}
              currentUser={currentUser}
              approvals={approvals}
              employees={employees}
              deals={deals}
              commonCodes={commonCodes}
              onRefresh={fetchAllData}
              onNavigateToReports={(pId) => {
                setSelectedReportProjectId(pId || null);
                setActiveTab('reports');
              }}
            />
          )}

          {effectiveTab === 'reports' && (
            <WeeklyMonthlyReportView
              employees={employees}
              projects={projects}
              approvals={approvals}
              currentUser={currentUser}
              initialSelectedProjectId={selectedReportProjectId}
              onRefresh={fetchAllData}
            />
          )}

          {effectiveTab === 'employees' && (
            <EmployeesView
              employees={employees}
              currentUser={currentUser}
              projects={projects}
              approvals={approvals}
              commonCodes={commonCodes}
              onRefresh={fetchAllData}
            />
          )}

          {effectiveTab === 'equipments' && (
            <EquipmentsView
              equipments={equipments}
              currentUser={currentUser}
              employees={employees}
              onRefresh={fetchAllData}
            />
          )}

          {effectiveTab === 'evaluations' && (
            <EvaluationsView
              evaluations={evaluations}
              currentUser={currentUser}
              employees={employees}
              onRefresh={fetchAllData}
            />
          )}

          {effectiveTab === 'master_data' && (
            <MasterDataView
              currentUser={currentUser}
              commonCodes={commonCodes}
              onRefresh={fetchAllData}
            />
          )}
        </main>
      </div>
    </div>
  );
}

