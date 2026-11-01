'use client';

import React, { useState } from 'react';
import {
  FullContractDocument,
  AuthUser,
  Approval,
  Employee,
  Project,
  BusinessDeal,
} from '@/types/groupware';
import SummarySheet from './sheets/SummarySheet';
import ProductCostSheet from './sheets/ProductCostSheet';
import ManpowerSheet from './sheets/ManpowerSheet';
import OutsourcingSheet from './sheets/OutsourcingSheet';
import DirectExpenseSheet from './sheets/DirectExpenseSheet';
import RiskContingencySheet from './sheets/RiskContingencySheet';
import {
  FileSpreadsheet,
  Save,
  Printer,
  Briefcase,
  X,
} from 'lucide-react';

interface Props {
  initialDoc: FullContractDocument;
  approvalRecord?: Approval;
  currentUser: AuthUser;
  employees?: Employee[];
  projects?: Project[];
  deals?: BusinessDeal[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  isNew?: boolean;
}

type SheetKey =
  | 'summary'
  | 'manpower'
  | 'expenses'
  | 'products'
  | 'outsourcing'
  | 'risk';

export default function ContractWorkstationModal({
  initialDoc,
  approvalRecord,
  currentUser,
  employees = [],
  projects = [],
  deals = [],
  onClose,
  onSaved,
  isNew = false,
}: Props) {
  const [doc, setDoc] = useState<FullContractDocument>(initialDoc);
  const [activeSheet, setActiveSheet] = useState<SheetKey>('summary');
  const [saving, setSaving] = useState(false);
  const [syncWithProject, setSyncWithProject] = useState(true);

  // Recalculate totals across sheets
  const updateDocAndRecalculate = (patch: Partial<FullContractDocument>) => {
    setDoc((prev) => {
      const next = { ...prev, ...patch };

      // Calculate totals from sub-sheets
      const productCostTotal = next.productCosts.reduce((s, it) => s + it.amount, 0);
      const laborCostTotal = next.manpowerPlans.reduce((s, it) => s + it.laborCost, 0);
      const outsourcingTotal = next.outsourcings.reduce((s, it) => s + it.contractAmount, 0);
      const directExpenseTotal = next.directExpenses.reduce((s, it) => s + it.amount, 0);

      // Total budget B = C + D + E + F + AS + Proposal
      const totalBudget =
        productCostTotal +
        laborCostTotal +
        outsourcingTotal +
        directExpenseTotal +
        next.estimatedAsTotal +
        next.proposalCostTotal;

      // Sales profit G = A - B
      const salesProfit = next.supplyAmount - totalBudget;

      // Contingency cost I = B * contingencyRate
      const contingencyCost = Math.round(totalBudget * (next.contingencyRate / 100) * 10) / 10;

      // Project net profit J = G - I
      const projectNetProfit = salesProfit - contingencyCost;

      // Profit rate K = J / A * 100 (%)
      const profitRate =
        next.supplyAmount > 0
          ? Math.round((projectNetProfit / next.supplyAmount) * 10000) / 100
          : 0;

      return {
        ...next,
        productCostTotal,
        laborCostTotal,
        outsourcingTotal,
        directExpenseTotal,
        totalBudget,
        salesProfit,
        contingencyCost,
        projectNetProfit,
        profitRate,
      };
    });
  };

  // Save changes to backend (and optionally sync with Project table)
  const handleSaveDocument = async () => {
    if (!doc.title.trim()) {
      alert('계약명(프로젝트 과제명)을 입력하거나 상단에서 프로젝트를 선택해주세요.');
      setActiveSheet('summary');
      return;
    }
    if (!doc.clientName.trim()) {
      alert('고객사(발주처)를 입력하거나 선택해주세요.');
      setActiveSheet('summary');
      return;
    }

    try {
      setSaving(true);

      // 1) Sync with Project table (DB projects 테이블과 100% 실시간 동기화)
      if (syncWithProject) {
        const uniqueNames = Array.from(
          new Set(
            doc.manpowerPlans
              .map((m) => (m.name || '').trim())
              .filter(Boolean)
          )
        );
        const memberNames = uniqueNames.join(', ');
        const pmItem =
          doc.manpowerPlans.find((m) => m.role.includes('PM')) || doc.manpowerPlans[0];
        const pmName = pmItem && pmItem.name ? pmItem.name.trim() : currentUser.name;
        const budgetManwon = Math.round(doc.supplyAmount / 10); // 천원 -> 만원
        const totalMM = doc.manpowerPlans.reduce((s, m) => s + m.totalMM, 0);

        const existingPrj = projects.find(
          (p) =>
            p.id === doc.linkedProjectId ||
            (doc.linkedProjectCode && p.code === doc.linkedProjectCode) ||
            p.name === doc.title
        );

        if (existingPrj) {
          await fetch('http://localhost:8080/api/groupware', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              module: 'projects',
              action: 'update',
              id: existingPrj.id,
              data: {
                ...existingPrj,
                name: doc.title,
                department: '사업본부',
                pm_name: pmName,
                start_date: doc.startDate || existingPrj.start_date,
                end_date: doc.endDate || existingPrj.end_date,
                budget: budgetManwon,
                members: memberNames || existingPrj.members,
                description: `계약품의서 연동 — 발주처: ${doc.clientName}, 투입공수: ${totalMM.toFixed(1)} M/M, 손익률: ${doc.profitRate}%`,
              },
            }),
          });
        } else {
          const newPrjCode =
            doc.linkedProjectCode ||
            `PRJ-2026-${String(projects.length + 1).padStart(2, '0')}`;
          await fetch('http://localhost:8080/api/groupware', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              module: 'projects',
              action: 'create',
              data: {
                code: newPrjCode,
                name: doc.title,
                department: '사업본부',
                pm_name: pmName,
                start_date: doc.startDate || '2026-04-01',
                end_date: doc.endDate || '2026-11-30',
                status: '프로젝트 수행',
                progress: 10,
                budget: budgetManwon,
                members: memberNames || currentUser.name,
                priority: '높음',
                description: `계약품의서 연동 — 발주처: ${doc.clientName}, 투입공수: ${totalMM.toFixed(1)} M/M, 손익률: ${doc.profitRate}%`,
              },
            }),
          });
        }
      }

      // 2) Save Contract Record to DB approvals table
      const hasExistingApproval = !!(approvalRecord && approvalRecord.id);
      const payload = {
        module: 'approvals',
        action: hasExistingApproval ? 'update' : 'create',
        id: approvalRecord?.id,
        data: {
          id: approvalRecord?.id,
          doc_no:
            doc.docNo ||
            approvalRecord?.doc_no ||
            `CONTRACT-${Date.now().toString().slice(-6)}`,
          category: approvalRecord?.category || '계약품의서',
          title: doc.title,
          requester: hasExistingApproval
            ? approvalRecord?.requester || currentUser.name
            : currentUser.name,
          requester_position: hasExistingApproval
            ? approvalRecord?.requester_position || currentUser.position
            : currentUser.position,
          department: hasExistingApproval
            ? approvalRecord?.department || '사업본부'
            : '사업본부',
          created_at:
            approvalRecord?.created_at || new Date().toISOString().split('T')[0],
          status: approvalRecord?.status || '승인완료',
          amount: doc.supplyAmount,
          project_name: doc.title,
          vendor: doc.clientName,
          payment_method: `${doc.paymentTerms} (하자 ${doc.warrantyPeriod} / 지체상금율 ${doc.delayPenaltyRate}%)`,
          purpose: `계약품의서: 공급가 ${doc.supplyAmount.toLocaleString()}천원, 총예산 ${doc.totalBudget.toLocaleString()}천원, 손익 ${doc.projectNetProfit.toLocaleString()}천원 (이익율 ${doc.profitRate}%)`,
          items_json: JSON.stringify(doc),
          reviewer_comment: approvalRecord?.reviewer_comment || '정상 등록 및 프로젝트 동기화 완료',
          approved_by: approvalRecord?.approved_by || currentUser.name,
        },
      };

      const res = await fetch('http://localhost:8080/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await onSaved();
        onClose();
      } else {
        alert('저장에 실패했습니다. 백엔드 상태를 확인해주세요.');
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const totalMM = doc.manpowerPlans.reduce((s, m) => s + m.totalMM, 0);

  // 고정 탭 목록 (입금계획 및 노임단가표 제거되어 6대 핵심 원가 시트로 집중)
  const navSheets: { key: SheetKey; label: string }[] = [
    { key: 'summary', label: '계약품의서(총괄)' },
    { key: 'manpower', label: '투입인력 및 인건비' },
    { key: 'expenses', label: '직접경비' },
    { key: 'products', label: '상품원가' },
    { key: 'outsourcing', label: '외주비' },
    { key: 'risk', label: '예비비(리스크)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3">
      {/* 모달 창: 높이 90vh 고정, flex-col로 상단 고정 및 내부 본문 독립 스크롤 */}
      <div className="bg-slate-100 rounded-3xl shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden border border-slate-300">
        {/* 1. 상단 헤더 바 (고정) */}
        <div className="shrink-0 px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white line-clamp-1">
                {doc.title || '계약품의서 작성'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 핵심 손익 요약 */}
            <div className="hidden md:flex items-center gap-3 bg-slate-800 border border-slate-700 px-3 py-1 rounded-xl text-xs">
              <div>
                <span className="text-slate-400">공급가:</span>{' '}
                <strong className="text-white">{doc.supplyAmount.toLocaleString()}천</strong>
              </div>
              <span className="text-slate-600">|</span>
              <div>
                <span className="text-slate-400">총예산:</span>{' '}
                <strong className="text-amber-300">{doc.totalBudget.toLocaleString()}천</strong>
              </div>
              <span className="text-slate-600">|</span>
              <div>
                <span className="text-slate-400">순손익:</span>{' '}
                <strong className="text-emerald-400">
                  {doc.projectNetProfit.toLocaleString()}천 ({doc.profitRate}%)
                </strong>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
              title="인쇄"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. 상단 고정 탭 네비게이션 바 (크기/너비 불변 고정) */}
        <div className="shrink-0 px-6 bg-slate-200/90 border-b border-slate-300 flex items-center gap-1 overflow-x-auto pt-2">
          {navSheets.map((sh) => {
            const active = activeSheet === sh.key;
            return (
              <button
                key={sh.key}
                onClick={() => setActiveSheet(sh.key)}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl transition border-t border-x flex items-center justify-center whitespace-nowrap min-w-[110px] ${
                  active
                    ? 'bg-white text-indigo-600 border-slate-300 border-b-white shadow-xs'
                    : 'bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {sh.label}
              </button>
            );
          })}
        </div>

        {/* 3. 본문 워크스페이스 영역 (상단 탭은 고정되어 있고, 오직 이 영역만 내부 스크롤) */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/70 min-h-0">
          {activeSheet === 'summary' && (
            <SummarySheet
              doc={doc}
              onChangeDoc={(patch) => updateDocAndRecalculate(patch)}
              projects={projects}
              deals={deals}
              employees={employees}
            />
          )}

          {activeSheet === 'manpower' && (
            <ManpowerSheet
              items={doc.manpowerPlans}
              onChangeItems={(items) => updateDocAndRecalculate({ manpowerPlans: items })}
              employees={employees}
              startDate={doc.startDate}
              endDate={doc.endDate}
            />
          )}

          {activeSheet === 'expenses' && (
            <DirectExpenseSheet
              items={doc.directExpenses}
              onChangeItems={(items) => updateDocAndRecalculate({ directExpenses: items })}
              totalMM={totalMM}
              headcount={doc.manpowerPlans.length}
            />
          )}

          {activeSheet === 'products' && (
            <ProductCostSheet
              items={doc.productCosts}
              onChangeItems={(items) => updateDocAndRecalculate({ productCosts: items })}
            />
          )}

          {activeSheet === 'outsourcing' && (
            <OutsourcingSheet
              items={doc.outsourcings}
              onChangeItems={(items) => updateDocAndRecalculate({ outsourcings: items })}
            />
          )}

          {activeSheet === 'risk' && (
            <RiskContingencySheet
              items={doc.riskEvaluations}
              onChangeItems={(items) => updateDocAndRecalculate({ riskEvaluations: items })}
              totalBudget={doc.totalBudget}
              contingencyRate={doc.contingencyRate}
              onChangeRate={(rate) => updateDocAndRecalculate({ contingencyRate: rate })}
            />
          )}
        </div>

        {/* 4. 모달 하단 고정 푸터 (저장 버튼만 깔끔하게 유지) */}
        <div className="shrink-0 px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 px-3 py-1.5 rounded-xl border border-indigo-200 font-semibold transition">
              <input
                type="checkbox"
                checked={syncWithProject}
                onChange={(e) => setSyncWithProject(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              />
              <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
              <span>저장 시 [프로젝트 관리] 정보(예산·참여인력·기간) 자동 동기화</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={saving}
              onClick={handleSaveDocument}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? '저장 중...' : '계약품의서 저장'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
