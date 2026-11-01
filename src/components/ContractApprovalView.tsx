'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Briefcase,
  User,
  Calculator,
  Building,
  Calendar,
  DollarSign,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Award
} from 'lucide-react';
import { AuthUser, isExecutiveOrAbove, isPmOrAbove } from '@/types/groupware';

export interface Approval {
  id: number;
  doc_no: string;
  category: string;
  title: string;
  requester: string;
  requester_position?: string;
  department: string;
  created_at: string;
  status: string;
  amount: number;
  project_name?: string;
  vendor?: string;
  payment_method?: string;
  purpose?: string;
  items_json?: string;
  reviewer_comment?: string;
  approved_by?: string;
}

export interface ContractDetails {
  doc_version: string;
  contract_name: string;
  client: string;
  period: string;
  contract_amount_supply: number;
  contract_amount_vat: number;
  our_share: number;
  payment_terms: string;
  warranty_period: string;
  delay_penalty_rate: number;
  advance_payment: number;
  interim_payment: number;
  balance_payment: number;
  product_cost: number;
  outsourcing_cost: number;
  internal_labor_cost: number;
  direct_expense: number;
  estimated_as_cost?: number;
  contingency_rate: number;
  contingency_cost: number;
  total_budget: number;
  project_profit: number;
  profit_rate: number;
  proposal_cost?: number;
  manpower_list: {
    type: string;
    grade: string;
    role: string;
    name: string;
    position: string;
    mm: number;
    unit_price: number;
    amount: number;
  }[];
  expense_list: {
    account: string;
    basis: string;
    amount: number;
    note: string;
  }[];
  consensus: {
    qm: string;
    mgmt: string;
    pm: string;
  };
  approval_line: {
    team_lead: string;
    biz_head: string;
    ceo: string;
  };
}

export const STANDARD_UNIT_PRICES = [
  { position: '이사', grade: '특급', price2026: 15800, price2027: 16500 },
  { position: '부장', grade: '특급', price2026: 13100, price2027: 13700 },
  { position: '차장', grade: '고급', price2026: 11000, price2027: 11500 },
  { position: '과장', grade: '고급', price2026: 9600, price2027: 10100 },
  { position: '대리', grade: '중급', price2026: 7800, price2027: 8200 },
  { position: '담당', grade: '초급', price2026: 6600, price2027: 6900 },
];

interface Props {
  currentUser: AuthUser;
  approvals: Approval[];
  onRefresh: () => Promise<void>;
}

export default function ContractApprovalView({ currentUser, approvals, onRefresh }: Props) {
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [activeSheetTab, setActiveSheetTab] = useState<'summary' | 'manpower' | 'expenses' | 'pricelist'>('summary');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [actionLoading, setActionLoading] = useState(false);

  // Form State for creating a new contract approval
  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newPeriod, setNewPeriod] = useState('2026.04.01 ~ 2026.11.30 (8개월)');
  const [newSupplyAmount, setNewSupplyAmount] = useState<number>(450000);
  const [newContingencyRate, setNewContingencyRate] = useState<number>(2.0);
  const [newManpower, setNewManpower] = useState([
    { type: '당사', grade: '특급', role: 'PM', name: currentUser.name, position: currentUser.position, mm: 6, unit_price: 13100, amount: 78600 },
    { type: '당사', grade: '고급', role: 'GIS엔진개발', name: '조경연', position: '과장', mm: 6, unit_price: 9600, amount: 57600 },
    { type: '당사', grade: '중급', role: '공간DB검수', name: '최영진', position: '대리', mm: 12, unit_price: 7800, amount: 93600 },
    { type: '당사', grade: '초급', role: 'API서비스개발', name: '김진수', position: '담당', mm: 18, unit_price: 6600, amount: 118800 },
  ]);
  const [newExpenses, setNewExpenses] = useState([
    { account: '복리/특근식대', basis: '42 MM × 10천원 × 15일', amount: 6300, note: '야근식대' },
    { account: '복리/회의비', basis: '6명 × 70천원 × 6회', amount: 2520, note: '착수/중간보고회' },
    { account: '국내출장비', basis: '세종/나주 공공기관 기술협의', amount: 6800, note: '단기출장' },
    { account: '시내교통비', basis: '현장 실사 및 PM 차량운행', amount: 3650, note: '월 정액 기준' },
  ]);

  // Calculations for new contract
  const newLaborTotal = useMemo(() => {
    return newManpower.reduce((sum, item) => sum + (item.mm * item.unit_price), 0);
  }, [newManpower]);

  const newExpenseTotal = useMemo(() => {
    return newExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [newExpenses]);

  const newTotalBudget = newLaborTotal + newExpenseTotal;
  const newContingencyCost = Math.round(newTotalBudget * (newContingencyRate / 100) * 10) / 10;
  const newProjectProfit = newSupplyAmount - newTotalBudget - newContingencyCost;
  const newProfitRate = newSupplyAmount > 0 ? Math.round((newProjectProfit / newSupplyAmount) * 10000) / 100 : 0;

  // Filtered approvals
  const filteredApprovals = useMemo(() => {
    return approvals.filter((a) => {
      const matchStatus = statusFilter === '전체' || a.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        a.doc_no.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.requester.toLowerCase().includes(q) ||
        (a.vendor && a.vendor.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [approvals, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = approvals.length;
    const pending = approvals.filter((a) => a.status === '결재대기').length;
    const consensus = approvals.filter((a) => a.status === '합의진행').length;
    const approved = approvals.filter((a) => a.status === '승인완료').length;
    const rejected = approvals.filter((a) => a.status === '반려').length;
    return { total, pending, consensus, approved, rejected };
  }, [approvals]);

  // Helper to parse JSON details
  const parseContractDetails = (ap: Approval): ContractDetails | null => {
    try {
      if (ap.items_json && ap.items_json.startsWith('{')) {
        return JSON.parse(ap.items_json);
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  // Approval actions
  const handleApprove = async (approval: Approval) => {
    if (!isExecutiveOrAbove(currentUser.role, currentUser.position)) {
      alert('최종 결재 승인은 [임원 권한(이사급 이상)] 또는 [시스템 관리자]만 가능합니다.');
      return;
    }
    try {
      setActionLoading(true);
      await fetch('http://localhost:8080/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'approvals',
          action: 'update',
          id: approval.id,
          data: {
            ...approval,
            status: '승인완료',
            approved_by: `${currentUser.name} (${currentUser.position})`,
            reviewer_comment: '임원 최종 승인 완료'
          }
        })
      });
      await onRefresh();
      if (selectedApproval && selectedApproval.id === approval.id) {
        setSelectedApproval({
          ...selectedApproval,
          status: '승인완료',
          approved_by: `${currentUser.name} (${currentUser.position})`,
          reviewer_comment: '임원 최종 승인 완료'
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (approval: Approval) => {
    if (!isExecutiveOrAbove(currentUser.role, currentUser.position)) {
      alert('반려 처리는 [임원 권한(이사급 이상)] 또는 [시스템 관리자]만 가능합니다.');
      return;
    }
    const reason = prompt('반려 사유를 입력하세요:', '손익계획 및 직접경비 예산 재검토 요망');
    if (reason === null) return;

    try {
      setActionLoading(true);
      await fetch('http://localhost:8080/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'approvals',
          action: 'update',
          id: approval.id,
          data: {
            ...approval,
            status: '반려',
            approved_by: `${currentUser.name} (${currentUser.position})`,
            reviewer_comment: `반려: ${reason}`
          }
        })
      });
      await onRefresh();
      if (selectedApproval && selectedApproval.id === approval.id) {
        setSelectedApproval({
          ...selectedApproval,
          status: '반려',
          approved_by: `${currentUser.name} (${currentUser.position})`,
          reviewer_comment: `반려: ${reason}`
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConsensus = async (approval: Approval) => {
    if (!isPmOrAbove(currentUser.role, currentUser.position)) {
      alert('합의 처리는 [PM 권한] 이상만 가능합니다.');
      return;
    }
    try {
      setActionLoading(true);
      const details = parseContractDetails(approval);
      const updatedDetails = details ? {
        ...details,
        consensus: {
          ...details.consensus,
          mgmt: `${currentUser.name} (합의완료)`
        }
      } : {};

      await fetch('http://localhost:8080/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'approvals',
          action: 'update',
          id: approval.id,
          data: {
            ...approval,
            status: '결재대기',
            reviewer_comment: `경영지원(${currentUser.name} 과장) 1차 합의 완료`,
            items_json: JSON.stringify(updatedDetails)
          }
        })
      });
      await onRefresh();
      if (selectedApproval && selectedApproval.id === approval.id) {
        setSelectedApproval({
          ...selectedApproval,
          status: '결재대기',
          reviewer_comment: `경영지원(${currentUser.name} 과장) 1차 합의 완료`,
          items_json: JSON.stringify(updatedDetails)
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit new contract approval
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newClient.trim()) {
      alert('계약명과 고객사를 입력해주세요.');
      return;
    }

    const docNo = `W-Q-S-12-${approvals.length + 5}`;
    const vatAmount = Math.round(newSupplyAmount * 1.1);

    const contractDetails: ContractDetails = {
      doc_version: '1.1',
      contract_name: newTitle,
      client: newClient,
      period: newPeriod,
      contract_amount_supply: newSupplyAmount,
      contract_amount_vat: vatAmount,
      our_share: 100,
      payment_terms: '현금',
      warranty_period: '12개월',
      delay_penalty_rate: 0.15,
      advance_payment: Math.round(newSupplyAmount * 0.3),
      interim_payment: Math.round(newSupplyAmount * 0.4),
      balance_payment: Math.round(newSupplyAmount * 0.3),
      product_cost: 0,
      outsourcing_cost: 0,
      internal_labor_cost: newLaborTotal,
      direct_expense: newExpenseTotal,
      estimated_as_cost: 0,
      contingency_rate: newContingencyRate,
      contingency_cost: newContingencyCost,
      total_budget: newTotalBudget,
      project_profit: newProjectProfit,
      profit_rate: newProfitRate,
      manpower_list: newManpower,
      expense_list: newExpenses,
      consensus: {
        qm: '홍지형 (합의대기)',
        mgmt: '조선영 (합의대기)',
        pm: `${currentUser.name} (기안완료)`
      },
      approval_line: {
        team_lead: `${currentUser.name} (기안)`,
        biz_head: '박용묵 (검토대기)',
        ceo: '권우석 (결재대기)'
      }
    };

    try {
      setActionLoading(true);
      await fetch('http://localhost:8080/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'approvals',
          action: 'create',
          data: {
            doc_no: docNo,
            category: '계약품의서',
            title: newTitle,
            requester: currentUser.name,
            requester_position: currentUser.position,
            department: currentUser.department,
            created_at: new Date().toISOString().split('T')[0],
            status: '결재대기',
            amount: newSupplyAmount,
            project_name: newTitle,
            vendor: newClient,
            payment_method: '현금 (하자 12개월 / 지체상금율 0.15%)',
            purpose: `W-Q-S-12-6 표준 계약품의서: 매출 ${newSupplyAmount.toLocaleString()}천원, 예산 ${newTotalBudget.toLocaleString()}천원, 손익 ${newProjectProfit.toLocaleString()}천원 (이익율 ${newProfitRate}%)`,
            items_json: JSON.stringify(contractDetails),
            reviewer_comment: '기안 접수 완료',
            approved_by: ''
          }
        })
      });
      await onRefresh();
      setCreateModalOpen(false);
      alert('신규 계약품의서(W-Q-S-12-6)가 정상적으로 기안되었습니다.');
    } catch (e) {
      console.error(e);
      alert('품의서 등록 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedDetails = selectedApproval ? parseContractDetails(selectedApproval) : null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Info */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-md border border-indigo-700/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              W-Q-S-12-6 표준 서식 탑재
            </span>
            <span className="text-xs text-indigo-200">Google Spreadsheet 연동 규격</span>
          </div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
            (주)스패셜티 계약품의서(총괄) 전자결재 시스템
          </h2>
          <p className="text-xs text-indigo-200/90 mt-1">
            공간정보(GIS) SI 프로젝트 계약 체결을 위한 종합 손익계획서, 투입인력 단가표, 직접경비 및 결재·합의 라인
          </p>
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
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            새 계약품의서 기안
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">전체 품의 문서</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{stats.total}건</div>
          <div className="text-[11px] text-slate-400 mt-0.5">계약·지출 결재건</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-xs font-medium text-amber-700">결재 대기</div>
          <div className="text-xl font-bold text-amber-600 mt-1">{stats.pending}건</div>
          <div className="text-[11px] text-amber-600/70 mt-0.5">대표이사 재가 대기</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <div className="text-xs font-medium text-blue-700">합의 진행</div>
          <div className="text-xl font-bold text-blue-600 mt-1">{stats.consensus}건</div>
          <div className="text-[11px] text-blue-600/70 mt-0.5">품질·경영 합의단계</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-xs font-medium text-emerald-700">승인 완료</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{stats.approved}건</div>
          <div className="text-[11px] text-emerald-600/70 mt-0.5">최종 결재 완료</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <div className="text-xs font-medium text-rose-700">반려 / 보완</div>
          <div className="text-xl font-bold text-rose-600 mt-1">{stats.rejected}건</div>
          <div className="text-[11px] text-rose-600/70 mt-0.5">예산 재검토 요청</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="문서번호, 계약명, 발주처, 기안자 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-64 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            {['전체', '결재대기', '합의진행', '승인완료', '반려'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  statusFilter === st
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500">
          내 권한:{' '}
          <span className="font-bold text-indigo-600">{currentUser.role}</span> ({currentUser.name}{' '}
          {currentUser.position})
        </div>
      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">문서번호</th>
                <th className="px-5 py-3.5">계약/품의명</th>
                <th className="px-5 py-3.5">발주처/고객명</th>
                <th className="px-5 py-3.5">계약금액(공급가)</th>
                <th className="px-5 py-3.5">기안자</th>
                <th className="px-5 py-3.5">기안일</th>
                <th className="px-5 py-3.5 text-center">진행상태</th>
                <th className="px-5 py-3.5 text-center">상세/결재</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApprovals.map((ap) => {
                const details = parseContractDetails(ap);
                const isContractForm = ap.doc_no.startsWith('W-Q-S-') || ap.category === '계약품의서';

                return (
                  <tr key={ap.id} className="hover:bg-slate-50/80 transition group">
                    <td className="px-5 py-4 font-mono font-semibold text-indigo-600">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {ap.doc_no}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900 max-w-md">
                      <div className="font-semibold line-clamp-1">{ap.title}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {ap.purpose || '표준 계약품의서'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-medium">
                      {ap.vendor || details?.client || '스패셜티 고객사'}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {(ap.amount || details?.contract_amount_supply || 0).toLocaleString()} 천원
                      <div className="text-[10px] font-normal text-slate-400">
                        부가세 포함 {Math.round((ap.amount || details?.contract_amount_supply || 0) * 1.1).toLocaleString()} 천원
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">{ap.requester}</div>
                      <div className="text-[11px] text-slate-500">{ap.department}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{ap.created_at}</td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          ap.status === '승인완료'
                            ? 'bg-emerald-100 text-emerald-700'
                            : ap.status === '결재대기'
                            ? 'bg-amber-100 text-amber-700'
                            : ap.status === '합의진행'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {ap.status === '승인완료' && <CheckCircle2 className="w-3 h-3" />}
                        {ap.status === '결재대기' && <Clock className="w-3 h-3" />}
                        {ap.status === '반려' && <XCircle className="w-3 h-3" />}
                        {ap.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedApproval(ap);
                          setActiveSheetTab('summary');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition shadow-2xs"
                      >
                        {isContractForm ? '품의서 보기 (엑셀양식)' : '상세보기'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredApprovals.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    등록된 계약품의서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL 1: 계약품의서(총괄) 엑셀 시트 뷰어 (W-Q-S-12-6) ================= */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                      {selectedApproval.doc_no}
                    </span>
                    <span className="text-xs text-slate-300">
                      표준 계약품의서 (버전 {selectedDetails?.doc_version || '1.1'})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-0.5 line-clamp-1">
                    {selectedApproval.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedApproval(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Excel Sheet Navigation Tabs */}
            <div className="px-6 bg-slate-100 border-b border-slate-200 flex items-center gap-1 pt-2">
              <button
                onClick={() => setActiveSheetTab('summary')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition border-t border-x ${
                  activeSheetTab === 'summary'
                    ? 'bg-white text-indigo-600 border-slate-200 border-b-white'
                    : 'bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200'
                }`}
              >
                1. 계약품의서(총괄)
              </button>
              <button
                onClick={() => setActiveSheetTab('manpower')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition border-t border-x ${
                  activeSheetTab === 'manpower'
                    ? 'bg-white text-indigo-600 border-slate-200 border-b-white'
                    : 'bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200'
                }`}
              >
                2. 투입인력 및 인건비 (42 M/M)
              </button>
              <button
                onClick={() => setActiveSheetTab('expenses')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition border-t border-x ${
                  activeSheetTab === 'expenses'
                    ? 'bg-white text-indigo-600 border-slate-200 border-b-white'
                    : 'bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200'
                }`}
              >
                3. 직접경비 상세내역
              </button>
              <button
                onClick={() => setActiveSheetTab('pricelist')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition border-t border-x ${
                  activeSheetTab === 'pricelist'
                    ? 'bg-white text-indigo-600 border-slate-200 border-b-white'
                    : 'bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200'
                }`}
              >
                4. 직급별 기준 단가표 (2026/2027)
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50">
              {/* TAB 1: 계약품의서(총괄) */}
              {activeSheetTab === 'summary' && (
                <div className="space-y-6">
                  {/* Top Approval & Consensus Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 결재선 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        결재선 (기안 / 부서장 / 사장)
                      </div>
                      <div className="grid grid-cols-3 border border-slate-300 rounded-lg overflow-hidden text-center text-xs">
                        <div className="bg-slate-100 py-1.5 font-semibold text-slate-600 border-r border-slate-200">
                          팀장(기안)
                        </div>
                        <div className="bg-slate-100 py-1.5 font-semibold text-slate-600 border-r border-slate-200">
                          영업본부장
                        </div>
                        <div className="bg-slate-100 py-1.5 font-semibold text-slate-600">
                          대표이사
                        </div>

                        <div className="p-3 border-t border-r border-slate-200 bg-white">
                          <div className="text-[11px] font-bold text-slate-800">
                            {selectedApproval.requester}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                            기안완료
                          </span>
                        </div>
                        <div className="p-3 border-t border-r border-slate-200 bg-white">
                          <div className="text-[11px] font-bold text-slate-800">
                            박용묵 이사
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600">
                            검토승인
                          </span>
                        </div>
                        <div className="p-3 border-t border-slate-200 bg-white">
                          <div className="text-[11px] font-bold text-slate-800">
                            권우석 사장
                          </div>
                          <span
                            className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              selectedApproval.status === '승인완료'
                                ? 'bg-emerald-100 text-emerald-700'
                                : selectedApproval.status === '반려'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {selectedApproval.status === '승인완료'
                              ? '최종승인'
                              : selectedApproval.status === '반려'
                              ? '반려'
                              : '재가대기'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 합의선 */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        합의선 (품질경영 / 경영관리 / 제안PM)
                      </div>
                      <div className="grid grid-cols-3 border border-slate-300 rounded-lg overflow-hidden text-center text-xs">
                        <div className="bg-slate-100 py-1.5 font-semibold text-slate-600 border-r border-slate-200">
                          품질경영팀
                        </div>
                        <div className="bg-slate-100 py-1.5 font-semibold text-slate-600 border-r border-slate-200">
                          경영지원팀
                        </div>
                        <div className="bg-slate-100 py-1.5 font-semibold text-slate-600">
                          제안 PM
                        </div>

                        <div className="p-3 border-t border-r border-slate-200 bg-white">
                          <div className="text-[11px] font-bold text-slate-800">
                            홍지형 대리
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-600">
                            합의완료
                          </span>
                        </div>
                        <div className="p-3 border-t border-r border-slate-200 bg-white">
                          <div className="text-[11px] font-bold text-slate-800">
                            조선영 과장
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-600">
                            합의완료
                          </span>
                        </div>
                        <div className="p-3 border-t border-slate-200 bg-white">
                          <div className="text-[11px] font-bold text-slate-800">
                            {selectedApproval.requester}
                          </div>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-600">
                            합의완료
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 계약일반현황 */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">■ 계약일반현황</span>
                      <span className="text-[11px] text-slate-500">단위: 천원 (VAT 별도)</span>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">고객명</span>
                        <span className="font-semibold text-slate-900">
                          {selectedDetails?.client || selectedApproval.vendor || '한국국토정보공사(LX)'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">계약명</span>
                        <span className="font-semibold text-slate-900 text-right line-clamp-1">
                          {selectedDetails?.contract_name || selectedApproval.title}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">계약기간</span>
                        <span className="font-semibold text-slate-900">
                          {selectedDetails?.period || '2026.04.01 ~ 2026.11.30 (8개월)'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">계약금액(공급가)</span>
                        <span className="font-bold text-indigo-600 text-sm">
                          {(selectedDetails?.contract_amount_supply || selectedApproval.amount || 450000).toLocaleString()}{' '}
                          천원
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">계약금액(VAT포함)</span>
                        <span className="font-semibold text-slate-900">
                          {(selectedDetails?.contract_amount_vat || Math.round((selectedApproval.amount || 450000) * 1.1)).toLocaleString()}{' '}
                          천원
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">당사 지분율</span>
                        <span className="font-semibold text-slate-900">100 % (단독 수주)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">대금지급조건 / 하자보증</span>
                        <span className="font-semibold text-slate-900">
                          현금 / 12개월 (지체상금율 0.15%)
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500 font-medium">입금계획 (선금/중도금/잔금)</span>
                        <span className="font-semibold text-slate-900">
                          선금 30% / 중도금 40% / 잔금 30%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 손익계획 (엑셀 계산식 표준) */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                      <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-indigo-600" />
                        ■ 손익계획 (W-Q-S-12-6 표준 계산식)
                      </span>
                      <span className="text-[11px] text-indigo-700 font-medium">
                        당사이익율:{' '}
                        <span className="text-sm font-bold text-indigo-900">
                          {selectedDetails?.profit_rate || 17.02} %
                        </span>
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5">구분</th>
                            <th className="px-4 py-2.5">항목 (엑셀 수식)</th>
                            <th className="px-4 py-2.5 text-right">금액 (천원)</th>
                            <th className="px-4 py-2.5 text-right">매출 대비 비중(%)</th>
                            <th className="px-4 py-2.5">산출 근거 및 비고</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          <tr className="bg-indigo-50/40 font-bold">
                            <td className="px-4 py-2.5 text-indigo-900">A</td>
                            <td className="px-4 py-2.5 text-indigo-900">매출액 (공급가액)</td>
                            <td className="px-4 py-2.5 text-right text-indigo-900">
                              {(selectedDetails?.contract_amount_supply || selectedApproval.amount || 450000).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right text-indigo-900">100.0 %</td>
                            <td className="px-4 py-2.5 text-slate-500 font-normal">발주처 계약금액 (VAT 별도)</td>
                          </tr>

                          <tr>
                            <td className="px-4 py-2 text-slate-500 font-medium">B</td>
                            <td className="px-4 py-2 font-semibold">당사 매출원가 (C+D+E+F)</td>
                            <td className="px-4 py-2 text-right font-bold text-slate-900">
                              {(selectedDetails?.total_budget || 366070).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-600">81.3 %</td>
                            <td className="px-4 py-2 text-slate-500">인건비 + 직접경비 + 외주비</td>
                          </tr>

                          <tr className="bg-slate-50/60 text-slate-600">
                            <td className="px-4 py-1.5 pl-8">C</td>
                            <td className="px-4 py-1.5">└ 상품원가</td>
                            <td className="px-4 py-1.5 text-right">0</td>
                            <td className="px-4 py-1.5 text-right">0.0 %</td>
                            <td className="px-4 py-1.5 text-slate-400">해당 없음</td>
                          </tr>
                          <tr className="bg-slate-50/60 text-slate-600">
                            <td className="px-4 py-1.5 pl-8">D</td>
                            <td className="px-4 py-1.5">└ 외주비</td>
                            <td className="px-4 py-1.5 text-right">0</td>
                            <td className="px-4 py-1.5 text-right">0.0 %</td>
                            <td className="px-4 py-1.5 text-slate-400">해당 없음</td>
                          </tr>
                          <tr className="bg-slate-50/60 text-slate-600">
                            <td className="px-4 py-1.5 pl-8">E</td>
                            <td className="px-4 py-1.5 font-medium text-slate-800">└ 당사 인건비 (42 M/M)</td>
                            <td className="px-4 py-1.5 text-right font-semibold text-slate-900">
                              {(selectedDetails?.internal_labor_cost || 346800).toLocaleString()}
                            </td>
                            <td className="px-4 py-1.5 text-right">77.1 %</td>
                            <td className="px-4 py-1.5 text-slate-500">직급별 단가표 연동 42 M/M</td>
                          </tr>
                          <tr className="bg-slate-50/60 text-slate-600">
                            <td className="px-4 py-1.5 pl-8">F</td>
                            <td className="px-4 py-1.5 font-medium text-slate-800">└ 직접경비</td>
                            <td className="px-4 py-1.5 text-right font-semibold text-slate-900">
                              {(selectedDetails?.direct_expense || 19270).toLocaleString()}
                            </td>
                            <td className="px-4 py-1.5 text-right">4.3 %</td>
                            <td className="px-4 py-1.5 text-slate-500">특근식대, 회의비, 출장비 등</td>
                          </tr>

                          <tr className="font-semibold">
                            <td className="px-4 py-2 text-slate-500">G</td>
                            <td className="px-4 py-2">당사 매출이익 (A - B)</td>
                            <td className="px-4 py-2 text-right font-bold text-slate-900">
                              {((selectedDetails?.contract_amount_supply || 450000) - (selectedDetails?.total_budget || 366070)).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right">18.7 %</td>
                            <td className="px-4 py-2 text-slate-500">매출액 - 총원가</td>
                          </tr>

                          <tr>
                            <td className="px-4 py-2 text-slate-500">H</td>
                            <td className="px-4 py-2">총예산 (= B)</td>
                            <td className="px-4 py-2 text-right font-bold text-slate-900">
                              {(selectedDetails?.total_budget || 366070).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right">81.3 %</td>
                            <td className="px-4 py-2 text-slate-500">프로젝트 집행 승인 예산</td>
                          </tr>

                          <tr className="bg-amber-50/40 text-amber-900">
                            <td className="px-4 py-2 font-bold">I</td>
                            <td className="px-4 py-2 font-bold">예비비 (총예산 × 2%)</td>
                            <td className="px-4 py-2 text-right font-bold text-amber-700">
                              {(selectedDetails?.contingency_cost || 7321.4).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold">1.6 %</td>
                            <td className="px-4 py-2 text-amber-700">리스크 대비 예비비 (기본 2%)</td>
                          </tr>

                          <tr className="bg-emerald-50 text-emerald-950 font-bold border-t-2 border-emerald-300">
                            <td className="px-4 py-3 text-emerald-800">J</td>
                            <td className="px-4 py-3 text-emerald-900 text-sm">프로젝트 손익 (G - I)</td>
                            <td className="px-4 py-3 text-right text-emerald-900 text-sm">
                              {(selectedDetails?.project_profit || 76608.6).toLocaleString()} 천원
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-900 text-sm">
                              {selectedDetails?.profit_rate || 17.02} %
                            </td>
                            <td className="px-4 py-3 text-emerald-800 font-semibold">
                              당사이익율 = 프로젝트 손익 ÷ 매출액
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 투입인력 및 인건비 */}
              {activeSheetTab === 'manpower' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-800">■ 2. 투입인력 및 인건비 산출 내역</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        SpatialT 단가표 기준 당사 인력 42 M/M 배치 현황
                      </p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600">
                      총 인건비:{' '}
                      {(selectedDetails?.internal_labor_cost || 346800).toLocaleString()} 천원
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">구분</th>
                          <th className="px-4 py-2.5">기술등급</th>
                          <th className="px-4 py-2.5">담당 역할</th>
                          <th className="px-4 py-2.5">성명</th>
                          <th className="px-4 py-2.5">직급</th>
                          <th className="px-4 py-2.5 text-right">투입 M/M</th>
                          <th className="px-4 py-2.5 text-right">기준단가 (천원/MM)</th>
                          <th className="px-4 py-2.5 text-right">인건비 합계 (천원)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {(selectedDetails?.manpower_list || [
                          { type: '당사', grade: '특급', role: '총괄 PM', name: '우광일', position: '차장', mm: 6, unit_price: 13100, amount: 78600 },
                          { type: '당사', grade: '고급', role: 'GIS 플랫폼 PL', name: '조경연', position: '과장', mm: 6, unit_price: 9600, amount: 57600 },
                          { type: '당사', grade: '고급', role: '품질/보안 총괄', name: '이승은', position: '과장', mm: 4, unit_price: 9600, amount: 38400 },
                          { type: '당사', grade: '중급', role: '공간DB/검수', name: '최영진', position: '대리', mm: 12, unit_price: 7800, amount: 93600 },
                          { type: '당사', grade: '초급', role: 'WebGIS/API 개발', name: '김진수', position: '담당', mm: 14, unit_price: 6600, amount: 92400 },
                        ]).map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-600">{m.type}</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                {m.grade}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">{m.role}</td>
                            <td className="px-4 py-2.5 font-bold text-slate-900">{m.name}</td>
                            <td className="px-4 py-2.5 text-slate-600">{m.position}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-indigo-600">{m.mm} MM</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">
                              {m.unit_price.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                              {m.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold text-slate-900">
                          <td colSpan={5} className="px-4 py-3 text-center">
                            투입인력 합계 (당사 100%)
                          </td>
                          <td className="px-4 py-3 text-right text-indigo-700">42.0 MM</td>
                          <td className="px-4 py-3 text-right">-</td>
                          <td className="px-4 py-3 text-right text-indigo-700">
                            {(selectedDetails?.internal_labor_cost || 346800).toLocaleString()} 천원
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: 직접경비 상세 */}
              {activeSheetTab === 'expenses' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-800">■ 3. 직접경비 상세내역</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        프로젝트 수행에 소요되는 특근식대, 회의비, 국내출장비, 감가상각 등
                      </p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600">
                      직접경비 총액:{' '}
                      {(selectedDetails?.direct_expense || 19270).toLocaleString()} 천원
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">비목 / 계정과목</th>
                          <th className="px-4 py-2.5">산출 근거 (수량 × 단가)</th>
                          <th className="px-4 py-2.5 text-right">금액 (천원)</th>
                          <th className="px-4 py-2.5">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {(selectedDetails?.expense_list || [
                          { account: '복리/특근식대', basis: '44 MM × 10천원 × 15일', amount: 6600, note: '야근식대' },
                          { account: '복리/회의비', basis: '6명 × 70천원 × 6개월', amount: 2520, note: '착수/중간/완료보고' },
                          { account: '국내출장비', basis: '세종시 행안부/LX 본사 출장', amount: 4800, note: '단기출장 단가표 기준' },
                          { account: '시내교통비/PM교통비', basis: '현장실사 및 PM 차량유지', amount: 3200, note: '월 정액 기준' },
                          { account: '인쇄도서비/산출물', basis: '완료보고서 및 매뉴얼 인쇄', amount: 2150, note: '최종 산출물' },
                        ]).map((ex, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{ex.account}</td>
                            <td className="px-4 py-2.5 text-slate-600">{ex.basis}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-indigo-600">
                              {ex.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{ex.note}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold text-slate-900">
                          <td colSpan={2} className="px-4 py-3 text-center">
                            직접경비 총계
                          </td>
                          <td className="px-4 py-3 text-right text-indigo-700">
                            {(selectedDetails?.direct_expense || 19270).toLocaleString()} 천원
                          </td>
                          <td className="px-4 py-3"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: 직급별 기준 단가표 */}
              {activeSheetTab === 'pricelist' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-800">
                        ■ (주)스패셜티 직급별 기준 단가표 (2026 / 2027년도)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        SW 기술자 노임단가 및 사내 단가 규정 (단위: 천원 / MM)
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      사내 표준 단가
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3">직급명</th>
                          <th className="px-5 py-3">기술등급</th>
                          <th className="px-5 py-3 text-right">2026년 기준단가 (천원/MM)</th>
                          <th className="px-5 py-3 text-right">2027년 기준단가 (천원/MM)</th>
                          <th className="px-5 py-3">적용 기준</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {STANDARD_UNIT_PRICES.map((p) => (
                          <tr key={p.position} className="hover:bg-slate-50">
                            <td className="px-5 py-3 font-bold text-slate-900">{p.position}</td>
                            <td className="px-5 py-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                {p.grade}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-indigo-600">
                              {p.price2026.toLocaleString()} 천원
                            </td>
                            <td className="px-5 py-3 text-right font-semibold text-slate-700">
                              {p.price2027.toLocaleString()} 천원
                            </td>
                            <td className="px-5 py-3 text-slate-500">
                              {p.position === '이사' || p.position === '부장'
                                ? '총괄 PM / 감리 대응'
                                : p.position === '차장' || p.position === '과장'
                                ? 'PL / GIS 엔진 아키텍처'
                                : 'WebGIS 및 공간DB 개발'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Role-based Approval Controls */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {selectedApproval.reviewer_comment && (
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    검토의견: {selectedApproval.reviewer_comment}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* PM 권한 이상: 1차 합의 처리 */}
                {isPmOrAbove(currentUser.role, currentUser.position) && selectedApproval.status === '결재대기' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleConsensus(selectedApproval)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50"
                  >
                    1차 합의 승인
                  </button>
                )}

                {/* 임원 권한(이사급 이상) 및 시스템 관리자: 최종 승인 / 반려 */}
                {isExecutiveOrAbove(currentUser.role, currentUser.position) && selectedApproval.status !== '승인완료' && (
                  <>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleReject(selectedApproval)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm disabled:opacity-50"
                    >
                      반려 처리
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleApprove(selectedApproval)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm disabled:opacity-50"
                    >
                      최종 결재 승인
                    </button>
                  </>
                )}

                {!isPmOrAbove(currentUser.role, currentUser.position) && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    일반직원 (결재 권한 없음)
                  </span>
                )}

                <button
                  onClick={() => setSelectedApproval(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: 새 계약품의서 기안 모달 ================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-300">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">새 계약품의서 기안 작성</h3>
                  <p className="text-xs text-slate-300">표준 서식 W-Q-S-12-6 기반 자동 손익계산</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="flex-1 p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    계약 / 프로젝트명
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 지자체 도로공간정보 고도화 사업"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    발주처 / 고객사명
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 한국국토정보공사(LX)"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    계약기간
                  </label>
                  <input
                    type="text"
                    value={newPeriod}
                    onChange={(e) => setNewPeriod(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    계약 공급가액 (천원, VAT별도)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={newSupplyAmount}
                    onChange={(e) => setNewSupplyAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    예비비율 (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={newContingencyRate}
                    onChange={(e) => setNewContingencyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-amber-600"
                  />
                </div>
              </div>

              {/* Real-time Profit Preview Box */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-50 border border-indigo-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    손익 계획 실시간 자동 계산
                  </span>
                  <span className="text-xs font-extrabold text-indigo-700">
                    당사이익율: {newProfitRate} %
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[11px] text-slate-500">인건비 합계</div>
                    <div className="font-bold text-slate-900 mt-0.5">{newLaborTotal.toLocaleString()} 천원</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[11px] text-slate-500">직접경비</div>
                    <div className="font-bold text-slate-900 mt-0.5">{newExpenseTotal.toLocaleString()} 천원</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <div className="text-[11px] text-slate-500">예비비 ({newContingencyRate}%)</div>
                    <div className="font-bold text-amber-600 mt-0.5">{newContingencyCost.toLocaleString()} 천원</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                    <div className="text-[11px] text-emerald-700 font-medium">프로젝트 손익</div>
                    <div className="font-extrabold text-emerald-800 mt-0.5">{newProjectProfit.toLocaleString()} 천원</div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                기안자: <span className="font-bold text-slate-800">{currentUser.name} {currentUser.position}</span> ({currentUser.department})
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50"
                >
                  {actionLoading ? '기안 등록 중...' : '계약품의서 기안 제출'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

