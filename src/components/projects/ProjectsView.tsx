'use client';
import { unitPrice } from '@/lib/api';

import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';

import React, { useState, useMemo } from 'react';
import {
  Project,
  ProjectStageCode,
  PROJECT_STAGE_CODES,
  AuthUser,
  isPmOrAbove,
  isExecutiveOrAbove,
  Approval,
  Employee,
  BusinessDeal,
  formatCurrencyManwon,
  calculateMultiYearRevenues,
  getMultiYearRevenueForYear,
  getProjectShareRate,
  getProjectOurBudget,
  CommonCode,
} from '@/types/groupware';
import ContractWorkstationModal from '@/components/contract/ContractWorkstationModal';
import ManpowerWorkloadView from '@/components/projects/ManpowerWorkloadView';
import WeeklyMonthlyReportView from '@/components/projects/WeeklyMonthlyReportView';
import { buildDefaultFullContractDoc } from '@/components/contract/ContractDashboard';
import { normalizeProjectStatus } from '@/components/dashboard/DashboardView';
import {
  Briefcase,
  Search,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  User,
  Users,
  LayoutGrid,
  Kanban,
  FileSpreadsheet,
  FileText,
  Calculator,
  ArrowRight,
  TrendingUp,
  Sparkles,
  ExternalLink,
  Clock,
  Layers,
  Building2,
} from 'lucide-react';
import {
  Button,
  TabGroup,
  PageHeaderBar,
  SearchInput,
} from '@/components/common';

interface Props {
  projects: Project[];
  currentUser: AuthUser;
  approvals?: Approval[];
  employees?: Employee[];
  deals?: BusinessDeal[];
  commonCodes?: CommonCode[];
  onRefresh: () => Promise<void>;
  onNavigateToReports?: (projectId?: number) => void;
}

export const PROJECT_STAGES = ['발주예상', '제안준비중', '프로젝트 수행', '완료'] as const;
export type ProjectStage = typeof PROJECT_STAGES[number];

// 수행기간 대비 현재 일자 기준 진행률 자동 산출
export function calcPeriodProgress(startDate?: string, endDate?: string, status?: string): number {
  if (status === '완료') return 100;
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate).getTime();
  const e = new Date(endDate).getTime();
  if (isNaN(s) || isNaN(e) || s >= e) return 0;
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - s) / (e - s)) * 100)));
}

export default function ProjectsView({
  projects,
  currentUser,
  approvals = [],
  employees = [],
  deals = [],
  commonCodes = [],
  onRefresh,
  onNavigateToReports,
}: Props) {
  // 서브탭: 'list' (프로젝트 수행 관리) | 'reports' (주간/월간 보고) | 'manpower' (직원별 연간 투입공수)
  const [subTab, setSubTab] = useState<'list' | 'reports' | 'manpower'>('list');
  const [reportTargetProjectId, setReportTargetProjectId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('프로젝트 수행');
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');

  // DB(common_codes)에서 프로젝트 단계 목록 동적 조회 (DB 우선)
  const projectStages = useMemo(() => {
    const fromDb = (commonCodes || [])
      .filter((c) => c.group_code === 'PROJECT_STAGE' && c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => c.code_name as ProjectStage);
    return fromDb.length > 0 ? fromDb : (Array.from(PROJECT_STAGES) as ProjectStage[]);
  }, [commonCodes]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrj, setEditingPrj] = useState<Project | null>(null);
  const [formData, setFormData] = useState<Partial<Project>>({});
  const [multiYearBreakdown, setMultiYearBreakdown] = useState<Record<number, number>>({});

  // 프로젝트 카드/모달에서 직접 계약품의서 모달 열기용 상태 (DB Approval 레코드와 1:1 매핑)
  const [workstationDoc, setWorkstationDoc] = useState<any | null>(null);
  const [workstationApproval, setWorkstationApproval] = useState<Approval | null>(null);

  const { showAlert, showConfirm } = useModal();

  // PM 권한 이상(시스템 관리자, 임원 권한, PM 권한) 프로젝트 등록/수정 가능
  const canEdit = isPmOrAbove(currentUser);
  const canDelete = isExecutiveOrAbove(currentUser);

  // 정규화된 상태로 프로젝트 필터링
  const filteredProjects = useMemo(() => {
    return projects.filter((prj) => {
      const normStatus = normalizeProjectStatus(prj.status);
      const matchStatus = statusFilter === '전체' || normStatus === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        prj.name.toLowerCase().includes(q) ||
        prj.code.toLowerCase().includes(q) ||
        prj.pm_name.toLowerCase().includes(q) ||
        prj.department.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [projects, statusFilter, searchQuery]);

  // 각 단계별 건수 집계
  const stageCounts = useMemo(() => {
    const map: Record<ProjectStage, number> = {
      발주예상: 0,
      제안준비중: 0,
      '프로젝트 수행': 0,
      완료: 0,
    };
    projects.forEach((p) => {
      const stage = normalizeProjectStatus(p.status);
      map[stage] = (map[stage] || 0) + 1;
    });
    return map;
  }, [projects]);

  // PM 직군 후보 목록: 재직 중인 PM 이상 권한자만 선별
  const pmCandidates = useMemo(() => {
    return employees
      .filter((emp) => (isPmOrAbove(emp) && emp.status === '재직') || emp.id === formData.pm_id)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [employees, formData.pm_id]);

  const openCreateModal = () => {
    setEditingPrj(null);
    const startStr = new Date().toLocaleDateString('en-CA');
    const endStr = `${new Date().getFullYear()}-12-31`;
    const initialBudget = 0;
    const breakdown = calculateMultiYearRevenues(startStr, endStr, initialBudget);
    setMultiYearBreakdown(breakdown);

    setFormData({
      code: '',
      name: '',
      department: '사업본부',
      pm_id: currentUser.id,
      member_ids: [],
      pm_name: currentUser.name,
      start_date: startStr,
      end_date: endStr,
      status: '프로젝트 수행',
      progress: 10,
      budget: initialBudget,
      share_rate: 100,
      our_budget: initialBudget,
      is_consortium: false,
      consortium_partners: '',
      members: '',
      priority: '높음',
      description: '',
      yearly_revenue_json: JSON.stringify(breakdown),
    });
    setModalOpen(true);
  };

  const openEditModal = (prj: Project) => {
    setEditingPrj(prj);
    let breakdown: Record<number, number> = {};
    if (prj.yearly_revenue_json) {
      try {
        breakdown = JSON.parse(prj.yearly_revenue_json);
      } catch (e) {
        breakdown = calculateMultiYearRevenues(prj.start_date, prj.end_date, prj.budget);
      }
    } else {
      breakdown = calculateMultiYearRevenues(prj.start_date, prj.end_date, prj.budget);
    }
    setMultiYearBreakdown(breakdown);
    setFormData({
      ...prj,
      status: normalizeProjectStatus(prj.status),
      share_rate: getProjectShareRate(prj),
      our_budget: getProjectOurBudget(prj),
      is_consortium: prj.is_consortium ?? (getProjectShareRate(prj) < 100),
      consortium_partners: prj.consortium_partners || '',
    });
    setModalOpen(true);
  };

  const recalculateBreakdown = (sDate?: string, eDate?: string, bgt?: number) => {
    const s = sDate || formData.start_date || '';
    const e = eDate || formData.end_date || '';
    const b = bgt !== undefined ? bgt : formData.budget || 0;
    const res = calculateMultiYearRevenues(s, e, b);
    setMultiYearBreakdown(res);
    setFormData((prev) => ({
      ...prev,
      yearly_revenue_json: JSON.stringify(res),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const shareRate =
      typeof formData.share_rate === 'number' && !isNaN(formData.share_rate)
        ? formData.share_rate
        : 100;
    const totalBudget = Number(formData.budget) || 0;
    const ourBudget = Math.round(totalBudget * (shareRate / 100));

    const stageObj = PROJECT_STAGE_CODES.find(
      (s) => s.code === formData.status_code || s.label === formData.status
    );

    const resolvedStatus = stageObj?.label || formData.status || '프로젝트 수행';
    const autoProgress = calcPeriodProgress(formData.start_date, formData.end_date, resolvedStatus);

    const finalPmId = formData.pm_id ? Number(formData.pm_id) : null;
    const finalPmName = finalPmId ? (formData.pm_name || '') : '';

    const finalData = {
      ...formData,
      pm_id: finalPmId,
      pm_name: finalPmName,
      department_code: 'DEPT_BIZ',
      department: '사업본부', // 프로젝트는 항상 사업본부 전담
      status_code: stageObj?.code || 'STAGE_EXEC',
      status: resolvedStatus,
      progress: autoProgress,
      budget: totalBudget,
      share_rate: shareRate,
      our_budget: ourBudget,
      is_consortium: shareRate < 100,
      consortium_partners: formData.consortium_partners || '',
      yearly_revenue_json: JSON.stringify(multiYearBreakdown),
    };

    try {
      await apiFetch('/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'projects',
          action: editingPrj ? 'update' : 'create',
          id: editingPrj?.id,
          version: editingPrj?.version,
          data: finalData,
        }),
      });

      setModalOpen(false);
      await onRefresh();
      await showAlert(
        editingPrj
          ? `[${finalData.name}] 프로젝트 정보가 수정되었습니다.`
          : `[${finalData.name}] 프로젝트가 등록되었습니다.`,
        { type: 'success' }
      );
    } catch (err: any) {
      await showAlert(err?.message || '프로젝트 저장에 실패했습니다.', { type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDelete) {
      await showAlert('프로젝트 삭제는 시스템 관리자 또는 임원 권한(이사급 이상)만 가능합니다.', {
        type: 'warning',
      });
      return;
    }
    const confirmed = await showConfirm(
      '프로젝트를 삭제하시겠습니까? 연결된 결재·보고 이력이 있으면 삭제할 수 없습니다.',
      { isDanger: true, confirmText: '삭제' }
    );
    if (!confirmed) return;

    await apiFetch('/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'projects', action: 'delete', id }),
    });

    await onRefresh();
    await showAlert('프로젝트가 삭제되었습니다.', { type: 'success' });
  };

  // 프로젝트와 연결된 DB 계약품의서(Approval) 찾기
  const findLinkedApproval = (prj: Project): Approval | undefined => {
    return approvals.find((a) => {
      if (a.category !== '계약품의' && a.category !== '계약품의서') return false;
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
        } catch (e) {}
      }
      return false;
    });
  };

  // 직급별 기본 기술등급 및 표준 단가 매핑 헬퍼
  const getGradeAndPriceByPosition = (pos: string, isPm: boolean, year = new Date().getFullYear()) => ({
    grade: (['사장','이사','부장'].includes(pos) ? '특급' : ['차장','과장'].includes(pos) ? '고급' : pos === '대리' ? '중급' : '초급') as '특급' | '고급' | '중급' | '초급',
    unitPrice: unitPrice(pos, year), role: isPm ? '총괄 PM' : '개발',
  });

  // 특정 프로젝트의 계약품의서 열기 (더미데이터가 아닌 실제 DB 저장 데이터 또는 해당 프로젝트 실제 소속 인력으로 생성)
  const handleOpenContractForProject = async (prj: Project) => {
    let matchedAp = findLinkedApproval(prj);
    if (matchedAp?.id) matchedAp = await (await apiFetch(`/api/groupware/approvals/${matchedAp.id}`)).json();
    const hasSavedJson = !!(
      matchedAp &&
      matchedAp.items_json &&
      matchedAp.items_json.trim().startsWith('{')
    );

    const doc = buildDefaultFullContractDoc(matchedAp, currentUser, approvals.length);
    doc.linkedProjectId = prj.id;
    doc.linkedProjectCode = prj.code;
    // 발주기관, 사업명, 금액, 수행기간 연동
    if (prj.client_name) {
      doc.clientName = prj.client_name;
    } else if (matchedAp?.vendor) {
      doc.clientName = matchedAp.vendor;
    }
    if (!hasSavedJson) {
      doc.title = prj.name;
      doc.startDate = prj.start_date;
      doc.endDate = prj.end_date;
    }

    // DB에 저장된 계약품의서 JSON이 아직 없는 경우: 프로젝트의 실제 소속 직원(pm_name, members)으로 투입인력 시트 구성
    if (!hasSavedJson) {
      const startD = prj.start_date ? new Date(prj.start_date) : new Date(`${new Date().getFullYear()}-01-01`);
      const endD = prj.end_date ? new Date(prj.end_date) : new Date(`${new Date().getFullYear()}-12-31`);
      const diffMonths = Math.max(
        1,
        Math.min(
          120,
          (endD.getFullYear() - startD.getFullYear()) * 12 +
            (endD.getMonth() - startD.getMonth()) +
            1
        )
      );

      doc.contractPeriod = `${prj.start_date.replaceAll('-', '.')} ~ ${prj.end_date.replaceAll('-', '.')} (${diffMonths}개월)`;
      const shareRate = getProjectShareRate(prj);
      const ourBudget = getProjectOurBudget(prj);
      doc.ourShareRate = shareRate;
      doc.supplyAmount = ourBudget * 10; // 당사 지분율(%) 반영 공급가액 (천원)
      doc.vatAmount = Math.round(doc.supplyAmount * 0.1);

      const rawNames = [...new Set([prj.pm_id, ...(prj.member_ids || [])].filter(Boolean))].map(id => employees.find(e => e.id === id)).filter((e): e is Employee => !!e);

      const realPlans = rawNames.map((empObj, idx) => {
        const empName = empObj.name;
        const pos = empObj ? empObj.position : idx === 0 ? '부장' : '대리';
        const isPm = empName === prj.pm_name || idx === 0;
        const { grade, unitPrice, role } = getGradeAndPriceByPosition(pos, isPm, new Date(prj.start_date).getFullYear());
        const monthsArr: number[] = Array(Math.max(1, diffMonths)).fill(1);
        const totalMM = monthsArr.length;

        return {
          id: `m_${idx + 1}`,
          employeeId: empObj.id,
          type: '당사' as const,
          grade,
          role,
          name: empName,
          position: pos,
          months: monthsArr,
          totalMM,
          unitPrice,
          laborCost: totalMM * unitPrice,
        };
      });

      if (realPlans.length > 0) {
        doc.manpowerPlans = realPlans;
        doc.laborCostTotal = realPlans.reduce((s, p) => s + p.laborCost, 0);
        doc.totalBudget =
          doc.productCostTotal +
          doc.laborCostTotal +
          doc.outsourcingTotal +
          doc.directExpenseTotal;
        doc.salesProfit = doc.supplyAmount - doc.totalBudget;
        doc.contingencyCost =
          Math.round(doc.totalBudget * (doc.contingencyRate / 100) * 10) / 10;
        doc.projectNetProfit = doc.salesProfit - doc.contingencyCost;
        doc.profitRate =
          doc.supplyAmount > 0
            ? Math.round((doc.projectNetProfit / doc.supplyAmount) * 10000) / 100
            : 0;
      }
    }

    setWorkstationApproval(matchedAp || null);
    setWorkstationDoc(doc);
  };

  return (
    <div className="space-y-6">
      {/* 1. 공통 상단 서브탭 네비게이션: 프로젝트 수행 관리 / 직원별 연간 투입공수 / 주간·월간 보고 바로가기 */}
      <PageHeaderBar
        left={
          <div className="flex items-center gap-2 flex-wrap">
            <TabGroup
              items={[
                {
                  key: 'list',
                  label: '프로젝트 수행 관리',
                  count: projects.length,
                  icon: <Briefcase className="w-4 h-4" />,
                },
                {
                  key: 'manpower',
                  label: '직원별 연간 투입공수 (M/M)',
                  count: `${employees.length}명`,
                  icon: <Users className="w-4 h-4" />,
                },
                ...(!onNavigateToReports
                  ? [
                      {
                        key: 'reports',
                        label: '주간/월간 보고',
                        icon: <FileText className="w-4 h-4" />,
                      },
                    ]
                  : []),
              ]}
              activeKey={subTab}
              onChange={(key) => {
                if (key === 'reports') setReportTargetProjectId(null);
                setSubTab(key as any);
              }}
              variant="pills"
              size="sm"
            />

            {onNavigateToReports && (
              <Button
                variant="outline"
                size="sm"
                icon={<FileText className="w-4 h-4 text-indigo-600" />}
                onClick={() => onNavigateToReports()}
                title="독립된 주간/월간 보고 메뉴로 이동"
              >
                주간/월간 보고 메뉴 바로가기 →
              </Button>
            )}
          </div>
        }
        right={
          <div className="text-[11px] text-slate-500 hidden lg:flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>사업본부 전담 프로젝트 파이프라인 (발주예상 → 제안준비중 → 프로젝트 수행)</span>
          </div>
        }
      />

      {/* 2-A. 서브탭: 주간/월간 보고 (PM 금주/차주 작성 → 이사 취합/보완 → 사장님 보고) */}
      {subTab === 'reports' && (
        <WeeklyMonthlyReportView
          employees={employees}
          projects={projects}
          approvals={approvals}
          currentUser={currentUser}
          initialSelectedProjectId={reportTargetProjectId}
          onRefresh={onRefresh}
        />
      )}

      {/* 2-B. 서브탭: 직원별 연간 투입공수 (M/M) */}
      {subTab === 'manpower' && (
        <ManpowerWorkloadView
          employees={employees}
          approvals={approvals}
          projects={projects}
          currentUser={currentUser}
        />
      )}

      {/* 3. 서브탭: 사업·프로젝트 통합 관리 (목록 및 칸반) */}
      {subTab === 'list' && (
        <div className="space-y-6">
          {/* 사업관리 4단계 상태 필터 배너 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {projectStages.map((st) => {
              const count = stageCounts[st];
              const isSelected = statusFilter === st;
              const borderBg =
                st === '발주예상'
                  ? isSelected
                    ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-300'
                    : 'border-amber-200 bg-amber-50/40 hover:bg-amber-50 text-amber-900'
                  : st === '제안준비중'
                  ? isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-950 font-bold ring-2 ring-blue-300'
                    : 'border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-blue-900'
                  : st === '프로젝트 수행'
                  ? isSelected
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-950 font-bold ring-2 ring-indigo-300'
                    : 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-900'
                  : isSelected
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-300'
                  : 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-900';

              return (
                <div
                  key={st}
                  onClick={() => setStatusFilter(statusFilter === st ? '전체' : st)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer shadow-2xs ${borderBg}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{st}</span>
                    <span className="text-xs font-black font-mono px-2 py-0.5 rounded-full bg-white shadow-2xs">
                      {count}건
                    </span>
                  </div>
                  <div className="text-[11px] opacity-75 mt-1 truncate">
                    {st === '발주예상' && '예산 반영 / 공고 대기'}
                    {st === '제안준비중' && '제안서 작성 / 입찰 진행'}
                    {st === '프로젝트 수행' && '계약 체결 / 과제 수행'}
                    {st === '완료' && '최종 검수완료 / 종결'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 공통 검색 및 뷰모드 툴바 */}
          <PageHeaderBar
            left={
              <>
                <SearchInput
                  placeholder="프로젝트명, 과제코드, PM 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                  className="w-64"
                />

                {/* 상태 필터 버튼 그룹 */}
                <TabGroup
                  items={(['전체', '발주예상', '제안준비중', '프로젝트 수행', '완료'] as const).map((st) => ({
                    key: st,
                    label: st,
                  }))}
                  activeKey={statusFilter}
                  onChange={(st) => setStatusFilter(st as any)}
                  variant="segmented"
                  size="sm"
                />

                {/* 뷰 모드 토글 (그리드 / 칸반) */}
                <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-100 ml-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'grid' ? 'bg-white shadow-2xs text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="그리드 카드 뷰"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'kanban' ? 'bg-white shadow-2xs text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="칸반 보드 뷰"
                  >
                    <Kanban className="w-4 h-4" />
                  </button>
                </div>
              </>
            }
            right={
              canEdit ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={openCreateModal}
                >
                  신규 프로젝트 등록
                </Button>
              ) : undefined
            }
          />

          {/* 1) 그리드 카드 뷰 (화면에 9개(3×3)가 시원하게 보이도록 컴팩트 최적화) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredProjects.map((prj) => {
                const normStatus = normalizeProjectStatus(prj.status);
                let breakdownObj: Record<string, number> = {};
                if (prj.yearly_revenue_json) {
                  try {
                    breakdownObj = JSON.parse(prj.yearly_revenue_json);
                  } catch (e) {}
                }
                const isMultiYear = Object.keys(breakdownObj).length > 1;
                const periodProgress = calcPeriodProgress(prj.start_date, prj.end_date, normStatus);

                const statusBadgeStyle =
                  normStatus === '발주예상'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : normStatus === '제안준비중'
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : normStatus === '프로젝트 수행'
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200';

                return (
                  <div
                    key={prj.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
                  >
                    <div>
                      {/* 1. 발주기관 및 상태 뱃지 (프로젝트 코드는 제거) */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-900 truncate">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{prj.client_name || '발주기관 미지정'}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {getProjectShareRate(prj) < 100 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              컨소시엄 {getProjectShareRate(prj)}%
                            </span>
                          )}
                          {isMultiYear && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              다년도
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadgeStyle}`}
                          >
                            {normStatus}
                          </span>
                        </div>
                      </div>

                      {/* 2. 프로젝트명 (사업명) */}
                      <h4
                        onClick={() => openEditModal(prj)}
                        className="font-extrabold text-[15px] text-slate-900 mb-2 line-clamp-1 group-hover:text-indigo-600 cursor-pointer transition"
                        title={prj.name}
                      >
                        {prj.name}
                      </h4>

                      {/* 3. 총괄 PM 강조 박스 */}
                      <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-slate-50 border border-slate-100 mb-2.5 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <User className="w-3.5 h-3.5 text-indigo-600" />
                          <span>총괄 PM: <strong className="text-indigo-950 font-black">{prj.pm_name || '미배정'}</strong></span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">사업본부</span>
                      </div>

                      {/* 4. 부가 속성 (예산, 수행기간, 기간 기준 진행율) */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>{isMultiYear ? `올해(${new Date().getFullYear()}년) 매출` : '사업 예산'}</span>
                          <div className="text-right">
                            {isMultiYear ? (
                              <div>
                                <span className="font-black text-indigo-700 text-sm">
                                  {formatCurrencyManwon(getMultiYearRevenueForYear(prj, new Date().getFullYear()))}
                                </span>
                                <span className="text-[10px] text-slate-400 block font-normal">
                                  (총 {formatCurrencyManwon(prj.budget)}
                                  {getProjectShareRate(prj) < 100 ? ` / 당사지분 ${getProjectShareRate(prj)}%` : ''})
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-extrabold text-slate-900">
                                  {formatCurrencyManwon(prj.budget)}
                                </span>
                                {getProjectShareRate(prj) < 100 && (
                                  <span className="text-[11px] font-bold text-indigo-700 ml-1.5">
                                    (당사: {formatCurrencyManwon(getProjectOurBudget(prj))})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-slate-500">
                          <span>수행 기간</span>
                          <span className="font-semibold text-slate-700">
                            {prj.start_date} ~ {prj.end_date}
                          </span>
                        </div>

                        {/* 진척률 (기간에 따라 현재 일자로 자동 계산) */}
                        <div className="pt-1">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-500 font-medium">진척률 (기간 자동 산출)</span>
                            <span className="font-bold text-indigo-600">{periodProgress}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                normStatus === '완료'
                                  ? 'bg-emerald-500'
                                  : normStatus === '프로젝트 수행'
                                  ? 'bg-indigo-600'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${periodProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 카드 하단 액션 버튼 */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* 제안준비중 단계부터 계약품의서(제안 견적 및 원가계산) 작성 가능 */}
                        <button
                          onClick={() => handleOpenContractForProject(prj)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                            normStatus === '제안준비중'
                              ? 'bg-blue-100/80 text-blue-800 hover:bg-blue-600 hover:text-white border border-blue-200'
                              : normStatus === '발주예상'
                              ? 'bg-amber-100/70 text-amber-900 hover:bg-amber-600 hover:text-white border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200'
                          }`}
                          title={
                            normStatus === '제안준비중'
                              ? '제안서 원가 및 견적 산출을 위한 계약품의서 작성'
                              : '계약품의서 확인 및 기안'
                          }
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>
                            {normStatus === '제안준비중'
                              ? '계약품의 작성'
                              : normStatus === '발주예상'
                              ? '사전품의'
                              : '계약품의서'}
                          </span>
                        </button>

                        {/* 주간/월간 보고 작성/조회 바로가기 버튼 (종료/완료 프로젝트는 제외) */}
                        {normStatus !== '완료' && (
                          <button
                            onClick={() => {
                              if (onNavigateToReports) {
                                onNavigateToReports(prj.id);
                              } else {
                                setReportTargetProjectId(prj.id);
                                setSubTab('reports');
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white border border-slate-200 transition shadow-2xs"
                            title="해당 프로젝트의 PM 금주/차주 주간·월간보고 메뉴로 이동"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>주간/월간보고</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(prj)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50"
                          title="프로젝트 상세 및 수정"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleDelete(prj.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2) 4단계 칸반 보드 뷰 (발주예상 | 제안준비중 | 프로젝트 수행 | 완료) */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {projectStages.map((stage) => {
                const list = filteredProjects.filter(
                  (p) => normalizeProjectStatus(p.status) === stage
                );

                const headerColor =
                  stage === '발주예상'
                    ? 'border-t-4 border-amber-400 bg-amber-50/30'
                    : stage === '제안준비중'
                    ? 'border-t-4 border-blue-400 bg-blue-50/30'
                    : stage === '프로젝트 수행'
                    ? 'border-t-4 border-indigo-500 bg-indigo-50/30'
                    : 'border-t-4 border-emerald-400 bg-emerald-50/30';

                return (
                  <div
                    key={stage}
                    className={`p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between ${headerColor}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/80">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-slate-900">{stage}</h4>
                        </div>
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                          {list.length}건
                        </span>
                      </div>

                      <div className="space-y-3">
                        {list.map((prj) => (
                          <div
                            key={prj.id}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              {prj.client_name ? (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                  {prj.client_name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">발주처 미지정</span>
                              )}
                              <span className="text-[11px] font-bold text-slate-700">PM: {prj.pm_name || '미배정'}</span>
                            </div>
                            <h5
                              onClick={() => openEditModal(prj)}
                              className="font-bold text-xs text-slate-900 mb-2 line-clamp-2 hover:text-indigo-600 cursor-pointer"
                              title={prj.name}
                            >
                              {prj.name}
                            </h5>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2.5">
                              <span>예산:</span>
                              <div className="text-right">
                                <span className="font-bold text-slate-900">
                                  {formatCurrencyManwon(prj.budget)}
                                </span>
                                {getProjectShareRate(prj) < 100 && (
                                  <div className="text-[10px] text-indigo-700 font-bold">
                                    당사({getProjectShareRate(prj)}%): {formatCurrencyManwon(getProjectOurBudget(prj))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 계약품의서 확인 버튼 (제안준비중 단계부터 작성 가능) */}
                            <button
                              onClick={() => handleOpenContractForProject(prj)}
                              className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                                stage === '제안준비중'
                                  ? 'bg-blue-100/90 hover:bg-blue-600 hover:text-white text-blue-800 border border-blue-200'
                                  : stage === '발주예상'
                                  ? 'bg-amber-100/80 hover:bg-amber-600 hover:text-white text-amber-900 border border-amber-200'
                                  : 'bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700'
                              }`}
                            >
                              <FileSpreadsheet className="w-3 h-3" />
                              <span>
                                {stage === '제안준비중'
                                  ? '제안 견적·품의서 작성'
                                  : stage === '발주예상'
                                  ? '사전 견적품의 작성'
                                  : '계약품의서 확인 / 기안'}
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 프로젝트 생성/수정 상세 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
            <div className="shrink-0 flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingPrj ? '프로젝트 상세 정보 및 수정' : '신규 사업·프로젝트 등록'}
              </h3>

              {/* 편집 중인 프로젝트인 경우 바로 계약품의서를 열 수 있는 상단 링크 버튼 */}
              {editingPrj && (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenContractForProject(editingPrj);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-2xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>연계 계약품의서 열기</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 text-xs">
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {/* 1행: 주관 부서 & 사업관리 진행 단계 (프로젝트 코드는 서버에서 자동 채번) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">주관 부서</label>
                    <input
                      type="text"
                      disabled
                      value="사업본부 (전담)"
                      className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-slate-100 text-slate-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">사업관리 진행 단계</label>
                    <select
                      value={formData.status_code || (formData.status === '발주예상' ? 'STAGE_ORDER' : formData.status === '제안준비중' ? 'STAGE_PROPOSAL' : formData.status === '완료' ? 'STAGE_DONE' : 'STAGE_EXEC')}
                      onChange={(e) => {
                        const sc = PROJECT_STAGE_CODES.find((s) => s.code === e.target.value);
                        setFormData({
                          ...formData,
                          status_code: e.target.value as ProjectStageCode,
                          status: sc?.label || '프로젝트 수행',
                        });
                      }}
                      className="w-full p-2.5 rounded-xl border border-indigo-300 bg-indigo-50/20 font-bold text-indigo-900"
                    >
                      {PROJECT_STAGE_CODES.map((sc) => (
                        <option key={sc.code} value={sc.code}>
                          {sc.sort_order}. {sc.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2행: 과제명 및 발주기관 (2열 배치) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">프로젝트 과제명 (사업명)</label>
                    <input
                      type="text"
                      required
                      placeholder="예: LX 공간정보 플랫폼 유지관리 및 기능고도화 사업"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      발주기관 (고객사) <span className="text-[11px] text-indigo-600 font-normal">(계약품의서 연동)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="예: 한국국토정보공사, 농촌진흥청, 충청북도청"
                      value={formData.client_name || ''}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* 3행: 총 사업 예산 */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">총 사업 예산 (만원)</label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={formData.budget || 0}
                    onChange={(e) => {
                      const b = Number(e.target.value) || 0;
                      setFormData({ ...formData, budget: b });
                      recalculateBreakdown(undefined, undefined, b);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-extrabold text-indigo-600 text-right"
                  />
                </div>

              {/* 사업 수행 방식 및 당사 지분율 (%) */}
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" /> 사업 수행 방식 및 당사 지분율
                  </span>
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          share_rate: 100,
                          is_consortium: false,
                          consortium_partners: '',
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        (formData.share_rate ?? 100) === 100
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      단독수행 (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          share_rate:
                            formData.share_rate && formData.share_rate < 100
                              ? formData.share_rate
                              : 60,
                          is_consortium: true,
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        (formData.share_rate ?? 100) < 100
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      공동수급 (컨소시엄)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      당사 지분율 (%)
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="0.5"
                        required
                        value={formData.share_rate ?? 100}
                        onChange={(e) => {
                          const rate = Number(e.target.value) || 0;
                          setFormData({
                            ...formData,
                            share_rate: rate,
                            is_consortium: rate < 100,
                          });
                        }}
                        className="w-full p-2 rounded-lg border border-slate-300 font-bold text-right text-indigo-900 bg-white"
                      />
                      <span className="ml-2 font-bold text-slate-600 text-sm">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      당사 배정 매출액 (목표/품의 연동)
                    </label>
                    <div className="p-2 rounded-lg bg-white border border-indigo-200 text-right">
                      <span className="font-extrabold text-sm text-indigo-700">
                        {formatCurrencyManwon(
                          Math.round(
                            (Number(formData.budget) || 0) *
                              ((formData.share_rate ?? 100) / 100)
                          )
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {(formData.share_rate ?? 100) < 100 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      컨소시엄 참여 파트너사 정보
                    </label>
                    <input
                      type="text"
                      placeholder="예: 주관:(주)당사(60%), 참여:(주)한국공간정밀(40%)"
                      value={formData.consortium_partners || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, consortium_partners: e.target.value })
                      }
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    총괄 PM <span className="text-[11px] text-slate-500 font-normal">(선택 사항)</span>
                  </label>
                  <select
                    value={formData.pm_id || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setFormData({ ...formData, pm_id: null as any, pm_name: '' });
                      } else {
                        const emp = employees.find((x) => x.id === Number(val));
                        setFormData({ ...formData, pm_id: emp?.id, pm_name: emp?.name || '' });
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white"
                  >
                    <option value="">미배정 (선택 안 함)</option>
                    {pmCandidates.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.position} ({emp.department})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    과제 진행율 <span className="text-[11px] text-slate-400 font-normal">(기간 자동 계산)</span>
                  </label>
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between font-bold text-slate-800">
                    <span className="text-slate-500 text-xs">현재 진행율:</span>
                    <span className="text-indigo-600 font-black text-sm">
                      {calcPeriodProgress(formData.start_date, formData.end_date, formData.status)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 수행 기간 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">착수일</label>
                  <input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => {
                      const s = e.target.value;
                      setFormData({ ...formData, start_date: s });
                      recalculateBreakdown(s, undefined, undefined);
                    }}
                    className="w-full p-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">완료일</label>
                  <input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => {
                      const end = e.target.value;
                      setFormData({ ...formData, end_date: end });
                      recalculateBreakdown(undefined, end, undefined);
                    }}
                    className="w-full p-2 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
              </div>

              {/* 다년도 사업 연차별 안분 계산기 */}
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-indigo-950">
                      다년도 사업 연차별 매출 자동 안분
                    </span>
                    {(formData.share_rate ?? 100) < 100 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                        당사 지분율 {formData.share_rate}% 자동 반영
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => recalculateBreakdown()}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    기간 비례 재계산
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.entries(multiYearBreakdown).map(([yr, val]) => {
                    const shareRate = formData.share_rate ?? 100;
                    const ourYearRevenue = Math.round(val * (shareRate / 100));
                    return (
                      <div
                        key={yr}
                        className="bg-white p-2.5 rounded-xl border border-indigo-100/90 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                          <span>{yr}년 전체 예산</span>
                          {shareRate < 100 && (
                            <span className="text-indigo-600">지분 {shareRate}%</span>
                          )}
                        </div>
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="100"
                            value={val}
                            onChange={(e) => {
                              const updated = {
                                ...multiYearBreakdown,
                                [Number(yr)]: Number(e.target.value) || 0,
                              };
                              setMultiYearBreakdown(updated);
                            }}
                            className="w-full text-right font-bold text-slate-800 text-xs border border-slate-200 rounded px-1.5 py-0.5"
                          />
                          <span className="ml-1 text-[11px] text-slate-400 shrink-0">만원</span>
                        </div>
                        {shareRate < 100 && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                            <span className="text-slate-500 font-medium">당사 배정액:</span>
                            <span className="font-black text-indigo-700">
                              {formatCurrencyManwon(ourYearRevenue)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 전체 합계 및 당사 배정 매출 합계 요약 */}
                {Object.keys(multiYearBreakdown).length > 0 && (() => {
                  const shareRate = formData.share_rate ?? 100;
                  const totalSum = Object.values(multiYearBreakdown).reduce((a, b) => a + b, 0);
                  const ourTotalSum = Math.round(totalSum * (shareRate / 100));
                  return (
                    <div className="flex items-center justify-between pt-2 border-t border-indigo-200/60 text-xs px-1">
                      <span className="text-slate-600 font-medium">
                        연차별 총 예산 합계: <strong className="text-slate-900 font-bold">{formatCurrencyManwon(totalSum)}</strong>
                      </span>
                      {shareRate < 100 && (
                        <span className="text-indigo-900 font-bold">
                          당사 총 매출액: <strong className="text-indigo-600 font-black">{formatCurrencyManwon(ourTotalSum)}</strong>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 하단 고정 푸터: 저장/취소 버튼이 항상 보이도록 하단 고정 */}
              <div className="shrink-0 flex justify-end gap-2 pt-3 mt-2 border-t border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-sm"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 프로젝트 카드/모달에서 연 계약품의서 워크스테이션 모달 */}
      {workstationDoc && (
        <ContractWorkstationModal
          initialDoc={workstationDoc}
          approvalRecord={workstationApproval || undefined}
          isNew={!workstationApproval}
          currentUser={currentUser}
          employees={employees}
          projects={projects}
          deals={deals}
          onClose={() => {
            setWorkstationDoc(null);
            setWorkstationApproval(null);
          }}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}
