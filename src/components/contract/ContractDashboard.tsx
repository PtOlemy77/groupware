'use client';
import { unitPrice as configuredPrice } from '@/lib/api';

import React, { useState, useMemo } from 'react';
import {
  Approval,
  AuthUser,
  FullContractDocument,
  Employee,
  Project,
  BusinessDeal,
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
import { PageHeaderBar, SearchInput, Button } from '@/components/common';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  TableEmpty,
} from '@/components/common/Table';

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
  _count = 1,
): FullContractDocument {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const start = `${today.getFullYear()}-${month}-01`;

  const blank: FullContractDocument = {
    docNo: ap?.doc_no || '',
    version: '1.0',
    title: ap?.title || '',
    clientName: ap?.vendor || '',
    contractPeriod: '',
    startDate: start,
    endDate: start,
    linkedProjectId: ap?.project_id,
    contractType: '용역구축',
    paymentTerms: '',
    warrantyPeriod: '12개월',
    delayPenaltyRate: 0,
    ourShareRate: 100,
    supplyAmount: ap?.amount || 0,
    vatAmount: 0,
    productCostTotal: 0,
    outsourcingTotal: 0,
    laborCostTotal: 0,
    directExpenseTotal: 0,
    estimatedAsTotal: 0,
    proposalCostTotal: 0,
    totalBudget: 0,
    salesProfit: 0,
    contingencyRate: 0,
    contingencyCost: 0,
    projectNetProfit: 0,
    profitRate: 0,
    productCosts: [],
    manpowerPlans: [],
    outsourcings: [],
    directExpenses: [],
    riskEvaluations: [],
    cashflowMilestones: [],
    approvalLine: {
      drafter: {
        name: currentUser?.name || '',
        position: currentUser?.position || '',
        dept: currentUser?.department || '',
        status: '작성중',
        date: '',
      },
      bizHead: { name: '', position: '', status: '' },
      ceo: { name: '', position: '', status: '' },
    },
    consensusLine: {
      qm: { name: '', position: '', dept: '', status: '' },
      mgmt: { name: '', position: '', dept: '', status: '' },
      pm: { name: '', position: '', dept: '', status: '' },
    },
  };

  if (!ap?.items_json) {
    return blank;
  }

  try {
    const parsed = JSON.parse(ap.items_json);
    const isValidStructure =
      Array.isArray(parsed.productCosts) && Array.isArray(parsed.manpowerPlans);
    if (!isValidStructure) {
      throw new Error('Invalid contract document structure');
    }
    return { ...blank, ...parsed };
  } catch {
    throw new Error(
      '이 계약은 이전 문서 형식입니다. 원본을 보존한 상태에서 관리자에게 문서 변환을 요청하세요.',
    );
  }
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

      const sDate = new Date(prj.start_date);
      const eDate = new Date(prj.end_date);
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
          const unitPrice = configuredPrice(emp.position, new Date(prj.start_date).getFullYear());
          return {
            id: `mp_prj_${emp.id}_${idx}`,
            type: '당사' as const,
            grade: meta.grade,
            role: idx === 0 ? '총괄 PM' : meta.role,
            employeeId: emp.id,
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
            <span className="text-xs text-indigo-600 font-medium">
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
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 group-hover:bg-white/20 group-hover:text-white">
                      {prj.code}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-100 flex items-center gap-1">
                      품의서 작성 <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-white line-clamp-1 mt-1">
                    {prj.name}
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 group-hover:border-white/15 flex items-center justify-between text-xs text-slate-500 group-hover:text-indigo-100">
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
      <PageHeaderBar
        left={
          <SearchInput
            placeholder="계약명, 발주처, 담당자 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            size="md"
            className="w-80"
          />
        }
        right={
          <div className="text-xs text-slate-500 font-medium">
            접속자: <span className="font-bold text-indigo-600">{currentUser.name} {currentUser.position}</span> ({currentUser.department})
          </div>
        }
      />

      {/* Contract Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <Table className="min-w-[840px]">
            <TableHead>
              <tr>
                <TableHeaderCell>계약명</TableHeaderCell>
                <TableHeaderCell>발주처</TableHeaderCell>
                <TableHeaderCell align="right">계약금액(공급가)</TableHeaderCell>
                <TableHeaderCell>작성자 / 부서</TableHeaderCell>
                <TableHeaderCell>등록일</TableHeaderCell>
                <TableHeaderCell align="center">관리</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {filteredApprovals.map((ap) => (
                <TableRow key={ap.id}>
                  <TableCell className="font-medium text-slate-900 max-w-md">
                    <div className="font-semibold line-clamp-1">{ap.title}</div>
                  </TableCell>
                  <TableCell className="text-slate-600 font-medium">
                    {ap.vendor || '발주처 미지정'}
                  </TableCell>
                  <TableCell align="right" className="font-bold text-slate-900">
                    {ap.amount.toLocaleString()} 천원
                    <div className="text-xs font-normal text-slate-400">
                      VAT포함 {Math.round(ap.amount * 1.1).toLocaleString()} 천원
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-800">{ap.requester}</div>
                    <div className="text-xs text-slate-500">{ap.department}</div>
                  </TableCell>
                  <TableCell className="text-slate-500 font-mono text-xs">{ap.created_at}</TableCell>
                  <TableCell align="center">
                    <button
                      onClick={() => handleOpenWorkstation(ap)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition shadow-2xs cursor-pointer"
                    >
                      품의서 열기
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredApprovals.length === 0 && (
                <TableEmpty colSpan={6} message="등록된 계약품의서가 없습니다." />
              )}
            </TableBody>
          </Table>
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
