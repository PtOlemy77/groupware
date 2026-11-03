'use client';
import React from 'react';
import { Calculator, RefreshCw, RotateCcw } from 'lucide-react';
import { useModal } from '@/contexts/ModalContext';
import type { DirectExpenseItem } from '@/types/groupware';
import { EXPENSE_TEMPLATES, applyReferenceExpenseDefaults, calculateExpense, expenseRows, expenseMoney, compactExpenseFactors, updateCompactExpense, type ExpenseContext } from '@/lib/direct-expenses';

interface Props {
  items: DirectExpenseItem[];
  onChangeItems: (items: DirectExpenseItem[]) => void;
  context: ExpenseContext;
  readOnly?: boolean;
}
export default function DirectExpenseSheet({ items, onChangeItems, context, readOnly }: Props) {
  const { showConfirm } = useModal();
  const rows = expenseRows(items, context);
  const total = expenseMoney(rows.reduce((sum, row) => sum + row.amount, 0));
  const update = (index: number, field: 'base' | 'unitPrice' | 'count', value: number) => {
    onChangeItems(rows.map((row, i) => i === index ? updateCompactExpense(row, context, field, value, EXPENSE_TEMPLATES[index]) : row));
  };
  const reset = async () => {
    if (!await showConfirm('직접경비 금액을 모두 초기화하시겠습니까?', { isDanger: true, confirmText: '초기화' })) return;
    onChangeItems(rows.map(row => row.calculation ? calculateExpense({ ...row, unitPrice: 0, calculation: { ...row.calculation, inputs: { ...row.calculation.inputs, rate: 0, dailyCost: 0, lodgingCost: 0, transportCost: 0 } } }, context) : { ...row, unitPrice: 0, amount: 0 }));
  };
  const applyDefaults = async () => {
    if (!await showConfirm('엑셀에 기준단가가 있는 항목의 기준금액을 적용합니다. 기존 기준금액은 변경되며 기준단위와 횟수는 유지됩니다.', { confirmText: '적용' })) return;
    onChangeItems(applyReferenceExpenseDefaults(items, context));
  };
  const numberField = (row: DirectExpenseItem, index: number, field: 'base' | 'unitPrice' | 'count', label: string, value: number) => (
    <input aria-label={`${row.account} ${label}`} type="number" min="0" step="any" value={value === 0 ? '' : value} placeholder="0" disabled={readOnly}
      onChange={event => update(index, field, Math.max(0, Number(event.target.value) || 0))}
      className="h-8 w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/60 px-2 text-right text-sm tabular-nums text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:text-slate-500" />
  );
  return <section aria-label="직접경비 산출" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-2xs">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Calculator className="h-4 w-4 text-indigo-600"/>직접경비</h3>
      <div className="flex flex-wrap items-center gap-2"><div className="flex items-baseline gap-2 rounded-lg bg-indigo-50 px-3 py-1.5"><span className="text-xs font-medium text-indigo-700">합계</span><strong data-testid="direct-expense-total" className="text-base font-bold tabular-nums text-indigo-700">{total.toLocaleString()} 천원</strong></div>
        {!readOnly && <button type="button" onClick={applyDefaults} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-500"><RefreshCw className="h-3.5 w-3.5"/>기본단가 적용</button>}
        {!readOnly && <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500"><RotateCcw className="h-3.5 w-3.5"/>금액 초기화</button>}
      </div>
    </div>
    <div role="region" aria-label="직접경비 목록 가로 스크롤" tabIndex={0} className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table aria-label="직접경비 세부 항목" className="w-full min-w-[680px] table-fixed text-left text-sm">
        <colgroup><col className="w-[34%]"/><col className="w-[19%]"/><col className="w-[19%]"/><col className="w-[12%]"/><col className="w-[16%]"/></colgroup>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600"><tr>
          <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5">계정과목</th><th scope="col" className="px-3 py-2.5 text-right">기준단위</th><th scope="col" className="px-3 py-2.5 text-right">기준금액 (천원)</th><th scope="col" className="px-3 py-2.5 text-right">횟수</th><th scope="col" className="px-3 py-2.5 text-right">금액 (천원)</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((row, index) => {
          const factors = compactExpenseFactors(row, EXPENSE_TEMPLATES[index]);
          return <tr key={row.id} data-expense-code={EXPENSE_TEMPLATES[index]?.code || 'LEGACY'} className={row.amount ? 'bg-indigo-50/30' : 'transition hover:bg-slate-50/60'}>
            <th scope="row" className="sticky left-0 z-10 truncate bg-white px-3 py-1 text-sm font-medium text-slate-800" title={row.account}>{row.account}</th>
            <td className="px-3 py-1"><div className="flex items-center gap-1.5">{numberField(row,index,'base','기준단위',factors.base)}<span className="w-7 shrink-0 text-right text-xs text-slate-500">{factors.unit}</span></div></td>
            <td className="px-3 py-1">{numberField(row,index,'unitPrice','기준금액',factors.unitPrice)}</td>
            <td className="px-3 py-1">{numberField(row,index,'count','횟수',factors.count)}</td>
            <td className="px-3 py-1 text-right"><output aria-label={`${row.account} 산출금액`} className="whitespace-nowrap font-semibold tabular-nums text-indigo-700">{row.amount.toLocaleString()}</output></td>
          </tr>;
        })}</tbody>
        <tfoot className="border-t border-slate-200 bg-slate-50"><tr><th scope="row" colSpan={4} className="px-3 py-3 font-bold text-slate-700">합계</th><td className="px-3 py-3 text-right font-bold tabular-nums text-indigo-700">{total.toLocaleString()}</td></tr></tfoot>
      </table>
    </div>
  </section>;
}
