'use client';

import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';

import React, { useState } from 'react';
import {
  FullContractDocument,
  isPmOrAbove,
  isExecutiveOrAbove,
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
      if ((patch.startDate || patch.endDate) && !patch.manpowerPlans) {
        const oldStart = new Date(prev.startDate || ''), start = new Date(next.startDate || ''), end = new Date(next.endDate || '');
        const count = (end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth()+1;
        if (Number.isFinite(count) && count > 0 && count <= 120) next.manpowerPlans = next.manpowerPlans.map(plan => {
          const offset = (start.getFullYear()-oldStart.getFullYear())*12+start.getMonth()-oldStart.getMonth();
          const months = Array.from({length:count},(_,i)=>plan.months[i+offset] ?? 0);
          const totalMM = Math.round(months.reduce((sum,value)=>sum+value,0)*100)/100;
          return {...plan,months,totalMM,laborCost:Math.round(totalMM*plan.unitPrice*100)/100};
        });
      }

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

  const { showAlert } = useModal();
  const readOnly = !isPmOrAbove(currentUser.role) || (!isExecutiveOrAbove(currentUser.role) && !!doc.linkedProjectId && projects.find(p => p.id === doc.linkedProjectId)?.pm_id !== currentUser.id) || !!(approvalRecord && !['작성중', '반려'].includes(approvalRecord.status));
  const [approverId, setApproverId] = useState<number | undefined>(approvalRecord?.approver_id);
  const handleSaveDocument = async () => {
    if (readOnly) return;
    if (!doc.title.trim() || !doc.clientName.trim()) {
      await showAlert('계약명과 고객사를 입력하세요.', { type: 'warning' });
      return;
    }
    try {
      setSaving(true);
      await apiFetch('/api/groupware', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'approvals', action: 'save_contract', id: approvalRecord?.id,
          version: approvalRecord?.version, sync_project: syncWithProject, project_id: doc.linkedProjectId,
          project_version: projects.find(p => p.id === doc.linkedProjectId)?.version,
          data: { title: doc.title, category: '계약품의서', project_id: doc.linkedProjectId,
            approver_id: approverId, amount: Math.round(doc.supplyAmount), vendor: doc.clientName,
            project_name: doc.title, items_json: JSON.stringify(doc) } }),
      });
      await onSaved(); onClose();
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : '저장하지 못했습니다.', {
        type: 'error',
      });
    } finally { setSaving(false); }
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
          <label className="block mb-4 text-sm">최종 결재자
            <select aria-label="최종 결재자" disabled={readOnly} value={approverId || ''} onChange={e => setApproverId(Number(e.target.value) || undefined)} className="ml-3 border rounded p-2">
              <option value="">결재자 선택</option>
              {employees.filter(e => isExecutiveOrAbove(e.role) && e.id !== (approvalRecord?.requester_id || currentUser.id)).map(e => <option key={e.id} value={e.id}>{e.name} {e.position}</option>)}
            </select>
          </label>
          {activeSheet === 'summary' && (
            <SummarySheet
              readOnly={readOnly}
              doc={doc}
              onChangeDoc={(patch) => updateDocAndRecalculate(patch)}
              projects={projects}
              deals={deals}
              employees={employees}
            />
          )}

          {activeSheet === 'manpower' && (
            <ManpowerSheet
              readOnly={readOnly}
              items={doc.manpowerPlans}
              onChangeItems={(items) => updateDocAndRecalculate({ manpowerPlans: items })}
              employees={employees}
              startDate={doc.startDate}
              endDate={doc.endDate}
            />
          )}

          {activeSheet === 'expenses' && (
            <DirectExpenseSheet
              readOnly={readOnly}
              items={doc.directExpenses}
              onChangeItems={(items) => updateDocAndRecalculate({ directExpenses: items })}
              totalMM={totalMM}
              headcount={doc.manpowerPlans.length}
            />
          )}

          {activeSheet === 'products' && (
            <ProductCostSheet
              readOnly={readOnly}
              items={doc.productCosts}
              onChangeItems={(items) => updateDocAndRecalculate({ productCosts: items })}
            />
          )}

          {activeSheet === 'outsourcing' && (
            <OutsourcingSheet
              readOnly={readOnly}
              items={doc.outsourcings}
              onChangeItems={(items) => updateDocAndRecalculate({ outsourcings: items })}
            />
          )}

          {activeSheet === 'risk' && (
            <RiskContingencySheet
              readOnly={readOnly}
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
              disabled={saving || readOnly}
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
