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
  Coins,
  ArrowUpRight,
  PieChart,
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

  // 3. 프로젝트별 계약품의서 연동 순손익 및 마진율 집계
  const projectProfits = useMemo(() => {
    let totalNetProfitThousand = 0; // 천원 단위 누적
    let totalSupplyThousand = 0;    // 천원 단위 누적
    let contractedProjectCount = 0;

    const profitMap = new Map<
      number,
      {
        hasContract: boolean;
        supplyAmount: number; // 천원
        totalBudget: number;  // 천원
        netProfit: number;    // 천원
        profitRate: number;   // %
        netProfitManwon: number; // 만원
      }
    >();

    projects.forEach((prj) => {
      // 해당 프로젝트에 연결된 계약품의서 찾기
      const linkedAp = approvals.find((a) => {
        if (a.category !== '계약품의' && a.category !== '계약품의서') return false;
        if (a.project_id === prj.id) return true;
        if (a.project_name === prj.name || a.title === prj.name) return true;
        if (a.items_json && a.items_json.startsWith('{')) {
          try {
            const parsed = JSON.parse(a.items_json);
            if (
              parsed.linkedProjectId === prj.id ||
              (prj.code && parsed.linkedProjectCode === prj.code) ||
              parsed.title === prj.name
            ) {
              return true;
            }
          } catch {
            // ignore
          }
        }
        return false;
      });

      if (linkedAp && linkedAp.items_json && linkedAp.items_json.startsWith('{')) {
        try {
          const parsed = JSON.parse(linkedAp.items_json);
          const supply = Number(parsed.supplyAmount) || 0;
          const budget = Number(parsed.totalBudget) || 0;
          const net =
            parsed.projectNetProfit !== undefined
              ? Number(parsed.projectNetProfit)
              : supply - budget;
          const rate =
            parsed.profitRate !== undefined
              ? Number(parsed.profitRate)
              : supply > 0
              ? Math.round((net / supply) * 10000) / 100
              : 0;

          profitMap.set(prj.id, {
            hasContract: true,
            supplyAmount: supply,
            totalBudget: budget,
            netProfit: net,
            profitRate: rate,
            netProfitManwon: Math.round(net / 10),
          });

          // 수행 또는 완료 프로젝트의 손익을 전사 누적으로 합산
          const status = normalizeProjectStatus(prj.status);
          if (status === '프로젝트 수행' || status === '완료') {
            totalNetProfitThousand += net;
            totalSupplyThousand += supply;
            contractedProjectCount += 1;
          }
          return;
        } catch {
          // ignore
        }
      }

      // 계약품의서가 없는 경우 기본값
      profitMap.set(prj.id, {
        hasContract: false,
        supplyAmount: 0,
        totalBudget: 0,
        netProfit: 0,
        profitRate: 0,
        netProfitManwon: 0,
      });
    });

    const totalNetProfitManwon = Math.round(totalNetProfitThousand / 10);
    const overallProfitRate =
      totalSupplyThousand > 0
        ? Number(((totalNetProfitThousand / totalSupplyThousand) * 100).toFixed(1))
        : 0;

    return {
      profitMap,
      totalNetProfitManwon,
      overallProfitRate,
      contractedProjectCount,
    };
  }, [projects, approvals]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1) 올해 사업목표 */}
          <div
            onClick={() => onNavigateTab('projects')}
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600">{currentYear}년 전사 사업목표</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Target className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                {formatCurrencyManwon(targetRevenue)}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>기준정보 매출목표</span>
              <span className="text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform">사업관리 →</span>
            </div>
          </div>

          {/* 2) 올해 확정 매출 및 목표 달성율 (핵심 강조 디자인) */}
          <div
            onClick={() => onNavigateTab('projects')}
            className="p-3.5 rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/60 to-teal-50/30 hover:border-emerald-400 hover:shadow-xs transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-900">올해 확정 매출 · 달성율</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  currentAchievementRate >= 100
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : currentAchievementRate >= 70
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-white text-emerald-700 border-emerald-300'
                }`}>
                  {currentAchievementRate >= 100 ? '목표 달성' : `${currentAchievementRate}% 달성`}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-black text-emerald-700 font-mono tracking-tight">
                  {currentAchievementRate}%
                </span>
              </div>
              <div className="text-xs font-bold text-emerald-950 mt-1">
                확정 매출: <span className="font-mono">{formatCurrencyManwon(confirmedRevenue)}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-emerald-200/70 flex items-center justify-between text-[11px] text-emerald-800">
              <span>수행·완료 당사 귀속</span>
              <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform">과제수행 →</span>
            </div>
          </div>

          {/* 3) 연간 예상 총매출 (파이프라인) */}
          <div
            onClick={() => onNavigateTab('projects')}
            className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/50 transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-900">연간 예상 매출 (파이프라인)</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-700 font-mono">
                  {estimatedAchievementRate}%
                </span>
                <span className="text-xs font-bold text-indigo-900">
                  ({formatCurrencyManwon(estimatedRevenue)})
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-indigo-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>발주·제안 가중치 반영</span>
              <span className="text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform">발주·제안 →</span>
            </div>
          </div>

          {/* 4) 사용자 요청: 인력관리 대신 프로젝트 순손익 배치! */}
          <div
            onClick={() => onNavigateTab('projects')}
            className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-purple-300 transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">프로젝트 순 손익 (품의서)</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black font-mono tracking-tight ${
                  projectProfits.totalNetProfitManwon >= 0 ? 'text-purple-700' : 'text-rose-600'
                }`}>
                  {projectProfits.totalNetProfitManwon >= 0 ? '+' : ''}
                  {formatCurrencyManwon(projectProfits.totalNetProfitManwon)}
                </span>
              </div>
              <div className="text-[11px] font-bold text-purple-900 mt-1">
                평균 순이익률: <span className="font-mono text-purple-700">{projectProfits.overallProfitRate}%</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>품의 연동 {projectProfits.contractedProjectCount}건 합산</span>
              <span className="text-purple-700 font-semibold group-hover:translate-x-0.5 transition-transform">손익 상세 →</span>
            </div>
          </div>
        </div>

        {/* 하단 통합 달성율 프로그레스 바 (달성율 시인성 대폭 강화) */}
        <div className="mt-3.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <div className="flex items-center gap-3 text-slate-700 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-2xs" />
                올해 확정 매출(당사): <strong className="text-emerald-800 font-black">{formatCurrencyManwon(confirmedRevenue)}</strong> <span className="font-mono text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">({currentAchievementRate}%)</span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                올해 예상 총매출: <strong className="text-indigo-900 font-bold">{formatCurrencyManwon(estimatedRevenue)}</strong> <span className="font-mono text-indigo-700 font-bold">({estimatedAchievementRate}%)</span>
              </span>
            </div>
            <span className="text-slate-600 font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
              전사 목표: {formatCurrencyManwon(targetRevenue)}
            </span>
          </div>

          <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5">
            <div
              className="absolute top-0 bottom-0 left-0 bg-indigo-300/80 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(estimatedAchievementRate, 100)}%` }}
            />
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 rounded-full transition-all duration-700 shadow-2xs"
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

            const profitInfo = projectProfits.profitMap.get(prj.id);
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
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {profitInfo?.hasContract && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          profitInfo.netProfitManwon >= 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                        title={`계약품의서 공급가: ${formatCurrencyManwon(Math.round(profitInfo.supplyAmount / 10))} / 총예산: ${formatCurrencyManwon(Math.round(profitInfo.totalBudget / 10))}`}
                      >
                        순손익 {profitInfo.netProfitManwon >= 0 ? `+${formatCurrencyManwon(profitInfo.netProfitManwon)}` : formatCurrencyManwon(profitInfo.netProfitManwon)} ({profitInfo.profitRate}%)
                      </span>
                    )}
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
