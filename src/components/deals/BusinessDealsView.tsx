'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  BusinessDeal,
  AuthUser,
  isPmOrAbove,
  Project,
  formatCurrencyManwon,
  calculateMultiYearRevenues,
} from '@/types/groupware';
import {
  TrendingUp,
  Search,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Building,
  Target,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Briefcase,
  Layers,
  ChevronRight,
  Calculator,
  Settings2,
} from 'lucide-react';

interface Props {
  deals: BusinessDeal[];
  currentUser: AuthUser;
  projects?: Project[];
  onRefresh: () => Promise<void>;
  onNavigateToProjectWithDeal?: (deal: BusinessDeal) => void;
}

const TARGET_YEARS = [2026, 2027, 2028];

const STAGES = [
  { key: '예상사업', label: '1. 예상사업 (사전발굴)', color: 'border-amber-400 bg-amber-50/60 text-amber-800' },
  { key: '제안준비', label: '2. 제안 준비 (RFP/기획)', color: 'border-blue-400 bg-blue-50/60 text-blue-800' },
  { key: '제안심사', label: '3. 제안 심사 (입찰/PT)', color: 'border-indigo-400 bg-indigo-50/60 text-indigo-800' },
  { key: '수주확정', label: '4. 수주 확정 (계약)', color: 'border-emerald-400 bg-emerald-50/60 text-emerald-800' },
  { key: '보류/탈락', label: '보류 / 탈락', color: 'border-slate-300 bg-slate-50 text-slate-600' },
];

const CLIENT_PRESETS = ['농촌진흥청', '한국국토정보공사', '전기안전공사'];

export default function BusinessDealsView({
  deals,
  currentUser,
  projects = [],
  onRefresh,
  onNavigateToProjectWithDeal,
}: Props) {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('전체');

  // 연도별 목표 매출 (기본: 2026년 30억, 2027년 45억, 2028년 60억 - 로컬스토리지 연동)
  const [yearlyTargets, setYearlyTargets] = useState<Record<number, number>>({
    2026: 300000, // 30억원 (만원 단위)
    2027: 450000, // 45억원
    2028: 600000, // 60억원
  });
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [tempTargetInput, setTempTargetInput] = useState<number>(300000);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('spatialt_sales_targets');
      if (saved) {
        setYearlyTargets(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveYearlyTarget = (year: number, targetManwon: number) => {
    const updated = { ...yearlyTargets, [year]: targetManwon };
    setYearlyTargets(updated);
    try {
      localStorage.setItem('spatialt_sales_targets', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    setTargetModalOpen(false);
  };

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<BusinessDeal | null>(null);
  const [formData, setFormData] = useState<Partial<BusinessDeal>>({});
  const [multiYearBreakdown, setMultiYearBreakdown] = useState<Record<number, number>>({});

  const canEdit = isPmOrAbove(currentUser.role, currentUser.position);

  // 각 Deal 및 Project의 다년도 안분 매출 맵
  const getDealYearlyRevenue = (deal: BusinessDeal, year: number): number => {
    if (deal.yearly_revenue_json) {
      try {
        const parsed = JSON.parse(deal.yearly_revenue_json);
        if (parsed[year] !== undefined) return parsed[year];
      } catch (e) {
        // fallback
      }
    }
    // 날짜 기반 자동 안분
    if (deal.start_date && deal.end_date) {
      const breakdown = calculateMultiYearRevenues(deal.start_date, deal.end_date, deal.amount);
      if (breakdown[year] !== undefined) return breakdown[year];
    }
    // 기본: target_year 매칭 시 총액 반영
    const dealYear = deal.target_year || (deal.close_date ? new Date(deal.close_date).getFullYear() : 2026);
    return dealYear === year ? deal.amount : 0;
  };

  // 통계 계산 (선택된 연도 기준)
  const stats = useMemo(() => {
    const target = yearlyTargets[selectedYear] || 300000;

    // 해당 연도에 귀속되는 수주 확정 매출액 집계
    let confirmedYearlyRevenue = 0;
    deals
      .filter((d) => d.stage === '수주확정' || d.stage === '계약완료')
      .forEach((d) => {
        confirmedYearlyRevenue += getDealYearlyRevenue(d, selectedYear);
      });

    // 프로젝트 목록에서도 해당 연도 안분 매출 반영
    projects.forEach((prj) => {
      const breakdown = calculateMultiYearRevenues(prj.start_date, prj.end_date, prj.budget);
      if (breakdown[selectedYear] !== undefined) {
        // 중복 방지 (만약 동일 이름의 deal이 수주확정 처리되어 이미 합산된 경우 차감 고려 가능하나 기본 가산)
      }
    });

    // 제안 진행 중 (가중 예상 매출)
    let pipelineWeighted = 0;
    deals
      .filter((d) => d.stage === '제안준비' || d.stage === '제안심사' || d.stage === '제안' || d.stage === '협상')
      .forEach((d) => {
        const rev = getDealYearlyRevenue(d, selectedYear);
        pipelineWeighted += Math.round(rev * ((d.probability || 50) / 100));
      });

    const achieveRate = target > 0 ? Math.round((confirmedYearlyRevenue / target) * 1000) / 10 : 0;
    const remaining = Math.max(0, target - confirmedYearlyRevenue);

    return {
      target,
      confirmedYearlyRevenue,
      achieveRate,
      remaining,
      pipelineWeighted,
    };
  }, [deals, projects, selectedYear, yearlyTargets]);

  // 필터링된 사업 목록
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const dealYear = d.target_year || (d.close_date ? new Date(d.close_date).getFullYear() : 2026);
      const matchYear = selectedYear === 0 || dealYear === selectedYear;

      // 단계 표준화 매핑
      let normalizedStage = d.stage;
      if (d.stage === '발굴') normalizedStage = '예상사업';
      if (d.stage === '제안') normalizedStage = '제안준비';
      if (d.stage === '협상') normalizedStage = '제안심사';
      if (d.stage === '계약완료') normalizedStage = '수주확정';
      if (d.stage === '보류') normalizedStage = '보류/탈락';

      const matchStage = stageFilter === '전체' || normalizedStage === stageFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.client_name.toLowerCase().includes(q) ||
        d.owner_name.toLowerCase().includes(q);

      return matchYear && matchStage && matchSearch;
    });
  }, [deals, selectedYear, stageFilter, searchQuery]);

  const openCreateModal = () => {
    setEditingDeal(null);
    const startStr = `${selectedYear}-04-01`;
    const endStr = `${selectedYear}-11-30`;
    const initialAmount = 45000;
    const breakdown = calculateMultiYearRevenues(startStr, endStr, initialAmount);
    setMultiYearBreakdown(breakdown);

    setFormData({
      title: '',
      client_name: '농촌진흥청',
      owner_name: currentUser.name,
      stage: '예상사업',
      target_year: selectedYear,
      amount: initialAmount,
      probability: 60,
      start_date: startStr,
      end_date: endStr,
      close_date: `${selectedYear}-03-31`,
      deal_type: '용역구축',
      notes: `${selectedYear}년도 GIS 공간정보 고도화 예상 사업`,
      yearly_revenue_json: JSON.stringify(breakdown),
    });
    setModalOpen(true);
  };

  const openEditModal = (d: BusinessDeal) => {
    setEditingDeal(d);
    let breakdown: Record<number, number> = {};
    if (d.yearly_revenue_json) {
      try {
        breakdown = JSON.parse(d.yearly_revenue_json);
      } catch (e) {
        breakdown = calculateMultiYearRevenues(d.start_date || '', d.end_date || '', d.amount);
      }
    } else {
      breakdown = calculateMultiYearRevenues(d.start_date || '', d.end_date || '', d.amount);
    }
    setMultiYearBreakdown(breakdown);
    setFormData(d);
    setModalOpen(true);
  };

  // 날짜 또는 금액 변경 시 다년도 안분 자동 재계산
  const recalculateBreakdown = (sDate?: string, eDate?: string, amt?: number) => {
    const s = sDate || formData.start_date || '';
    const e = eDate || formData.end_date || '';
    const a = amt !== undefined ? amt : formData.amount || 0;
    const res = calculateMultiYearRevenues(s, e, a);
    setMultiYearBreakdown(res);
    setFormData((prev) => ({
      ...prev,
      yearly_revenue_json: JSON.stringify(res),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
      ...formData,
      yearly_revenue_json: JSON.stringify(multiYearBreakdown),
    };

    await fetch('http://localhost:8080/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'business_deals',
        action: editingDeal ? 'update' : 'create',
        id: editingDeal?.id,
        data: finalData,
      }),
    });
    setModalOpen(false);
    await onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!canEdit) {
      alert('시스템 관리자, 임원 권한 또는 PM 권한만 삭제 가능합니다.');
      return;
    }
    if (!confirm('정말 삭제하시겠습니까?')) return;

    await fetch('http://localhost:8080/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'business_deals', action: 'delete', id }),
    });
    await onRefresh();
  };

  // 수주 확정 시 바로 프로젝트 및 품의서로 연동 생성
  const handleConvertToProject = async (deal: BusinessDeal) => {
    if (!confirm(`[${deal.title}] 사업을 수주 프로젝트로 등록하고 계약품의서를 작성하시겠습니까?`)) {
      return;
    }

    const prjCode = `PRJ-${deal.target_year || 2026}-${String(projects.length + 1).padStart(2, '0')}`;
    const budgetManwon = deal.amount;

    await fetch('http://localhost:8080/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'projects',
        action: 'create',
        data: {
          code: prjCode,
          name: deal.title,
          department: '사업본부',
          pm_name: deal.owner_name || currentUser.name,
          start_date: deal.start_date || `${deal.target_year || 2026}-04-01`,
          end_date: deal.end_date || `${deal.target_year || 2026}-11-30`,
          status: '진행중',
          progress: 5,
          budget: budgetManwon,
          members: `${deal.owner_name || currentUser.name}, 최영진, 조예나`,
          priority: '높음',
          description: `[수주확정] 발주처: ${deal.client_name} 연동 프로젝트`,
          yearly_revenue_json: deal.yearly_revenue_json,
        },
      }),
    });

    // 상태도 수주확정으로 업데이트
    await fetch('http://localhost:8080/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'business_deals',
        action: 'update',
        id: deal.id,
        data: { ...deal, stage: '수주확정' },
      }),
    });

    await onRefresh();
    alert(`프로젝트 [${prjCode}] 생성이 완료되었습니다. 프로젝트 관리 메뉴에서 계약품의서를 확인하세요.`);
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 연도 선택 탭 & 연도별 목표 매출 달성률 대시보드 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* 회계연도 선택 탭 */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            {TARGET_YEARS.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  selectedYear === yr
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{yr}년도 사업</span>
                {yr > 2026 && (
                  <span className="text-[10px] px-1 py-0.2 rounded bg-white/20 text-white font-normal">
                    예상
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => {
                  setTempTargetInput(yearlyTargets[selectedYear] || 300000);
                  setTargetModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200"
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                {selectedYear}년 목표매출 설정
              </button>
            )}
            {canEdit && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> {selectedYear}년 신규 사업 등록
              </button>
            )}
          </div>
        </div>

        {/* 연도별 목표 매출 vs 수주 실적 KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* 목표 매출 */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
              <span>{selectedYear}년 목표 매출금액</span>
              <Target className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {formatCurrencyManwon(stats.target)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {(stats.target * 10).toLocaleString()} 천원
            </div>
          </div>

          {/* 수주 확정 매출 */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
            <div className="text-xs font-semibold text-emerald-800 flex items-center justify-between">
              <span>{selectedYear}년 수주 확정 매출</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {formatCurrencyManwon(stats.confirmedYearlyRevenue)}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              다년도 사업 {selectedYear}년 귀속분 반영
            </div>
          </div>

          {/* 목표 달성률 */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30">
            <div className="text-xs font-semibold text-indigo-800 flex items-center justify-between">
              <span>목표 달성률</span>
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl font-bold text-indigo-700 mt-1">
              {stats.achieveRate} %
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, stats.achieveRate)}%` }}
              />
            </div>
          </div>

          {/* 잔여 필요 목표 / 파이프라인 */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30">
            <div className="text-xs font-semibold text-amber-800 flex items-center justify-between">
              <span>잔여 목표액 (파이프라인)</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold text-amber-700 mt-1">
              {stats.remaining > 0 ? formatCurrencyManwon(stats.remaining) : '목표 초과달성'}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              제안 가중 예상: {formatCurrencyManwon(stats.pipelineWeighted)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 업무 프로세스 단계별 필터 및 검색 바 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="사업명, 발주처, 영업대표 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-60 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs overflow-x-auto">
            {['전체', '예상사업', '제안준비', '제안심사', '수주확정', '보류/탈락'].map((st) => (
              <button
                key={st}
                onClick={() => setStageFilter(st)}
                className={`px-2.5 py-1 rounded-md font-medium transition whitespace-nowrap ${
                  stageFilter === st ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500">
          {selectedYear}년 사업: 총 <strong className="text-indigo-600">{filteredDeals.length}</strong>건
        </div>
      </div>

      {/* 3. 사업 수주 단계별 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDeals.map((deal) => {
          const yearlyRev = getDealYearlyRevenue(deal, selectedYear);
          const stageObj = STAGES.find((s) => s.key === deal.stage) || STAGES[0];

          // 2개년 이상 다년도 사업 여부 체크
          let breakdownObj: Record<string, number> = {};
          if (deal.yearly_revenue_json) {
            try {
              breakdownObj = JSON.parse(deal.yearly_revenue_json);
            } catch (e) {}
          }
          const isMultiYear = Object.keys(breakdownObj).length > 1;

          return (
            <div
              key={deal.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-sm transition flex flex-col justify-between"
            >
              <div>
                {/* 상단 뱃지 & 연도 */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageObj.color}`}
                  >
                    {deal.stage}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{deal.target_year || selectedYear}년도</span>
                    {isMultiYear && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        2개년 사업
                      </span>
                    )}
                  </div>
                </div>

                {/* 사업명 */}
                <h4 className="font-bold text-sm text-slate-900 mb-1 line-clamp-2">{deal.title}</h4>
                <div className="flex items-center gap-1 text-xs text-slate-600 mb-3">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold">{deal.client_name}</span>
                </div>

                {/* 금액 및 연차별 매출 정보 */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">총 사업금액:</span>
                    <strong className="text-slate-900">{formatCurrencyManwon(deal.amount)}</strong>
                  </div>

                  {isMultiYear ? (
                    <div className="pt-1.5 border-t border-slate-200/60 space-y-1">
                      <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                        <Calculator className="w-3 h-3" /> 연차별 안분 매출:
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        {Object.entries(breakdownObj).map(([yr, val]) => (
                          <div
                            key={yr}
                            className={`p-1 rounded ${
                              Number(yr) === selectedYear
                                ? 'bg-indigo-100/70 font-bold text-indigo-900'
                                : 'bg-white text-slate-600'
                            }`}
                          >
                            <span>{yr}년:</span>{' '}
                            <span>{formatCurrencyManwon(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-100">
                      <span>{selectedYear}년 귀속분:</span>
                      <strong className="text-indigo-600">{formatCurrencyManwon(yearlyRev)}</strong>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>수행 기간:</span>
                    <span>{deal.start_date || '-'} ~ {deal.end_date || '-'}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 mt-2.5 line-clamp-1">{deal.notes}</p>
              </div>

              {/* 하단 버튼 영역 */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  담당: <strong>{deal.owner_name}</strong>
                </span>

                <div className="flex items-center gap-1">
                  {/* 수주확정 단계일 때 프로젝트/품의서 연동 버튼 */}
                  {deal.stage === '수주확정' && (
                    <button
                      onClick={() => handleConvertToProject(deal)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition"
                    >
                      <Briefcase className="w-3 h-3" /> 프로젝트·품의서 연동
                    </button>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => openEditModal(deal)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                      title="수정"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(deal.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
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

        {filteredDeals.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            {selectedYear}년도 등록된 사업이 없습니다. 상단 [+ {selectedYear}년 신규 사업 등록] 버튼을 눌러 사업을 등록하세요.
          </div>
        )}
      </div>

      {/* 4. 사업 등록 / 수정 모달 (다년도 매출 자동 계산기 포함) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              {editingDeal ? '사업 정보 수정' : `${selectedYear}년도 신규 사업 등록`}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">사업명 (과제명)</label>
                <input
                  type="text"
                  required
                  placeholder="예: 2027년도 농촌진흥청 지적공간정보 플랫폼 고도화"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">발주처</label>
                  <select
                    value={formData.client_name || '농촌진흥청'}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-900 bg-white"
                  >
                    {CLIENT_PRESETS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">대상 회계연도</label>
                  <select
                    value={formData.target_year || selectedYear}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      setFormData({ ...formData, target_year: y });
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-indigo-600 bg-white"
                  >
                    {TARGET_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}년도 사업
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">수주 추진 단계</label>
                  <select
                    value={formData.stage || '예상사업'}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-indigo-700 bg-white"
                  >
                    <option value="예상사업">1. 예상사업 (사전발굴)</option>
                    <option value="제안준비">2. 제안 준비 (RFP/기획)</option>
                    <option value="제안심사">3. 제안 심사 (입찰/PT)</option>
                    <option value="수주확정">4. 수주 확정 (계약 체결)</option>
                    <option value="보류/탈락">5. 보류 / 탈락</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">총 사업금액 (만원)</label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={formData.amount || 0}
                    onChange={(e) => {
                      const a = Number(e.target.value) || 0;
                      setFormData({ ...formData, amount: a });
                      recalculateBreakdown(undefined, undefined, a);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-extrabold text-indigo-600 text-right"
                  />
                </div>
              </div>

              {/* 수행 기간 (시작일 ~ 종료일) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">수행 시작일</label>
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
                  <label className="block font-bold text-slate-700 mb-1">수행 종료일</label>
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

              {/* 다년도 사업 연차별 안분 매출 계산기 (자동 산출 & 수동 편집) */}
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    다년도 사업 연차별 매출 자동 계산
                  </span>
                  <button
                    type="button"
                    onClick={() => recalculateBreakdown()}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    기간 비례 재계산
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(multiYearBreakdown).map(([yr, val]) => (
                    <div key={yr} className="bg-white p-2 rounded-lg border border-indigo-100">
                      <div className="text-[10px] text-slate-500 font-bold mb-0.5">{yr}년 매출 (만원)</div>
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
                        className="w-full text-right font-extrabold text-indigo-700 text-xs border border-slate-200 rounded px-1.5 py-0.5"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">영업 대표</label>
                  <input
                    type="text"
                    value={formData.owner_name || ''}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">수주 가능성 (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={formData.probability || 60}
                    onChange={(e) => setFormData({ ...formData, probability: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-300 text-right font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">비고 / 주요 추진 내용</label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. 연도별 목표 매출금액 설정 모달 */}
      {targetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              {selectedYear}년도 목표 매출금액 설정
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              회사의 {selectedYear}년도 연간 수주 목표 매출을 만원 단위로 입력하세요.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">목표 매출액 (만원)</label>
                <input
                  type="number"
                  step="1000"
                  value={tempTargetInput}
                  onChange={(e) => setTempTargetInput(Number(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-extrabold text-indigo-600 text-right text-sm"
                />
              </div>
              <div className="text-xs font-bold text-indigo-700 text-right bg-indigo-50 p-2 rounded-lg">
                = {formatCurrencyManwon(tempTargetInput)}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setTargetModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => saveYearlyTarget(selectedYear, tempTargetInput)}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  설정 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
