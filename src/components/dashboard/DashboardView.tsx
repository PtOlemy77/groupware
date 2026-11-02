'use client';
import { readMaster, saveMaster } from '@/lib/api';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AuthUser,
  Employee,
  Project,
  Equipment,
  BusinessDeal,
  Evaluation,
  Approval,
  TabKey,
  Holiday,
  CommonCode,
  formatCurrencyManwon,
  getMultiYearRevenueForYear,
  getProjectYearlyScope,
  ProjectYearlyScope,
  calculateMultiYearRevenues,
  getProjectShareRate,
} from '@/types/groupware';
import {
  Users,
  Briefcase,
  TrendingUp,
  Target,
  CheckCircle2,
  Layers,
  Calendar,
  BarChart3,
  CalendarDays,
} from 'lucide-react';
import CompanyScheduleCalendar from './CompanyScheduleCalendar';

interface Props {
  currentUser: AuthUser;
  employees: Employee[];
  projects: Project[];
  equipments: Equipment[];
  deals: BusinessDeal[];
  evaluations: Evaluation[];
  approvals: Approval[];
  holidays?: Holiday[];
  commonCodes?: CommonCode[];
  onNavigateTab: (tab: TabKey) => void;
  onQuickApprove?: (ap: Approval) => void;
  onQuickReject?: (ap: Approval) => void;
}

// 프로젝트 상태 정규화 헬퍼 (발주예상 | 제안준비중 | 프로젝트 수행 | 완료)
export function normalizeProjectStatus(status: string): '발주예상' | '제안준비중' | '프로젝트 수행' | '완료' {
  if (status === '발주예상') return '발주예상';
  if (status === '제안준비중' || status === '검토중') return '제안준비중';
  if (status === '완료') return '완료';
  return '프로젝트 수행'; // '진행중', '지연' 등 기본값
}

export default function DashboardView({
  currentUser,
  employees,
  projects,
  deals,
  approvals,
  holidays = [],
  commonCodes = [],
  onNavigateTab,
}: Props) {
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'calendar'>('overview');
  const currentYear = new Date().getFullYear();

  // 1. 기준정보 관리에서 연동되는 연도별 전사 사업 목표매출
  const [targetRevenue, setTargetRevenue] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const targetRow = commonCodes?.find(
          (c) => c.group_code === 'MASTER_TARGETS' && c.code === 'DATA'
        );
        const saved = targetRow?.extra_value || readMaster('spatialt_master_target_revenues');
        if (saved) {
          const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
          if (parsed[currentYear]?.targetAmount) return Number(parsed[currentYear].targetAmount);
          if (typeof parsed[currentYear] === 'number') return Number(parsed[currentYear]);
        }
      }
    } catch (e) {}
    return 0;
  });

  useEffect(() => {
    const loadTargetRevenue = () => {
      try {
        const targetRow = commonCodes?.find(
          (c) => c.group_code === 'MASTER_TARGETS' && c.code === 'DATA'
        );
        const saved = targetRow?.extra_value || readMaster('spatialt_master_target_revenues');
        if (saved) {
          const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
          if (parsed[currentYear]?.targetAmount) {
            setTargetRevenue(Number(parsed[currentYear].targetAmount));
            return;
          }
          if (typeof parsed[currentYear] === 'number') {
            setTargetRevenue(Number(parsed[currentYear]));
            return;
          }
        }
      } catch (e) {}
    };

    // 마운트 시 즉시 한 번 로드
    loadTargetRevenue();

    window.addEventListener('target-revenues-updated', loadTargetRevenue);
    window.addEventListener('master-data-updated', loadTargetRevenue);
    window.addEventListener('storage', loadTargetRevenue);
    return () => {
      window.removeEventListener('target-revenues-updated', loadTargetRevenue);
      window.removeEventListener('master-data-updated', loadTargetRevenue);
      window.removeEventListener('storage', loadTargetRevenue);
    };
  }, [currentYear, commonCodes]);

  // 2. 프로젝트 상태별 집계 및 올해(currentYear) 기간 귀속 당사 지분율 매출 계산
  const {
    confirmedRevenue,
    estimatedRevenue,
    stageCounts,
    currentAchievementRate,
    estimatedAchievementRate,
  } = useMemo(() => {
    let confirmed = 0;
    let pipelineWeighted = 0;

    const counts = {
      orderExpected: 0,   // 발주예상
      proposalPrep: 0,    // 제안준비중
      executing: 0,       // 프로젝트 수행
      completed: 0,       // 완료
    };

    // 연차사업은 올해 기간으로만 안분되고, 컨소시엄 지분율이 적용된 당사 매출 기준 집계
    projects.forEach((prj) => {
      const normStatus = normalizeProjectStatus(prj.status);
      const prjYearRev = getMultiYearRevenueForYear(prj, currentYear);

      if (normStatus === '완료') {
        counts.completed += 1;
        confirmed += prjYearRev;
      } else if (normStatus === '프로젝트 수행') {
        counts.executing += 1;
        confirmed += prjYearRev;
      } else if (normStatus === '제안준비중') {
        counts.proposalPrep += 1;
        pipelineWeighted += Math.round(prjYearRev * 0.6);
      } else if (normStatus === '발주예상') {
        counts.orderExpected += 1;
        pipelineWeighted += Math.round(prjYearRev * 0.35);
      }
    });

    const totalEstimated = confirmed + pipelineWeighted;
    const currentRate = targetRevenue > 0 ? Number(((confirmed / targetRevenue) * 100).toFixed(1)) : 0;
    const estimatedRate = targetRevenue > 0 ? Number(((totalEstimated / targetRevenue) * 100).toFixed(1)) : 0;

    return {
      confirmedRevenue: confirmed,
      estimatedRevenue: totalEstimated,
      stageCounts: counts,
      currentAchievementRate: currentRate,
      estimatedAchievementRate: estimatedRate,
    };
  }, [projects, targetRevenue, currentYear]);

  // 3. 사업본부 가용인원 산정 (조직도 기준과 동일하게 프로젝트 + 계약품의서 투입인원 연동)
  const bizAvailability = useMemo(() => {
    const bizEmps = employees.filter(
      (e) => e.department === '사업본부' || e.department_code === 'DEPT_BIZ'
    );
    const assignedNames = new Set<number>();

    projects
      .filter((p) => normalizeProjectStatus(p.status) === '프로젝트 수행' || normalizeProjectStatus(p.status) === '제안준비중')
      .forEach((p) => {
        if (p.pm_id) assignedNames.add(p.pm_id);
        (p.member_ids || []).forEach(id => assignedNames.add(id));
      });

    approvals
      .filter((a) => (a.category === '계약품의' || a.category === '계약품의서') && a.status !== '반려')
      .forEach((a) => {
        try {
          const parsed = JSON.parse(a.items_json || '{}');
          if (Array.isArray(parsed.manpowerPlans)) {
            parsed.manpowerPlans.forEach((mp: { employeeId?: number }) => {
              const clean = mp.employeeId;
              if (clean) assignedNames.add(clean);
            });
          }
        } catch {
          // ignore
        }
      });

    const availableBiz = bizEmps.filter((e) => !assignedNames.has(e.id) && e.status !== '휴직' && e.status !== '퇴사');
    return {
      totalBiz: bizEmps.length,
      availableBizCount: availableBiz.length,
    };
  }, [employees, projects, approvals]);

  // 대시보드 하단: 수행 중인 프로젝트만 필터링하여 조회
  const executingProjects = useMemo(() => {
    return projects.filter(
      (prj) => normalizeProjectStatus(prj.status) === '프로젝트 수행'
    );
  }, [projects]);

  return (
    <div className="space-y-4">
      {/* 대시보드 메인 탭: 사업 현황 대시보드 vs 주요 일정 캘린더 */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setDashboardTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition ${
              dashboardTab === 'overview'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>사업 현황 종합 대시보드</span>
          </button>
          <button
            onClick={() => setDashboardTab('calendar')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition ${
              dashboardTab === 'calendar'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>주요 일정 캘린더 (달력)</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2 hidden sm:block">
          {dashboardTab === 'overview'
            ? `${currentYear}년도 전사 사업목표 및 프로젝트 파이프라인`
            : '전사 창립기념일 · 임직원 휴가/근태 · 프로젝트 마일스톤'}
        </div>
      </div>

      {/* 탭 1: 주요 일정 캘린더 */}
      {dashboardTab === 'calendar' && (
        <CompanyScheduleCalendar
          currentUser={currentUser}
          employees={employees}
          projects={projects}
          approvals={approvals}
          holidays={holidays}
        />
      )}

      {/* 탭 2: 기존 사업 현황 종합 대시보드 */}
      {dashboardTab === 'overview' && (
        <>
          {/* 1. 상단 통합 요약 카드: 4대 핵심 KPI + 연간 목표 달성 프로그레스 바 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1) 올해 사업목표 */}
          <div
            onClick={() => onNavigateTab('projects')}
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-white hover:border-indigo-300 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500">{currentYear} 사업목표 (매출)</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900">
              {formatCurrencyManwon(targetRevenue)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>공공SI · GIS 플랫폼</span>
              <span className="text-indigo-600 font-semibold">사업관리 →</span>
            </div>
          </div>

          {/* 2) 현재 확정 달성율 */}
          <div
            onClick={() => onNavigateTab('projects')}
            className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/40 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-emerald-800">올해 달성율 (확정)</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-emerald-600 font-mono">
                {currentAchievementRate}%
              </span>
              <span className="text-xs font-bold text-emerald-700">
                ({formatCurrencyManwon(confirmedRevenue)})
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>올해 귀속·지분율 반영</span>
              <span className="text-emerald-700 font-semibold">과제수행 →</span>
            </div>
          </div>

          {/* 3) 연간 예상 달성율 */}
          <div
            onClick={() => onNavigateTab('projects')}
            className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/40 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-indigo-800">올해 예상 달성율 (파이프라인)</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-indigo-600 font-mono">
                {estimatedAchievementRate}%
              </span>
              <span className="text-xs font-bold text-indigo-700">
                ({formatCurrencyManwon(estimatedRevenue)})
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>발주·제안 가중치 반영</span>
              <span className="text-indigo-600 font-semibold">발주·제안 →</span>
            </div>
          </div>

          {/* 4) 사업본부 가용인원 */}
          <div
            onClick={() => onNavigateTab('employees')}
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-white hover:border-slate-300 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500">사업본부 가용인원</span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-800 group-hover:text-white transition">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900">
              {bizAvailability.availableBizCount}명
              <span className="text-xs font-medium text-slate-400 ml-1.5">
                / 사업본부 {bizAvailability.totalBiz}명
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>미투입 가용 인력</span>
              <span className="text-indigo-600 font-semibold">조직도 보기 →</span>
            </div>
          </div>
        </div>

        {/* 하단 통합 달성율 프로그레스 바 */}
        <div className="mt-3.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <div className="flex items-center gap-3 text-slate-700 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                올해 확정 매출(당사 지분): <strong>{formatCurrencyManwon(confirmedRevenue)} ({currentAchievementRate}%)</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                올해 예상 총매출: <strong>{formatCurrencyManwon(estimatedRevenue)} ({estimatedAchievementRate}%)</strong>
              </span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">
              연간 목표: {formatCurrencyManwon(targetRevenue)} (100%)
            </span>
          </div>

          <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="absolute top-0 bottom-0 left-0 bg-indigo-300/70 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(estimatedAchievementRate, 100)}%` }}
            />
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(currentAchievementRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. 프로젝트 4단계 라이프사이클 파이프라인 */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3.5 shadow-2xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>프로젝트 4단계 진행 현황</span>
          </div>
          <button
            onClick={() => onNavigateTab('projects')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            프로젝트 관리 바로가기 →
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div
            onClick={() => onNavigateTab('projects')}
            className="px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50 transition cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-amber-900">1. 발주예상</div>
              <div className="text-[11px] text-amber-700">사전규격·공고 대기</div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-200/80 text-amber-900">
              {stageCounts.orderExpected}건
            </span>
          </div>

          <div
            onClick={() => onNavigateTab('projects')}
            className="px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 transition cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-blue-900">2. 제안준비중</div>
              <div className="text-[11px] text-blue-700">제안서·계약품의 작성</div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-200/80 text-blue-900">
              {stageCounts.proposalPrep}건
            </span>
          </div>

          <div
            onClick={() => onNavigateTab('projects')}
            className="px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 transition cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-indigo-900">3. 프로젝트 수행</div>
              <div className="text-[11px] text-indigo-700">계약체결 및 구축·운영</div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-200/80 text-indigo-900">
              {stageCounts.executing}건
            </span>
          </div>

          <div
            onClick={() => onNavigateTab('projects')}
            className="px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition cursor-pointer flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-emerald-900">4. 완료</div>
              <div className="text-[11px] text-emerald-700">최종 검수 및 정산완료</div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-200/80 text-emerald-900">
              {stageCounts.completed}건
            </span>
          </div>
        </div>
      </div>

      {/* 3. 주요 프로젝트 진행 현황 (전체 너비 2열 컴팩트 그리드 - 한 화면에 전체 표시) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              수행 중인 프로젝트 진행 현황
            </h2>
            <span className="text-xs text-slate-400">
              (총 {executingProjects.length}건)
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('projects')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            전체 과제 상세 보기 →
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {executingProjects.map((prj) => {
            const normStatus = normalizeProjectStatus(prj.status);
            const scope = getProjectYearlyScope(prj, currentYear);

            const statusBadgeClass =
              normStatus === '완료'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : normStatus === '프로젝트 수행'
                ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                : normStatus === '제안준비중'
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : 'bg-amber-100 text-amber-800 border-amber-200';

            const progressBarClass =
              normStatus === '완료'
                ? 'bg-emerald-500'
                : normStatus === '프로젝트 수행'
                ? 'bg-indigo-600'
                : 'bg-blue-500';

            return (
              <div
                key={prj.id}
                onClick={() => onNavigateTab('projects')}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-indigo-200 transition cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                      {prj.code}
                    </span>
                    <span className="font-bold text-xs md:text-sm text-slate-900 truncate">
                      {prj.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {scope.isMultiYear && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        연차사업 ({currentYear}년)
                      </span>
                    )}
                    {scope.shareRate < 100 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        지분 {scope.shareRate}%
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusBadgeClass}`}
                    >
                      {normStatus}
                    </span>
                  </div>
                </div>

                {/* 기간 및 지분율 기반 올해 매출 표시 */}
                <div className="flex items-start justify-between text-[11px] text-slate-500 mb-2.5 flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span>PM: <strong className="text-slate-800">{prj.pm_name}</strong></span>
                      <span className="text-slate-300">·</span>
                      {scope.isMultiYear ? (
                        <span className="text-indigo-950 font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-600" />
                          올해 기간: {scope.yearStartDate} ~ {scope.yearEndDate} ({scope.yearMonths}개월)
                        </span>
                      ) : (
                        <span>기간: {prj.start_date} ~ {prj.end_date}</span>
                      )}
                    </div>
                    {scope.isMultiYear && (
                      <div className="text-[10px] text-slate-400 pl-0.5">
                        전체 수행기간: {scope.fullStartDate} ~ {scope.fullEndDate}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-xs">
                      {scope.isMultiYear ? (
                        <span>
                          올해 당사:{' '}
                          <strong className="text-indigo-700 text-sm font-black">
                            {formatCurrencyManwon(scope.yearOurRevenue)}
                          </strong>
                        </span>
                      ) : scope.shareRate < 100 ? (
                        <span>
                          당사:{' '}
                          <strong className="text-indigo-700 font-bold">
                            {formatCurrencyManwon(scope.yearOurRevenue)}
                          </strong>
                        </span>
                      ) : (
                        <span>{formatCurrencyManwon(scope.totalBudget)}</span>
                      )}
                    </div>
                    {scope.isMultiYear ? (
                      scope.shareRate < 100 ? (
                        <div className="text-[10px] text-slate-500">
                          (올해 {formatCurrencyManwon(scope.yearTotalBudget)} × 지분 {scope.shareRate}%)
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">
                          (총 {formatCurrencyManwon(scope.totalBudget)} 중 올해분)
                        </div>
                      )
                    ) : (
                      scope.shareRate < 100 && (
                        <div className="text-[10px] text-slate-500">
                          (총 {formatCurrencyManwon(scope.totalBudget)} × 지분 {scope.shareRate}%)
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progressBarClass}`}
                      style={{ width: `${prj.progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 w-9 text-right font-mono">
                    {prj.progress}%
                  </span>
                </div>
              </div>
            );
          })}

          {executingProjects.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs font-medium">
              현재 수행 중인 프로젝트가 없습니다.
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
