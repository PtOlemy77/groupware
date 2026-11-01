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
  formatCurrencyManwon,
  getMultiYearRevenueForYear,
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
} from 'lucide-react';

interface Props {
  currentUser: AuthUser;
  employees: Employee[];
  projects: Project[];
  equipments: Equipment[];
  deals: BusinessDeal[];
  evaluations: Evaluation[];
  approvals: Approval[];
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
  employees,
  projects,
  deals,
  approvals,
  onNavigateTab,
}: Props) {
  const currentYear = new Date().getFullYear();

  // 1. 기준정보 관리에서 연동되는 연도별 전사 사업 목표매출 (기본값: 2026년 25억원 = 250,000만원)
  const [targetRevenue, setTargetRevenue] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = readMaster('spatialt_master_target_revenues');
        if (saved) {
          const parsed = JSON.parse(saved);
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
        const saved = readMaster('spatialt_master_target_revenues');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed[currentYear]?.targetAmount) {
            setTargetRevenue(Number(parsed[currentYear].targetAmount));
          } else if (typeof parsed[currentYear] === 'number') {
            setTargetRevenue(Number(parsed[currentYear]));
          }
        }
      } catch (e) {}
    };

    window.addEventListener('target-revenues-updated', loadTargetRevenue);
    window.addEventListener('storage', loadTargetRevenue);
    return () => {
      window.removeEventListener('target-revenues-updated', loadTargetRevenue);
      window.removeEventListener('storage', loadTargetRevenue);
    };
  }, [currentYear]);

  // 2. 프로젝트/사업 상태별 집계 및 2026년 귀속 매출 계산
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

    deals.forEach((d) => {
      if (d.converted_project_id) return;
      const start = d.start_date || d.close_date, end = d.end_date || d.close_date;
      if (currentYear < new Date(start).getFullYear() || currentYear > new Date(end).getFullYear()) return;
      const revenue = calculateMultiYearRevenues(start, end, d.amount)[currentYear] ?? 0;
      if (d.stage === '계약완료' || d.stage === '수주확정') {
        confirmed += revenue;
      } else {
        pipelineWeighted += Math.round(revenue * (d.probability / 100));
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
  }, [projects, deals, targetRevenue]);

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

  return (
    <div className="space-y-4">
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
              <span className="text-xs font-bold text-emerald-800">현재 달성율 (확정)</span>
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
              <span>수행·완료 확정액 기준</span>
              <span className="text-emerald-700 font-semibold">과제수행 →</span>
            </div>
          </div>

          {/* 3) 연간 예상 달성율 */}
          <div
            onClick={() => onNavigateTab('projects')}
            className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/40 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-indigo-800">예상 달성율 (파이프라인)</span>
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
                확정 매출: <strong>{formatCurrencyManwon(confirmedRevenue)} ({currentAchievementRate}%)</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                예상 총매출: <strong>{formatCurrencyManwon(estimatedRevenue)} ({estimatedAchievementRate}%)</strong>
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
              주요 프로젝트 진행 현황
            </h2>
            <span className="text-xs text-slate-400">
              (총 {projects.length}건)
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
          {projects.map((prj) => {
            const normStatus = normalizeProjectStatus(prj.status);
            const yearRev = getMultiYearRevenueForYear(prj, currentYear);

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
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                      {prj.code}
                    </span>
                    <span className="font-bold text-xs md:text-sm text-slate-900 truncate">
                      {prj.name}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClass}`}
                  >
                    {normStatus}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2 flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <span>
                      PM: <strong className="text-slate-700">{prj.pm_name}</strong> · {prj.start_date} ~ {prj.end_date}
                    </span>
                    {getProjectShareRate(prj) < 100 && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                        컨소 {getProjectShareRate(prj)}%
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-800">
                      당사: {formatCurrencyManwon(yearRev)}
                    </span>
                    {getProjectShareRate(prj) < 100 && (
                      <span className="text-[10px] text-slate-400 ml-1">
                        (총 {formatCurrencyManwon(prj.budget)})
                      </span>
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
        </div>
      </div>
    </div>
  );
}
