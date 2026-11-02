'use client';
import { monthlyAllocations } from '@/lib/calendar';

import React, { useState, useMemo } from 'react';
import {
  Employee,
  Approval,
  Project,
  AuthUser,
  DEPARTMENT_CODES,
  cleanDeptName,
} from '@/types/groupware';
import { buildDefaultFullContractDoc } from '@/components/contract/ContractDashboard';
import {
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Search,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Briefcase,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

interface Props {
  employees: Employee[];
  approvals: Approval[];
  projects: Project[];
  currentUser: AuthUser;
}

interface ProjectAssignment {
  approvalId: number;
  docNo: string;
  projectName: string;
  client: string;
  role: string;
  grade: string;
  monthlyMM: number[]; // 12 months (indices 0 to 11)
  totalMM: number;
  unitPrice: number;
  laborCost: number;
}

interface EmployeeWorkload {
  emp: Employee;
  assignments: ProjectAssignment[];
  monthlyTotalMM: number[]; // 12 months sum
  totalYearlyMM: number;
  capacityRate: number; // (totalYearlyMM / 12) * 100
  status: '과다(초과)' | '적정' | '여유' | '가용(미투입)';
  hasOverloadingMonth: boolean;
}

function normalizeDateStr(dateStr?: string, defaultDay = '01'): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{4}-\d{2}$/.test(clean)) return `${clean}-${defaultDay}`;
  return clean;
}

export default function ManpowerWorkloadView({
  employees,
  approvals,
  projects,
  currentUser,
}: Props) {
  const [targetYear, setTargetYear] = useState<number>(new Date().getFullYear());
  const [deptFilter, setDeptFilter] = useState<string>('전체');
  const [statusFilter, setStatusFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // 1. 계약품의서(Approvals) 중 실제 JSON 데이터가 저장된 계약품의서 파싱 (반려 제외)
  const parsedApprovals = useMemo(() => {
    return approvals
      .filter(
        (ap) =>
          (ap.category === '계약품의' || ap.category === '계약품의서') &&
          ap.status !== '반려' &&
          ap.items_json &&
          ap.items_json.trim().startsWith('{')
      )
      .map((ap) => {
        try {
          const fullDoc = JSON.parse(ap.items_json!) as import('@/types/groupware').FullContractDocument;
          // 연동된 프로젝트 찾기 (날짜 및 발주처 보완)
          const linkedPrj = projects.find(
            (p) =>
              (ap.project_id && p.id === ap.project_id) ||
              (fullDoc.linkedProjectId && p.id === fullDoc.linkedProjectId) ||
              (ap.project_name && p.name === ap.project_name) ||
              (fullDoc.title && p.name === fullDoc.title) ||
              (ap.title && p.name === ap.title)
          );

          const rawStart =
            fullDoc.startDate ||
            linkedPrj?.start_date ||
            ap.created_at?.slice(0, 10) ||
            `${targetYear}-01-01`;
          const rawEnd = fullDoc.endDate || linkedPrj?.end_date || rawStart;

          const startDate = normalizeDateStr(rawStart, '01');
          const endDate = normalizeDateStr(rawEnd, '28');

          return {
            ap,
            fullDoc,
            linkedPrj,
            startDate,
            endDate,
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
  }, [approvals, projects, targetYear, currentUser]);

  // 2. 직원별 연간 월별 투입공수(M/M) 매트릭스 계산 (계약품의서 반영)
  const workloads = useMemo<EmployeeWorkload[]>(() => {
    // 퇴사자는 기본 투입공수 목록에서 제외 (현재 재직자 기준)
    const activeEmployees = employees.filter((e) => e.status !== '퇴사');

    return activeEmployees.map((emp) => {
      const assignments: ProjectAssignment[] = [];
      const monthlyTotalMM = Array(12).fill(0);

      parsedApprovals.forEach((item) => {
        if (!item) return;
        const { ap, fullDoc, linkedPrj, startDate, endDate } = item;
        const plans = fullDoc.manpowerPlans || [];

        // 해당 직원의 투입 계획 찾기 (ID 매칭 우선, 이름 매칭 보완)
        const myPlans = plans.filter((p) => {
          if (p.employeeId && (p.employeeId === emp.id || Number(p.employeeId) === emp.id)) return true;
          if (p.name && emp.name && p.name.trim() === emp.name.trim()) return true;
          return false;
        });

        myPlans.forEach((plan) => {
          let planMonths = plan.months || [];
          if (planMonths.length === 0 && (plan.totalMM || 0) > 0) {
            const s = new Date(startDate);
            const e = new Date(endDate);
            const totalMonthsCount =
              !isNaN(s.getTime()) && !isNaN(e.getTime())
                ? Math.max(
                    1,
                    (e.getFullYear() - s.getFullYear()) * 12 +
                      (e.getMonth() - s.getMonth()) +
                      1
                  )
                : 1;
            const avg = Number(((plan.totalMM || 0) / totalMonthsCount).toFixed(2));
            planMonths = Array(totalMonthsCount).fill(avg);
          }

          const monthlyMM = monthlyAllocations(
            startDate,
            endDate,
            planMonths,
            targetYear
          );

          // 월별 합산 누적
          for (let m = 0; m < 12; m++) {
            monthlyTotalMM[m] += monthlyMM[m];
          }

          const totalMM = Number(monthlyMM.reduce((sum, v) => sum + v, 0).toFixed(2));

          assignments.push({
            approvalId: ap.id,
            docNo: ap.doc_no || '미발번',
            projectName: ap.project_name || fullDoc.title || linkedPrj?.name || ap.title,
            client: fullDoc.clientName || linkedPrj?.client_name || ap.vendor || '발주처',
            role: plan.role || 'GIS 개발',
            grade: plan.grade || '중급',
            monthlyMM,
            totalMM,
            unitPrice: plan.unitPrice || 0,
            laborCost: Math.round(totalMM * (plan.unitPrice || 0)),
          });
        });
      });

      const totalYearlyMM = Number(
        monthlyTotalMM.reduce((sum, v) => sum + v, 0).toFixed(2)
      );
      const capacityRate = Math.round((totalYearlyMM / 12) * 100);
      const hasOverloadingMonth = monthlyTotalMM.some((m) => m > 1.05);

      let status: '과다(초과)' | '적정' | '여유' | '가용(미투입)' = '가용(미투입)';
      if (hasOverloadingMonth || totalYearlyMM > 12.0) {
        status = '과다(초과)';
      } else if (totalYearlyMM >= 9.0) {
        status = '적정';
      } else if (totalYearlyMM > 0) {
        status = '여유';
      } else {
        status = '가용(미투입)';
      }

      return {
        emp,
        assignments,
        monthlyTotalMM: monthlyTotalMM.map((v) => Number(v.toFixed(2))),
        totalYearlyMM,
        capacityRate,
        status,
        hasOverloadingMonth,
      };
    });
  }, [employees, parsedApprovals, projects, targetYear]);

  // 필터링 적용
  const filteredWorkloads = useMemo(() => {
    return workloads.filter((w) => {
      const matchDept =
        deptFilter === '전체' ||
        cleanDeptName(w.emp.department) === cleanDeptName(deptFilter) ||
        w.emp.department_code === deptFilter;

      const matchStatus = statusFilter === '전체' || w.status === statusFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        w.emp.name.toLowerCase().includes(q) ||
        w.emp.position.toLowerCase().includes(q) ||
        w.emp.department.toLowerCase().includes(q) ||
        w.assignments.some((a) => a.projectName.toLowerCase().includes(q));

      return matchDept && matchStatus && matchSearch;
    });
  }, [workloads, deptFilter, statusFilter, searchQuery]);

  // 전사 KPI 집계
  const stats = useMemo(() => {
    const totalEmps = workloads.length;
    const totalMM = workloads.reduce((sum, w) => sum + w.totalYearlyMM, 0);
    const avgMM = totalEmps > 0 ? (totalMM / totalEmps).toFixed(1) : '0';
    const totalCapacityRate = totalEmps > 0 ? Math.round((totalMM / (totalEmps * 12)) * 100) : 0;
    const overloadingCount = workloads.filter((w) => w.status === '과다(초과)').length;
    const availableCount = workloads.filter((w) => w.status === '가용(미투입)').length;

    // 사업본부 인력만의 가용 현황
    const bizWorkloads = workloads.filter(
      (w) => cleanDeptName(w.emp.department) === '사업본부' || w.emp.department_code === 'DEPT_BIZ'
    );
    const bizTotal = bizWorkloads.length;
    const bizAvailableCount = bizWorkloads.filter((w) => w.totalYearlyMM === 0).length;

    return {
      totalEmps,
      totalMM: totalMM.toFixed(1),
      avgMM,
      totalCapacityRate,
      overloadingCount,
      availableCount,
      bizTotal,
      bizAvailableCount,
    };
  }, [workloads]);

  const toggleRow = (empId: number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [empId]: !prev[empId],
    }));
  };

  const getHeatmapColor = (mm: number) => {
    if (mm <= 0) return 'text-slate-300';
    if (mm > 1.0) return 'bg-rose-100 text-rose-900 font-extrabold border border-rose-300';
    if (mm === 1.0) return 'bg-indigo-100 text-indigo-900 font-bold border border-indigo-200';
    if (mm >= 0.5) return 'bg-blue-50 text-blue-800 font-semibold border border-blue-200';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 KPI 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">전체 관리 직원</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{stats.totalEmps}명</div>
          <div className="text-[10px] text-slate-400 mt-0.5">사업본부 {stats.bizTotal}명 포함</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
          <div className="text-[11px] font-semibold text-indigo-700">전사 총 계약 투입공수</div>
          <div className="text-xl font-extrabold text-indigo-600 mt-1">{stats.totalMM} <span className="text-xs font-normal">M/M</span></div>
          <div className="text-[10px] text-indigo-600 font-medium mt-0.5">인당 평균 {stats.avgMM} M/M</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
          <div className="text-[11px] font-semibold text-blue-700">전사 인력 가동률</div>
          <div className="text-xl font-extrabold text-blue-600 mt-1">{stats.totalCapacityRate}%</div>
          <div className="text-[10px] text-blue-600 mt-0.5 font-medium">연간 기준 (12 M/M 만점)</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-800">사업본부 가용인력</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">{stats.bizAvailableCount}명</div>
          <div className="text-[10px] text-emerald-700 font-bold mt-0.5">신규 프로젝트 즉시 투입 가능</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
          <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            초과 투입 (오버로딩)
          </div>
          <div className="text-xl font-extrabold text-rose-600 mt-1">{stats.overloadingCount}명</div>
          <div className="text-[10px] text-rose-600 mt-0.5 font-medium">월 1.0 M/M 초과 인원</div>
        </div>
      </div>

      {/* 2. 툴바 및 필터 */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* 대상 연도 선택 */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg font-bold">
            <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            {[2025, 2026, 2027, 2028].map((yr) => (
              <button
                key={yr}
                onClick={() => setTargetYear(yr)}
                className={`px-2.5 py-1 rounded transition text-xs ${
                  targetYear === yr
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {yr}년도
              </button>
            ))}
          </div>

          {/* 부서 필터 */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
          >
            <option value="전체">전체 부서</option>
            {DEPARTMENT_CODES.map((d) => (
              <option key={d.code} value={d.label}>
                {d.label}
              </option>
            ))}
          </select>

          {/* 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
          >
            <option value="전체">전체 상태</option>
            <option value="과다(초과)">과다 투입 (초과)</option>
            <option value="적정">적정 투입 (9~12 M/M)</option>
            <option value="여유">여유 공수 (1~8 M/M)</option>
            <option value="가용(미투입)">가용 인력 (0 M/M)</option>
          </select>

          {/* 검색창 */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="성명, 직급, 참여 프로젝트 검색..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 w-52 bg-white"
            />
          </div>
        </div>

        {/* 범례 표시 */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-100 border border-indigo-300 inline-block" />
            <span>1.0 M/M (전일 투입)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-100 border border-rose-300 inline-block" />
            <span>&gt;1.0 M/M (동시 투입 주의)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-50 border border-blue-200 inline-block" />
            <span>부분 투입</span>
          </div>
        </div>
      </div>

      {/* 3. 직원별 연간 투입공수 매트릭스 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-bold">
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span>{targetYear}년도 계약품의서 기준 직원별 월별 투입공수 현황판</span>
            <span className="text-[11px] font-normal text-slate-400 ml-1">
              (조회: {filteredWorkloads.length}명)
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            * 직원을 클릭하면 참여 중인 계약품의서별 세부 M/M 내역이 펼쳐집니다.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-3 text-left w-28">성명 / 직급</th>
                <th className="py-2.5 px-2 text-left w-24">소속 부서</th>
                <th className="py-2.5 px-2 text-left w-48">참여 프로젝트 (건수)</th>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <th key={m} className="py-2.5 px-1.5 w-11 font-mono text-[11px]">
                    {m}월
                  </th>
                ))}
                <th className="py-2.5 px-2 w-20 font-mono text-indigo-700">연간 총 M/M</th>
                <th className="py-2.5 px-2 w-20">가동률</th>
                <th className="py-2.5 px-2 w-24">투입 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredWorkloads.map((w) => {
                const isExpanded = !!expandedRows[w.emp.id];
                const isMyAccount = currentUser.name === w.emp.name;

                return (
                  <React.Fragment key={w.emp.id}>
                    {/* 메인 직원 요약 행 */}
                    <tr
                      onClick={() => toggleRow(w.emp.id)}
                      className={`cursor-pointer transition hover:bg-slate-50/80 ${
                        isMyAccount ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      {/* 성명 / 직급 */}
                      <td className="py-2 px-3 text-left font-bold whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="text-slate-900">{w.emp.name}</span>
                          <span className="text-[11px] font-normal text-slate-500">
                            {w.emp.position}
                          </span>
                          {isMyAccount && (
                            <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-indigo-600 text-white">
                              나
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 소속 부서 */}
                      <td className="py-2 px-2 text-left font-medium text-slate-600 whitespace-nowrap">
                        {cleanDeptName(w.emp.department)}
                      </td>

                      {/* 참여 프로젝트 요약 */}
                      <td className="py-2 px-2 text-left text-[11px] text-slate-600 truncate max-w-xs" title={w.assignments.map(a => a.projectName).join(', ')}>
                        {w.assignments.length > 0 ? (
                          <div className="flex items-center gap-1 truncate">
                            <Briefcase className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate">
                              {w.assignments[0].projectName}
                            </span>
                            {w.assignments.length > 1 && (
                              <span className="text-[10px] text-indigo-600 font-bold shrink-0">
                                +{w.assignments.length - 1}건
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">미투입</span>
                        )}
                      </td>

                      {/* 1월 ~ 12월 히트맵 셀 */}
                      {w.monthlyTotalMM.map((mm, mIdx) => (
                        <td key={mIdx} className="py-1 px-1 font-mono text-[11px]">
                          <span
                            className={`inline-block w-8 py-0.5 rounded text-center transition ${getHeatmapColor(
                              mm
                            )}`}
                          >
                            {mm > 0 ? mm.toFixed(1) : '-'}
                          </span>
                        </td>
                      ))}

                      {/* 연간 총 M/M */}
                      <td className="py-2 px-2 font-mono font-bold text-indigo-700 text-xs">
                        {w.totalYearlyMM.toFixed(1)} M/M
                      </td>

                      {/* 가동률 */}
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-center gap-1 font-mono font-bold text-xs">
                          <span
                            className={
                              w.capacityRate > 100
                                ? 'text-rose-600'
                                : w.capacityRate >= 75
                                ? 'text-indigo-600'
                                : w.capacityRate > 0
                                ? 'text-blue-600'
                                : 'text-slate-400'
                            }
                          >
                            {w.capacityRate}%
                          </span>
                        </div>
                      </td>

                      {/* 투입 상태 배지 */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        {w.status === '과다(초과)' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            초과 투입
                          </span>
                        )}
                        {w.status === '적정' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            적정 가동
                          </span>
                        )}
                        {w.status === '여유' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            여유 공수
                          </span>
                        )}
                        {w.status === '가용(미투입)' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            가용 (미투입)
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 펼쳐졌을 때: 계약품의서별 세부 M/M 드릴다운 행 */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={19} className="p-3 text-left">
                          <div className="pl-6 border-l-2 border-indigo-400 space-y-2">
                            <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{w.emp.name} {w.emp.position} 참여 계약품의서 세부 투입 내역 ({w.assignments.length}건)</span>
                            </div>

                            {w.assignments.length === 0 ? (
                              <div className="text-xs text-slate-400 py-2">
                                현재 등록된 계약품의서 투입 내역이 없습니다. (신규 프로젝트 즉시 투입 가능)
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {w.assignments.map((asg, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white p-2 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                        {asg.docNo}
                                      </span>
                                      <span className="font-bold text-slate-900 truncate">
                                        {asg.projectName}
                                      </span>
                                      <span className="text-slate-400">|</span>
                                      <span className="text-slate-600 font-medium">
                                        역할: <strong className="text-indigo-600">{asg.role}</strong> ({asg.grade})
                                      </span>
                                      <span className="text-slate-400">|</span>
                                      <span className="text-slate-500 font-mono text-[11px]">
                                        발주처: {asg.client}
                                      </span>
                                    </div>

                                    {/* 개별 프로젝트 12개월 M/M 히트맵 */}
                                    <div className="flex items-center gap-1 mt-1 sm:mt-0">
                                      {asg.monthlyMM.map((mVal, mIdx) => (
                                        <div
                                          key={mIdx}
                                          className="text-center font-mono text-[10px]"
                                          title={`${mIdx + 1}월: ${mVal} M/M`}
                                        >
                                          <div className="text-[9px] text-slate-400">{mIdx + 1}월</div>
                                          <span
                                            className={`inline-block w-6 py-0.2 rounded ${
                                              mVal > 0
                                                ? 'bg-indigo-600 text-white font-bold'
                                                : 'text-slate-300'
                                            }`}
                                          >
                                            {mVal > 0 ? mVal.toFixed(1) : '-'}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="ml-3 pl-3 border-l border-slate-200 text-right">
                                        <div className="text-[9px] text-slate-400">소계</div>
                                        <div className="font-mono font-bold text-indigo-700 text-xs">
                                          {asg.totalMM.toFixed(1)} M/M
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredWorkloads.length === 0 && (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-slate-400 text-xs">
                    검색 조건에 일치하는 직원의 투입공수 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

