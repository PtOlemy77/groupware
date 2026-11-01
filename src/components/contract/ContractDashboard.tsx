'use client';

import React, { useState, useMemo } from 'react';
import {
  Approval,
  AuthUser,
  FullContractDocument,
  Employee,
  Project,
  BusinessDeal,
  STANDARD_UNIT_PRICES,
} from '@/types/groupware';
import ContractWorkstationModal from './ContractWorkstationModal';
import {
  FileSpreadsheet,
  Plus,
  Search,
  ExternalLink,
  Users,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface Props {
  currentUser: AuthUser;
  approvals: Approval[];
  employees?: Employee[];
  projects?: Project[];
  deals?: BusinessDeal[];
  onRefresh: () => Promise<void>;
}

const POSITION_TO_GRADE: Record<
  string,
  { grade: '특급' | '고급' | '중급' | '초급'; role: string }
> = {
  사장: { grade: '특급', role: '총괄책임' },
  이사: { grade: '특급', role: '사업총괄 PM' },
  부장: { grade: '특급', role: '수행 PM / 아키텍트' },
  과장: { grade: '고급', role: 'GIS 플랫폼 PL' },
  대리: { grade: '중급', role: '공간DB / 응용개발' },
  담당: { grade: '초급', role: 'WebGIS 프론트 / 모듈개발' },
};

export function buildDefaultFullContractDoc(
  ap?: Approval,
  currentUser?: AuthUser,
  count: number = 1
): FullContractDocument {
  if (ap && ap.items_json && ap.items_json.startsWith('{')) {
    try {
      const parsed = JSON.parse(ap.items_json);
      if (parsed.manpower_list && !parsed.manpowerPlans) {
        return {
          docNo: ap.doc_no || '',
          version: '1.0',
          title: ap.title,
          clientName: parsed.client || ap.vendor || '한국국토정보공사',
          contractPeriod: parsed.period || '2026.04.01 ~ 2026.11.30 (8개월)',
          startDate: '2026-04-01',
          endDate: '2026-11-30',
          contractType: '용역구축',
          paymentTerms: parsed.payment_terms || '현금',
          warrantyPeriod: parsed.warranty_period || '12개월',
          delayPenaltyRate: parsed.delay_penalty_rate || 0.15,
          ourShareRate: parsed.our_share || 100,

          supplyAmount: parsed.contract_amount_supply || ap.amount || 450000,
          vatAmount: parsed.contract_amount_vat || Math.round((ap.amount || 450000) * 0.1),

          productCostTotal: parsed.product_cost || 0,
          outsourcingTotal: parsed.outsourcing_cost || 0,
          laborCostTotal: parsed.internal_labor_cost || 346800,
          directExpenseTotal: parsed.direct_expense || 19270,
          estimatedAsTotal: parsed.estimated_as_cost || 0,
          proposalCostTotal: parsed.proposal_cost || 0,

          totalBudget: parsed.total_budget || 366070,
          salesProfit: (parsed.contract_amount_supply || 450000) - (parsed.total_budget || 366070),

          contingencyRate: parsed.contingency_rate || 2.0,
          contingencyCost: parsed.contingency_cost || 7321.4,
          projectNetProfit: parsed.project_profit || 76608.6,
          profitRate: parsed.profit_rate || 17.02,

          productCosts: [
            { id: 'p1', category: 'H/W 장비', itemName: '공간정보 PostGIS DB 서버', spec: '64Core / 256GB RAM', qty: 0, unitPrice: 0, amount: 0, note: '당사 보유 자산 활용' },
          ],
          manpowerPlans: (parsed.manpower_list || []).map((m: any, idx: number) => ({
            id: `m_${idx}`,
            type: m.type || '당사',
            grade: m.grade || '특급',
            role: m.role || '개발',
            name: m.name || '담당자',
            position: m.position || '과장',
            months: [1, 1, 1, 1, 1, 1, 0, 0],
            totalMM: m.mm || 6,
            unitPrice: m.unit_price || 9600,
            laborCost: m.amount || (m.mm * (m.unit_price || 9600)),
          })),
          outsourcings: [],
          directExpenses: (parsed.expense_list || []).map((e: any, idx: number) => ({
            id: `e_${idx}`,
            account: e.account || '복리/특근식대',
            qty: 1,
            unitPrice: e.amount || 1000,
            basis: e.basis || '',
            amount: e.amount || 1000,
            note: e.note || '',
          })),
          riskEvaluations: [
            { id: 'r1', category: '고객성향', question: '고객 커뮤니케이션 채널 및 요구조건 명확성', selectedLevel: '하', score: 1, exposureWeight: 2, calculatedExposure: 2 },
            { id: 'r2', category: '고객성향', question: '프로젝트 기간 및 마일스톤 적정성 (8개월)', selectedLevel: '중', score: 3, exposureWeight: 2, calculatedExposure: 6 },
            { id: 'r3', category: '기술력', question: '유사 GIS/디지털트윈 플랫폼 구축 경험', selectedLevel: '하', score: 1, exposureWeight: 3, calculatedExposure: 3 },
            { id: 'r4', category: '기술력', question: 'PostGIS / GeoServer / 3D WebGIS 기술 난이도', selectedLevel: '중', score: 3, exposureWeight: 2, calculatedExposure: 6 },
            { id: 'r5', category: '팀구성도', question: '사내 특급/고급 핵심인력 투입 비율 (70% 이상)', selectedLevel: '하', score: 1, exposureWeight: 3, calculatedExposure: 3 },
          ],
          cashflowMilestones: [
            { id: 'cf1', turnName: '선금 (30%)', milestone: '계약체결 및 착수보고', plannedDate: '2026.04.15', ratePercent: 30, supplyAmount: 135000, vatAmount: 13500, totalAmount: 148500, status: '입금완료' },
            { id: 'cf2', turnName: '1차 중도금 (40%)', milestone: '중간보고회 및 기능검수', plannedDate: '2026.08.31', ratePercent: 40, supplyAmount: 180000, vatAmount: 18000, totalAmount: 198000, status: '청구완료' },
            { id: 'cf3', turnName: '잔금 (30%)', milestone: '최종 완료보고 및 납품검수', plannedDate: '2026.11.30', ratePercent: 30, supplyAmount: 135000, vatAmount: 13500, totalAmount: 148500, status: '입금예정' },
          ],
          approvalLine: {
            drafter: { name: ap.requester, position: ap.requester_position || '부장', dept: ap.department, status: '작성완료', date: ap.created_at },
            bizHead: { name: '', position: '', status: '' },
            ceo: { name: '', position: '', status: '' },
          },
          consensusLine: {
            qm: { name: '', position: '', dept: '', status: '' },
            mgmt: { name: '', position: '', dept: '', status: '' },
            pm: { name: '', position: '', dept: '', status: '' },
          },
        };
      } else if (parsed.productCosts) {
        return parsed as FullContractDocument;
      }
    } catch (e) {
      console.error(e);
    }
  }

  const drafterName = currentUser ? currentUser.name : '우광일';
  const drafterPos = currentUser ? currentUser.position : '부장';
  const drafterDept = currentUser ? currentUser.department : '기술연구소';

  return {
    docNo: '',
    version: '1.0',
    title: '한국국토정보공사 디지털트윈 플랫폼 구축',
    clientName: '한국국토정보공사',
    contractPeriod: '2026.04.01 ~ 2026.11.30 (8개월)',
    startDate: '2026-04-01',
    endDate: '2026-11-30',
    contractType: '용역구축',
    paymentTerms: '현금',
    warrantyPeriod: '12개월',
    delayPenaltyRate: 0.15,
    ourShareRate: 100,

    supplyAmount: 450000,
    vatAmount: 45000,

    productCostTotal: 0,
    outsourcingTotal: 0,
    laborCostTotal: 346800,
    directExpenseTotal: 19270,
    estimatedAsTotal: 0,
    proposalCostTotal: 0,

    totalBudget: 366070,
    salesProfit: 83930,

    contingencyRate: 2.0,
    contingencyCost: 7321.4,
    projectNetProfit: 76608.6,
    profitRate: 17.02,

    productCosts: [
      { id: 'p1', category: 'H/W 장비', itemName: '공간정보 DB 서버', spec: '64Core / 256GB RAM', qty: 0, unitPrice: 0, amount: 0, note: '사내 서버 활용' },
    ],
    manpowerPlans: [
      { id: 'm1', type: '당사', grade: '특급', role: '총괄 PM', name: '우광일', position: '차장', months: [1, 1, 1, 1, 1, 1, 0, 0], totalMM: 6, unitPrice: 13100, laborCost: 78600 },
      { id: 'm2', type: '당사', grade: '고급', role: 'GIS 플랫폼 PL', name: '조경연', position: '과장', months: [1, 1, 1, 1, 1, 1, 0, 0], totalMM: 6, unitPrice: 9600, laborCost: 57600 },
      { id: 'm3', type: '당사', grade: '고급', role: '품질/보안 총괄', name: '이승은', position: '과장', months: [1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0], totalMM: 4, unitPrice: 9600, laborCost: 38400 },
      { id: 'm4', type: '당사', grade: '중급', role: '공간DB/검수', name: '최영진', position: '대리', months: [1, 1, 1, 1, 1, 1, 1, 1], totalMM: 12, unitPrice: 7800, laborCost: 93600 },
      { id: 'm5', type: '당사', grade: '초급', role: 'WebGIS/API 개발', name: '김진수', position: '담당', months: [1, 1, 1, 1, 1, 1, 1, 1], totalMM: 14, unitPrice: 6600, laborCost: 92400 },
    ],
    outsourcings: [],
    directExpenses: [
      { id: 'e1', account: '복리/특근식대', qty: 660, unitPrice: 10, basis: '42 MM × 15일', amount: 6600, note: '야근식대' },
      { id: 'e2', account: '복리/회의비', qty: 36, unitPrice: 70, basis: '5명 × 6개월', amount: 2520, note: '착수/중간보고' },
      { id: 'e3', account: '국내출장비', qty: 12, unitPrice: 400, basis: '12회 출장', amount: 4800, note: '기술협의 출장' },
      { id: 'e4', account: '시내교통비', qty: 8, unitPrice: 400, basis: '8개월', amount: 3200, note: '현장실사 차량유지' },
      { id: 'e5', account: '인쇄도서비', qty: 1, unitPrice: 2150, basis: '1식', amount: 2150, note: '보고서 인쇄' },
    ],
    riskEvaluations: [
      { id: 'r1', category: '고객성향', question: '고객 커뮤니케이션 채널 및 요구조건 명확성', selectedLevel: '하', score: 1, exposureWeight: 2, calculatedExposure: 2 },
      { id: 'r2', category: '고객성향', question: '프로젝트 기간 및 마일스톤 적정성 (8개월)', selectedLevel: '중', score: 3, exposureWeight: 2, calculatedExposure: 6 },
      { id: 'r3', category: '기술력', question: '유사 GIS/디지털트윈 플랫폼 구축 경험', selectedLevel: '하', score: 1, exposureWeight: 3, calculatedExposure: 3 },
      { id: 'r4', category: '기술력', question: 'PostGIS / GeoServer / 3D WebGIS 기술 난이도', selectedLevel: '중', score: 3, exposureWeight: 2, calculatedExposure: 6 },
      { id: 'r5', category: '팀구성도', question: '사내 특급/고급 핵심인력 투입 비율 (70% 이상)', selectedLevel: '하', score: 1, exposureWeight: 3, calculatedExposure: 3 },
    ],
    cashflowMilestones: [
      { id: 'cf1', turnName: '선금 (30%)', milestone: '계약체결 및 착수보고', plannedDate: '2026.04.15', ratePercent: 30, supplyAmount: 135000, vatAmount: 13500, totalAmount: 148500, status: '입금완료' },
      { id: 'cf2', turnName: '1차 중도금 (40%)', milestone: '중간보고회 및 기능검수', plannedDate: '2026.08.31', ratePercent: 40, supplyAmount: 180000, vatAmount: 18000, totalAmount: 198000, status: '청구완료' },
      { id: 'cf3', turnName: '잔금 (30%)', milestone: '최종 완료보고 및 납품검수', plannedDate: '2026.11.30', ratePercent: 30, supplyAmount: 135000, vatAmount: 13500, totalAmount: 148500, status: '입금예정' },
    ],
    approvalLine: {
      drafter: { name: drafterName, position: drafterPos, dept: drafterDept, status: '작성완료', date: '2026-10-29' },
      bizHead: { name: '', position: '', status: '' },
      ceo: { name: '', position: '', status: '' },
    },
    consensusLine: {
      qm: { name: '', position: '', dept: '', status: '' },
      mgmt: { name: '', position: '', dept: '', status: '' },
      pm: { name: '', position: '', dept: '', status: '' },
    },
  };
}

export default function ContractDashboard({
  currentUser,
  approvals,
  employees = [],
  projects = [],
  deals = [],
  onRefresh,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [workstationDoc, setWorkstationDoc] = useState<FullContractDocument | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Statistics (전자결재 상태 대신 핵심 데이터 요약)
  const stats = useMemo(() => {
    const totalCount = approvals.length;
    const totalAmount = approvals.reduce((sum, a) => sum + (a.amount || 0), 0);
    return { totalCount, totalAmount };
  }, [approvals]);

  // Filtered approvals (검색어 필터만 유지)
  const filteredApprovals = useMemo(() => {
    return approvals.filter((a) => {
      const q = searchQuery.toLowerCase();
      return (
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.requester.toLowerCase().includes(q) ||
        (a.vendor && a.vendor.toLowerCase().includes(q))
      );
    });
  }, [approvals, searchQuery]);

  const handleOpenWorkstation = (ap: Approval) => {
    setSelectedApproval(ap);
    const doc = buildDefaultFullContractDoc(ap, currentUser, approvals.length);
    setWorkstationDoc(doc);
    setIsCreatingNew(false);
  };

  const handleCreateNew = () => {
    const doc = buildDefaultFullContractDoc(undefined, currentUser, approvals.length);
    doc.title = '';
    doc.clientName = '농촌진흥청';
    setWorkstationDoc(doc);
    setSelectedApproval(null);
    setIsCreatingNew(true);
  };

  // 프로젝트 카드를 클릭해 바로 연동된 계약품의서 작성 시작
  const handleCreateFromProject = (prj: Project) => {
    const doc = buildDefaultFullContractDoc(undefined, currentUser, approvals.length);
    doc.linkedProjectId = prj.id;
    doc.linkedProjectCode = prj.code;
    doc.title = prj.name;

    let guessedClient = '한국국토정보공사';
    if (prj.name.includes('농촌진흥청') || prj.name.includes('농진청')) {
      guessedClient = '농촌진흥청';
    } else if (prj.name.includes('전기안전공사')) {
      guessedClient = '전기안전공사';
    } else if (
      prj.name.includes('한국국토정보공사') ||
      prj.name.includes('국토정보공사') ||
      prj.name.includes('LX')
    ) {
      guessedClient = '한국국토정보공사';
    }
    doc.clientName = guessedClient;

    doc.startDate = prj.start_date;
    doc.endDate = prj.end_date;
    doc.contractPeriod = `${prj.start_date.replaceAll('-', '.')} ~ ${prj.end_date.replaceAll('-', '.')} (8개월)`;
    const supply = (prj.budget || 45000) * 10; // 만원 ➔ 천원
    doc.supplyAmount = supply;
    doc.vatAmount = Math.round(supply * 0.1);

    // 프로젝트 참여 인원(members)을 사내 직원 DB와 매칭해 투입인력 자동 세팅
    if (prj.members && employees.length > 0) {
      const names = prj.members.split(',').map((s) => s.trim()).filter(Boolean);
      const matched = names
        .map((n) => employees.find((e) => e.name === n))
        .filter((e): e is Employee => !!e);

      const sDate = new Date(prj.start_date || '2026-04-01');
      const eDate = new Date(prj.end_date || '2026-11-30');
      const prjMonths = Math.max(
        1,
        (eDate.getFullYear() - sDate.getFullYear()) * 12 +
          (eDate.getMonth() - sDate.getMonth()) +
          1
      );
      const months = Array(prjMonths).fill(1);
      const totalMM = prjMonths;

      if (matched.length > 0) {
        doc.manpowerPlans = matched.map((emp, idx) => {
          const meta = POSITION_TO_GRADE[emp.position] || { grade: '중급' as const, role: 'GIS 개발' };
          const priceObj = STANDARD_UNIT_PRICES.find((p) => p.position === emp.position);
          const unitPrice = priceObj ? priceObj.price2026 : 7800;
          return {
            id: `mp_prj_${emp.id}_${idx}`,
            type: '당사' as const,
            grade: meta.grade,
            role: idx === 0 ? '총괄 PM' : meta.role,
            name: emp.name,
            position: emp.position,
            months: [...months],
            totalMM,
            unitPrice,
            laborCost: totalMM * unitPrice,
          };
        });
      }
    }

    // 수금 마일스톤도 금액에 맞춰 30/40/30 재계산
    doc.cashflowMilestones = doc.cashflowMilestones.map((m) => {
      const s = Math.round((supply * m.ratePercent) / 100);
      const v = Math.round(s * 0.1);
      return { ...m, supplyAmount: s, vatAmount: v, totalAmount: s + v };
    });

    setWorkstationDoc(doc);
    setSelectedApproval(null);
    setIsCreatingNew(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner (제목 및 핵심 버튼만 깔끔하게 유지) */}
      <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
            계약품의서 관리
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://docs.google.com/spreadsheets/d/15VXDSA_q8Z7m69fnvMMv4qdS9SQRAnrB/edit?usp=drive_link"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-300" />
            구글 시트 원본 열기
          </a>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95"
          >
            <Plus className="w-4 h-4" /> 새 계약품의서 작성
          </button>
        </div>
      </div>

      {/* Quick Start from Existing Projects */}
      {projects.length > 0 && (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-950">
                사내 프로젝트 불러오기
              </span>
            </div>
            <span className="text-[11px] text-indigo-600 font-medium">
              총 {projects.length}개 프로젝트 연동 가능
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {projects.map((prj) => (
              <button
                key={prj.id}
                onClick={() => handleCreateFromProject(prj)}
                className="text-left p-3.5 rounded-xl bg-white hover:bg-indigo-600 group border border-indigo-200/80 hover:border-indigo-600 transition shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 group-hover:bg-white/20 group-hover:text-white">
                      {prj.code}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-600 group-hover:text-indigo-100 flex items-center gap-1">
                      품의서 작성 <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-white line-clamp-1 mt-1">
                    {prj.name}
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 group-hover:border-white/15 flex items-center justify-between text-[11px] text-slate-500 group-hover:text-indigo-100">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {prj.department} ({prj.members.split(',').length}명)
                  </span>
                  <span className="font-bold text-slate-800 group-hover:text-white">
                    {(prj.budget * 10).toLocaleString()} 천원
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">등록된 계약품의서</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{stats.totalCount}건</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
          <div className="text-xs font-medium text-indigo-700">총 계약 공급가액</div>
          <div className="text-xl font-bold text-indigo-600 mt-1">
            {stats.totalAmount.toLocaleString()} 천원
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">연계 가능 사내 프로젝트</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{projects.length}건</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="계약명, 발주처, 담당자 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-80 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="text-xs text-slate-500">
          접속자: <span className="font-bold text-indigo-600">{currentUser.name} {currentUser.position}</span> ({currentUser.department})
        </div>
      </div>

      {/* Contract Documents Table (문서번호 제거, 전자결재 상태 제거) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">계약명</th>
                <th className="px-5 py-3.5">발주처</th>
                <th className="px-5 py-3.5 text-right">계약금액(공급가)</th>
                <th className="px-5 py-3.5">작성자 / 부서</th>
                <th className="px-5 py-3.5">등록일</th>
                <th className="px-5 py-3.5 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApprovals.map((ap) => (
                <tr key={ap.id} className="hover:bg-slate-50/80 transition group">
                  <td className="px-5 py-4 font-medium text-slate-900 max-w-md">
                    <div className="font-semibold line-clamp-1">{ap.title}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-600 font-medium">
                    {ap.vendor || '발주처 미지정'}
                  </td>
                  <td className="px-5 py-4 font-bold text-slate-900 text-right">
                    {ap.amount.toLocaleString()} 천원
                    <div className="text-[10px] font-normal text-slate-400">
                      VAT포함 {Math.round(ap.amount * 1.1).toLocaleString()} 천원
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-800">{ap.requester}</div>
                    <div className="text-[11px] text-slate-500">{ap.department}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{ap.created_at}</td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleOpenWorkstation(ap)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition shadow-2xs"
                    >
                      품의서 열기
                    </button>
                  </td>
                </tr>
              ))}
              {filteredApprovals.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    등록된 계약품의서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Workstation Modal */}
      {workstationDoc && (
        <ContractWorkstationModal
          initialDoc={workstationDoc}
          approvalRecord={selectedApproval || undefined}
          currentUser={currentUser}
          isNew={isCreatingNew}
          employees={employees}
          projects={projects}
          deals={deals}
          onClose={() => {
            setWorkstationDoc(null);
            setSelectedApproval(null);
          }}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}
