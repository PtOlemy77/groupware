'use client';

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
import ContractDashboard from '@/components/contract/ContractDashboard';
import EmployeesView from '@/components/employees/EmployeesView';
import ProjectsView from '@/components/projects/ProjectsView';
import EquipmentsView from '@/components/equipments/EquipmentsView';
import BusinessDealsView from '@/components/deals/BusinessDealsView';
import EvaluationsView from '@/components/evaluations/EvaluationsView';
import MasterDataView from '@/components/master/MasterDataView';
import WeeklyMonthlyReportView from '@/components/projects/WeeklyMonthlyReportView';

const SESSION_STORAGE_KEY = 'spatialt_groupware_session_user';

export default function GroupwareApp() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [selectedReportProjectId, setSelectedReportProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Core Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [deals, setDeals] = useState<BusinessDeal[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [commonCodes, setCommonCodes] = useState<CommonCode[]>([]);

  // Fetch all domain data from Spring Boot Backend
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8080/api/groupware');
      if (res.ok) {
        const json = await res.json();
        setEmployees(json.employees || []);
        setProjects(json.projects || []);
        setEquipments(json.equipments || []);
        setDeals(json.business_deals || []);
        setEvaluations(json.evaluations || []);
        setApprovals(json.approvals || []);
        setCommonCodes(json.common_codes || []);

        // 최신 DB 직원 정보와 현재 로그인 세션 사용자(직급/권한/부서 등) 실시간 동기화
        if (json.employees && json.employees.length > 0) {
          try {
            const savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
            const activeUser = currentUser || (savedSession ? JSON.parse(savedSession) : null);
            if (activeUser) {
              const fresh = json.employees.find(
                (e: Employee) =>
                  e.id === activeUser.id ||
                  e.emp_no === activeUser.emp_no ||
                  (e.name === activeUser.name && e.department === activeUser.department)
              );
              if (fresh) {
                const updated: AuthUser = {
                  ...activeUser,
                  ...fresh,
                  role: normalizeUserRole(fresh.role, fresh.position),
                };
                setCurrentUser(updated);
                sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
              }
            }
          } catch (err) {
            console.error('Failed to sync session with fresh employee data:', err);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load groupware data:', e);
    } finally {
      setLoading(false);
    }
  };

  // 브라우저 탭이 열려있는 동안(새로고침 포함) 세션 유지, 브라우저 닫으면 세션 종료
  useEffect(() => {
    fetchAllData();
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.emp_no || parsed.id)) {
          setCurrentUser({
            ...parsed,
            role: normalizeUserRole(parsed.role, parsed.position),
          });
        }
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
    }
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    const normalized = {
      ...user,
      role: normalizeUserRole(user.role, user.position),
    };
    setCurrentUser(normalized);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      console.error('Failed to persist session:', e);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
  };

  // If not logged in, render Login Page immediately
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 기준정보 관리 권한 가드 (일반직원/PM은 접근 불가 -> 대시보드로 전환)
  const isSysOrExec = currentUser.role === '시스템 관리자' || currentUser.role === '임원 권한';
  // 주간/월간보고 권한 가드 (PM 권한 이상만 접근 가능)
  const canAccessReports =
    isPmOrAbove(currentUser.role, currentUser.position) ||
    currentUser.role === '시스템 관리자';

  let effectiveTab = activeTab;
  if (effectiveTab === 'master_data' && !isSysOrExec) {
    effectiveTab = 'dashboard';
  } else if (effectiveTab === 'reports' && !canAccessReports) {
    effectiveTab = 'dashboard';
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={effectiveTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        counts={{
          approvals: approvals.length,
          employees: employees.length,
          projects: projects.length,
          equipments: equipments.length,
          deals: deals.length,
          evaluations: evaluations.length,
        }}
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
        <main className="flex-1 p-5 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              employees={employees}
              projects={projects}
              equipments={equipments}
              deals={deals}
              evaluations={evaluations}
              approvals={approvals}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'projects' && (
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

          {activeTab === 'reports' && (
            <WeeklyMonthlyReportView
              projects={projects}
              approvals={approvals}
              currentUser={currentUser}
              initialSelectedProjectId={selectedReportProjectId}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'approvals' && (
            <ProjectsView
              projects={projects}
              currentUser={currentUser}
              approvals={approvals}
              employees={employees}
              deals={deals}
              commonCodes={commonCodes}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'business_deals' && (
            <ProjectsView
              projects={projects}
              currentUser={currentUser}
              approvals={approvals}
              employees={employees}
              deals={deals}
              commonCodes={commonCodes}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeesView
              employees={employees}
              currentUser={currentUser}
              projects={projects}
              approvals={approvals}
              commonCodes={commonCodes}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'equipments' && (
            <EquipmentsView
              equipments={equipments}
              currentUser={currentUser}
              employees={employees}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'evaluations' && (
            <EvaluationsView
              evaluations={evaluations}
              currentUser={currentUser}
              employees={employees}
              onRefresh={fetchAllData}
            />
          )}

          {activeTab === 'master_data' && (
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
