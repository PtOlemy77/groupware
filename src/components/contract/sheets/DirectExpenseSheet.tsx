'use client';
import React from 'react';
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
      className="h-6 w-full min-w-0 border border-slate-200 bg-white px-1.5 text-right text-[12px] leading-none tabular-nums text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50" />
  );
  return <section aria-label="직접경비 산출" className="space-y-1.5 text-[12px] leading-tight">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-[12px] font-bold text-slate-800">직접경비</h3>
      <div className="flex items-center gap-3"><span>합계 <strong data-testid="direct-expense-total" className="font-bold tabular-nums text-indigo-700">{total.toLocaleString()} 천원</strong></span>
        {!readOnly && <button type="button" onClick={applyDefaults} className="border border-slate-300 px-2 py-1 text-[12px] text-slate-600">기본단가 적용</button>}
        {!readOnly && <button type="button" onClick={reset} className="border border-slate-300 px-2 py-1 text-[12px] text-slate-600">금액 초기화</button>}
      </div>
    </div>
    <div role="region" aria-label="직접경비 목록 가로 스크롤" tabIndex={0} className="max-w-full overflow-x-auto border border-slate-300 bg-white">
      <table aria-label="직접경비 세부 항목" className="w-full min-w-[560px] table-fixed text-left text-[12px]">
        <colgroup><col className="w-[34%]"/><col className="w-[19%]"/><col className="w-[19%]"/><col className="w-[12%]"/><col className="w-[16%]"/></colgroup>
        <thead className="border-b border-slate-300 bg-slate-100 text-slate-700"><tr>
          <th scope="col" className="px-2 py-1.5">계정과목</th><th scope="col" className="px-2 py-1.5 text-right">기준단위</th><th scope="col" className="px-2 py-1.5 text-right">기준금액 (천원)</th><th scope="col" className="px-2 py-1.5 text-right">횟수</th><th scope="col" className="px-2 py-1.5 text-right">금액 (천원)</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-200">{rows.map((row, index) => {
          const factors = compactExpenseFactors(row, EXPENSE_TEMPLATES[index]);
          return <tr key={row.id} data-expense-code={EXPENSE_TEMPLATES[index]?.code || 'LEGACY'} className={row.amount ? 'bg-indigo-50/20' : 'hover:bg-slate-50'}>
            <th scope="row" className="sticky left-0 z-10 truncate bg-white px-2 py-1 text-[12px] font-normal text-slate-800" title={row.account}>{row.account}</th>
            <td className="px-2 py-1"><div className="flex items-center gap-1">{numberField(row,index,'base','기준단위',factors.base)}<span className="w-6 shrink-0 text-right text-slate-500">{factors.unit}</span></div></td>
            <td className="px-2 py-1">{numberField(row,index,'unitPrice','기준금액',factors.unitPrice)}</td>
            <td className="px-2 py-1">{numberField(row,index,'count','횟수',factors.count)}</td>
            <td className="px-2 py-1 text-right"><output aria-label={`${row.account} 산출금액`} className="whitespace-nowrap tabular-nums text-indigo-700">{row.amount.toLocaleString()} 천원</output></td>
          </tr>;
        })}</tbody>
        <tfoot className="border-t-2 border-slate-300 bg-slate-100"><tr><th scope="row" colSpan={4} className="px-2 py-1.5 font-bold">합계</th><td className="px-2 py-1.5 text-right font-bold tabular-nums text-indigo-700">{total.toLocaleString()}</td></tr></tfoot>
      </table>
    </div>
  </section>;
}
