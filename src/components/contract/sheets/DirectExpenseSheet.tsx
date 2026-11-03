'use client';
import React from 'react';
import { useModal } from '@/contexts/ModalContext';
import type { DirectExpenseItem } from '@/types/groupware';
import { EXPENSE_TEMPLATES, EXPENSE_SOURCES, calculateExpense, createExpense, expenseRows, expenseMoney, type ExpenseContext, type ExpenseCalculation } from '@/lib/direct-expenses';
import { RotateCcw } from 'lucide-react';

interface Props { items: DirectExpenseItem[]; onChangeItems: (items: DirectExpenseItem[]) => void; context: ExpenseContext; readOnly?: boolean; }
export default function DirectExpenseSheet({ items, onChangeItems, context, readOnly }: Props) {
  const { showConfirm } = useModal();
  const rows = expenseRows(items, context);
  const total = expenseMoney(rows.reduce((sum, row) => sum + row.amount, 0));
  const groups = [...new Set(EXPENSE_TEMPLATES.map(template => template.group)), '기존 추가 내역'];
  const update = (index: number, patch: Partial<DirectExpenseItem>) => onChangeItems(rows.map((row, i) => i === index ? calculateExpense({ ...row, ...patch }, context) : row));
  const inputClass = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-600';
  const numberField = (row: DirectExpenseItem, label: string, value: number, onChange: (value: number) => void, disabled = false) => <label className="w-28 max-w-full min-w-0 space-y-1"><span className="block text-xs font-medium text-slate-600">{label}</span><input aria-label={`${row.account} ${label}`} type="number" min="0" max={label === '보험 요율 (%)' ? 100 : undefined} step="0.01" value={value === 0 ? '' : value} placeholder="0" disabled={readOnly || disabled} onChange={event => onChange(Math.max(0, Number(event.target.value) || 0))} className={`${inputClass} text-right tabular-nums`} /></label>;
  const reset = async () => {
    if (!await showConfirm('직접경비 입력 금액과 단가를 모두 초기화하시겠습니까? 산출 기준과 비고는 유지합니다.', {isDanger:true, confirmText:'초기화'})) return;
    onChangeItems(rows.map(row => row.calculation ? calculateExpense({...row, unitPrice:0, calculation:{...row.calculation, inputs:{...row.calculation.inputs, rate:0, dailyCost:0, lodgingCost:0, transportCost:0}}}, context) : {...row, qty:0, amount:0}));
  };
  const convert = async (row: DirectExpenseItem, index: number) => {
    if (!await showConfirm('기존 수량·단가를 유지한 채 상세 산출식으로 전환합니다. 이후 M/M 연동 기준을 선택할 수 있습니다.', {confirmText:'전환'})) return;
    const template = EXPENSE_TEMPLATES[index];
    // 기존 금액의 의미가 바뀌지 않도록 직접 입력 곱셈 방식으로 시작한다.
    update(index, {calculation:{...createExpense(template, context).calculation!, method:'PRODUCT', source:'MANUAL', base:row.qty, inputs:{multiplier:1}}});
  };
  return <section aria-label="직접경비 산출" className="space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white pb-3">
      <div><h3 className="text-lg font-bold text-slate-900">직접경비 산출내역</h3><p className="mt-1 text-sm text-slate-600">전체 세부 항목 중 필요한 항목만 입력하세요. 미입력 단가·금액은 0원이며 금액 단위는 천원입니다.</p><p className="mt-2 text-xs text-slate-500">당사·자사화 {expenseMoney(context.OUR_MM)} M/M · 전체 {expenseMoney(context.TOTAL_MM)} M/M · 투입 {context.HEADCOUNT}명 · 계약 {context.MONTHS}개월</p></div>
      <div className="flex flex-wrap items-center gap-3"><div className="rounded-xl bg-indigo-50 px-4 py-3"><span className="text-xs text-indigo-700">직접경비 합계</span><strong data-testid="direct-expense-total" className="ml-3 text-lg text-indigo-800">{total.toLocaleString()} 천원</strong></div>{!readOnly && <button type="button" onClick={reset} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"><RotateCcw size={15}/>금액 초기화</button>}</div>
    </div>
    <p className="text-xs leading-relaxed text-slate-500">M/M·인원·계약 개월·공급가액을 기준으로 선택한 항목은 투입계획과 계약정보 변경 시 함께 계산됩니다. 별도 수량은 ‘직접 입력’을 선택하세요. 법정복리비 등 인건비 단가에 포함된 비용은 중복 입력하지 마세요.</p>
    <div role="region" aria-label="직접경비 목록 가로 스크롤" tabIndex={0} className="max-w-full overflow-x-auto border border-slate-200 bg-white">
      <table aria-label="직접경비 세부 항목" className="w-full min-w-[1000px] table-fixed text-left text-sm">
        <colgroup><col className="w-[17%]"/><col className="w-[17%]"/><col className="w-[40%]"/><col className="w-[11%]"/><col className="w-[15%]"/></colgroup>
        <thead className="border-b border-slate-300 bg-slate-100 text-xs text-slate-600"><tr><th scope="col" className="px-3 py-3">계정과목</th><th scope="col" className="px-3 py-3">산출 기준</th><th scope="col" className="px-3 py-3">산출 입력 · 근거</th><th scope="col" className="px-3 py-3 text-right">금액 (천원)</th><th scope="col" className="px-3 py-3">비고</th></tr></thead>
    {groups.map(group => {
      const groupRows = rows.map((row,index) => ({row,index})).filter(({index}) => index < EXPENSE_TEMPLATES.length ? EXPENSE_TEMPLATES[index].group === group : group === '기존 추가 내역');
      if (!groupRows.length) return null;
      return <tbody key={group} aria-label={group} className="divide-y divide-slate-100">
        <tr className="border-y border-slate-200 bg-slate-50"><th scope="rowgroup" colSpan={3} className="px-3 py-2 text-sm font-bold text-slate-700">{group}</th><td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-600">{expenseMoney(groupRows.reduce((sum,{row}) => sum+row.amount,0)).toLocaleString()}</td><td className="px-3 py-2 text-xs text-slate-500">소계</td></tr>
      {groupRows.map(({row,index}) => {
        const template = EXPENSE_TEMPLATES[index];
        const calc = row.calculation;
        const sources = calc?.method === 'RATE' ? ['SUPPLY', 'MANUAL'] : calc?.method === 'TRAVEL' ? ['MANUAL', 'HEADCOUNT'] : ['MANUAL', 'TOTAL_MM', 'OUR_MM', 'HEADCOUNT', 'MONTHS'];
        const baseLabel = calc?.method === 'RATE' ? '기준금액 (천원)' : calc?.method === 'TRAVEL' ? '출장 인원' : calc?.source === 'HEADCOUNT' ? '인원' : calc?.source === 'MONTHS' ? '개월' : calc?.source === 'TOTAL_MM' || calc?.source === 'OUR_MM' ? 'M/M' : template?.baseLabel || '수량';
        const editCalc = (patch: Partial<ExpenseCalculation>) => update(index, {calculation:{...calc!,...patch}});
        const editInput = (key: string, value: number) => editCalc({inputs:{...calc!.inputs,[key]:value}});
        return <tr key={row.id} data-expense-code={template?.code || 'LEGACY'} className={row.amount ? 'bg-indigo-50/20' : 'bg-white hover:bg-slate-50/50'}>
          <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-3 align-top font-semibold leading-relaxed text-slate-800">{row.account}</th>
          <td className="px-3 py-3 align-top">
            {calc ? <select aria-label={`${row.account} 산출 기준`} disabled={readOnly} value={calc.source} onChange={event=>editCalc({source:event.target.value as ExpenseCalculation['source'],base:calc.base})} className={inputClass}>{Object.entries(EXPENSE_SOURCES).filter(([source])=>sources.includes(source) || source===calc.source).map(([source,label])=><option key={source} value={source}>{label}</option>)}</select> : <><span className="text-xs text-slate-500">기존 수량 × 단가</span>{template && !readOnly && <button type="button" onClick={()=>convert(row,index)} className="mt-2 rounded border border-indigo-200 px-2 py-1 text-xs text-indigo-700">상세 산출식 사용</button>}</>}
          </td>
          <td className="px-3 py-3 align-top"><div className="flex flex-wrap items-end gap-x-2 gap-y-2">
          {!calc ? <>{numberField(row,'수량',row.qty,value=>update(index,{qty:value,amount:expenseMoney(value*row.unitPrice)}))}{numberField(row,'단가 (천원)',row.unitPrice,value=>update(index,{unitPrice:value,amount:expenseMoney(row.qty*value)}))}</> : <>
            {numberField(row,baseLabel,calc.base,value=>editCalc({base:value}),calc.source!=='MANUAL')}
            {calc.method==='PRODUCT' && <>{template?.multiplierLabel && numberField(row,template.multiplierLabel,calc.inputs.multiplier ?? 1,value=>editInput('multiplier',value))}{numberField(row,template?.unitLabel || '단가 (천원)',row.unitPrice,value=>update(index,{unitPrice:value}))}</>}
            {calc.method==='RATE' && numberField(row,'보험 요율 (%)',calc.inputs.rate || 0,value=>editInput('rate',value))}
            {calc.method==='TRAVEL' && <>{[['trips','출장 횟수'],['days','일수 (1회)'],['dailyCost','일비 (천원/일)'],['nights','숙박일수 (1회)'],['lodgingCost','숙박비 (천원/박)'],['transportCost','왕복 교통비 (천원/회)']].map(([key,label])=><React.Fragment key={key}>{numberField(row,label,calc.inputs[key] ?? (key==='trips'?1:0),value=>editInput(key,value))}</React.Fragment>)}</>}
          </>}
          </div>
          <p className="mt-2 break-words text-xs leading-relaxed text-slate-500">{row.basis || `${row.qty} × ${row.unitPrice}천원`}</p>
          {!calc && <input aria-label={`${row.account} 기존 산출 근거`} disabled={readOnly} value={row.basis} onChange={event=>update(index,{basis:event.target.value})} placeholder="산출 근거" className={`${inputClass} mt-2`}/>}
          </td>
          <td className="px-3 py-3 text-right align-top"><output aria-label={`${row.account} 산출금액`} className="whitespace-nowrap text-sm font-bold tabular-nums text-indigo-700">{row.amount.toLocaleString()} 천원</output></td>
          <td className="px-3 py-3 align-top"><input aria-label={`${row.account} 비고`} disabled={readOnly} value={row.note} onChange={event=>update(index,{note:event.target.value})} placeholder="선택 입력" className={inputClass}/></td>
        </tr>;
      })}</tbody>;
    })}
        <tfoot className="border-t-2 border-slate-300 bg-indigo-50"><tr><th scope="row" colSpan={3} className="px-3 py-3 font-bold text-slate-800">직접경비 합계</th><td className="px-3 py-3 text-right font-bold tabular-nums text-indigo-800">{total.toLocaleString()}</td><td className="px-3 py-3 text-xs text-slate-500">천원</td></tr></tfoot>
      </table>
    </div>
    <p className="text-xs text-slate-500 md:hidden">표를 좌우로 밀어 입력칸과 금액·비고를 확인할 수 있습니다.</p>
  </section>;
}
