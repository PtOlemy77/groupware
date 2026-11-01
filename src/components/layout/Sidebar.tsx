'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Laptop,
  Award,
  FileText,
  Layers,
  Globe,
  Sliders,
} from 'lucide-react';
import { TabKey, AuthUser, COMPANY_WEBSITE, normalizeUserRole, isPmOrAbove } from '@/types/groupware';

interface Props {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  currentUser: AuthUser;
  counts: {
    approvals: number;
    employees: number;
    projects: number;
    equipments: number;
    deals: number;
    evaluations: number;
  };
}

export default function Sidebar({
  activeTab,
  onTabChange,
  currentUser,
  counts,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const userRole = normalizeUserRole(currentUser?.role, currentUser?.position);
  const canAccessMasterData = userRole === '시스템 관리자' || userRole === '임원 권한';
  // 주간/월간보고는 PM 권한 이상(PM, 임원, 시스템 관리자)만 메뉴 노출
  const canAccessReports =
    isPmOrAbove(currentUser?.role, currentUser?.position) ||
    userRole === '시스템 관리자';

  const navItems = [
    {
      id: 'dashboard' as TabKey,
      label: '통합 대시보드',
      icon: <LayoutDashboard className="w-5 h-5 stroke-[1.8]" />,
    },
    {
      id: 'projects' as TabKey,
      label: '프로젝트 관리',
      icon: <Briefcase className="w-5 h-5 stroke-[1.8]" />,
      count: counts.projects,
    },
    ...(canAccessReports
      ? [
          {
            id: 'reports' as TabKey,
            label: '주간/월간 보고',
            icon: <FileText className="w-5 h-5 stroke-[1.8]" />,
          },
        ]
      : []),
    {
      id: 'employees' as TabKey,
      label: '직원 관리',
      icon: <Users className="w-5 h-5 stroke-[1.8]" />,
      count: counts.employees,
    },
    {
      id: 'equipments' as TabKey,
      label: '자산 관리',
      icon: <Laptop className="w-5 h-5 stroke-[1.8]" />,
      count: counts.equipments,
    },
    {
      id: 'evaluations' as TabKey,
      label: '인사 평가',
      icon: <Award className="w-5 h-5 stroke-[1.8]" />,
      count: counts.evaluations,
    },
    ...(canAccessMasterData
      ? [
          {
            id: 'master_data' as TabKey,
            label: '기준정보 관리',
            icon: <Sliders className="w-5 h-5 stroke-[1.8]" />,
          },
        ]
      : []),
  ];

  return (
    <>
    <button aria-label="메뉴 열기" aria-expanded={mobileOpen} className="md:hidden fixed left-2 top-3 z-50 bg-slate-900 text-white p-2 rounded" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
    <aside aria-label="업무 메뉴" className={`${mobileOpen ? 'flex' : 'hidden'} md:flex fixed md:relative top-12 md:top-0 bottom-0 left-0 z-40 w-72 bg-slate-900 text-slate-100 flex-col shrink-0 border-r border-slate-800 select-none`}>
      {/* Brand Logo & Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Layers className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-white">스패셜티</span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              SPATIAL T
            </span>
          </div>
          <p className="text-xs text-slate-400">공간정보(GIS) 통합 그룹웨어</p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          SpatialT Modules
        </div>
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              aria-current={active ? 'page' : undefined}
              onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={active ? 'text-white' : 'text-slate-400'}>{item.icon}</div>
                <div className="text-sm font-semibold leading-tight">{item.label}</div>
              </div>
              {item.count !== undefined && (
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    active ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Company Info Footer */}
      <div className="p-4 m-4 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Spring Boot JPA PostgreSQL
          </span>
          <span className="text-slate-300 font-medium">:8080</span>
        </div>
        <div className="pt-2 border-t border-slate-700/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
              {currentUser.name.slice(0, 1)}
            </div>
            <div className="text-xs">
              <div className="font-semibold text-white">
                {currentUser.name} {currentUser.position}
              </div>
              <div className="text-slate-400 text-[11px]">{currentUser.department}</div>
            </div>
          </div>
          <a
            href={COMPANY_WEBSITE}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg bg-slate-700/70 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="스패셜티 공식 홈페이지 열기"
          >
            <Globe className="w-4 h-4" />
          </a>
        </div>
      </div>
    </aside>
    </>
  );
}

