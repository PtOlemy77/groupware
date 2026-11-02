import type { DirectExpenseItem, FullContractDocument } from '@/types/groupware';

export type ExpenseCalculation = NonNullable<DirectExpenseItem['calculation']>;
export type ExpenseContext = Record<Exclude<ExpenseCalculation['source'], 'MANUAL'>, number>;
export interface ExpenseTemplate {
  code: string; account: string; group: string; method: ExpenseCalculation['method'];
  source: ExpenseCalculation['source']; baseLabel: string; multiplierLabel?: string; unitLabel: string;
}
const product = (code: string, account: string, group: string, source: ExpenseCalculation['source'] = 'MANUAL', baseLabel = '수량', multiplierLabel?: string, unitLabel = '단가 (천원)'): ExpenseTemplate => ({ code, account, group, method: 'PRODUCT', source, baseLabel, multiplierLabel, unitLabel });
const flat = (code: string, account: string, group: string) => product(code, account, group, 'MANUAL', '수량', undefined, '금액 (천원)');
const travel = (code: string, account: string): ExpenseTemplate => ({ code, account, group: '출장·교통', method: 'TRAVEL', source: 'MANUAL', baseLabel: '출장 인원', unitLabel: '' });
const insurance = (code: string, account: string): ExpenseTemplate => ({ code, account, group: '보증보험·기타', method: 'RATE', source: 'SUPPLY', baseLabel: '기준금액 (천원)', unitLabel: '' });

// 엑셀의 국내출장비·보증보험료 묶음은 상세 행만 합산해 중복 집계를 막는다.
export const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  product('TEMP_STAFF', '잡급(서무)', '인건·복리', 'MONTHS', '개월', '인원', '월 인건비 (천원)'),
  product('WELFARE', '복리/법정복리비', '인건·복리', 'OUR_MM', 'M/M', undefined, 'M/M당 비용 (천원)'),
  product('OVERTIME_MEAL', '복리/특근식대', '인건·복리', 'OUR_MM', 'M/M', '월 식수', '식대 (천원/식)'),
  product('MEETING', '복리/회의비', '인건·복리', 'HEADCOUNT', '인원', '회의 횟수', '1인 회의비 (천원)'),
  product('RECREATION', '복리/위안비', '인건·복리', 'HEADCOUNT', '인원', '횟수'),
  flat('WELFARE_OTHER', '기타', '인건·복리'),
  travel('TRAVEL_SENIOR', '국내출장비/부·차장'), travel('TRAVEL_STAFF', '국내출장비/과장 이하'), travel('TRAVEL_ABROAD', '해외출장비'),
  product('LOCAL_TRAVEL', '시내교통비', '출장·교통', 'OUR_MM', 'M/M', '월 횟수', '교통비 (천원/회)'),
  product('PM_LOCAL_TRAVEL', 'PM 시내교통비', '출장·교통', 'MONTHS', '개월', '월 횟수', '교통비 (천원/회)'),
  product('COMMUNICATION', '통신비', '사무실·통신', 'MONTHS', '개월', undefined, '월 비용 (천원)'),
  product('DEDICATED_LINE', '통신비(전용회선)', '사무실·통신', 'MONTHS', '개월', '회선 수', '월 회선료 (천원)'),
  product('OFFICE_RENT', '사무실 임차료', '사무실·통신', 'MONTHS', '개월', undefined, '월 임차료 (천원)'),
  product('OFFICE_MANAGEMENT', '사무실 관리비', '사무실·통신', 'MONTHS', '개월', undefined, '월 관리비 (천원)'),
  flat('OFFICE_CONSTRUCTION', '사무실 공사비', '사무실·통신'), flat('FEES', '지급수수료', '사무실·통신'),
  product('SUPPLIES_FURNITURE', '소모품비/비품', '소모품·교육'),
  product('SUPPLIES_OFFICE', '소모품비/전산,사무,기타', '소모품·교육', 'OUR_MM', 'M/M', undefined, 'M/M당 비용 (천원)'),
  product('SUPPLIES_OTHER', '소모품비/기타', '소모품·교육'),
  product('TRAINING', '교육훈련비(사외)', '소모품·교육', 'HEADCOUNT', '인원', '교육 횟수', '교육비 (천원/인)'),
  product('DEPRECIATION_IT', '감가상각/전산기기', '장비·임차', 'OUR_MM', 'M/M', undefined, 'M/M당 상각비 (천원)'),
  product('DEPRECIATION_IT_NEW', '감가상각/전산/신규', '장비·임차', 'MONTHS', '사용 개월', '대수', '월 상각비 (천원)'),
  product('DEPRECIATION_FURNITURE', '감가상각/집기비품', '장비·임차', 'OUR_MM', 'M/M', undefined, 'M/M당 상각비 (천원)'),
  product('DEPRECIATION_FURNITURE_NEW', '감가상각/비품/신규', '장비·임차', 'MONTHS', '사용 개월', '수량', '월 상각비 (천원)'),
  product('LEASE', '임차료/리스', '장비·임차', 'MONTHS', '개월', '대수', '월 리스료 (천원)'),
  product('SW_RENT', '임차료/SW', '장비·임차', 'MONTHS', '개월', '라이선스 수', '월 사용료 (천원)'),
  product('RENT_OTHER', '임차/기타', '장비·임차', 'MONTHS', '개월', '수량'),
  flat('STAMP_TAX', '세금/인지대', '세금·인쇄'), flat('TAX', '세금/세금', '세금·인쇄'), flat('PUBLIC_DUES', '세금/공과', '세금·인쇄'),
  product('BOOK_PRINT', '인쇄도서비', '세금·인쇄', 'MANUAL', '부수', '횟수'),
  product('DELIVERABLE_PRINT', '인쇄도서비/성과', '세금·인쇄', 'MANUAL', '권수', '횟수'),
  product('MANUAL', '매뉴얼작성비', '세금·인쇄', 'MANUAL', '건수'), product('REPORT', '보고서', '세금·인쇄', 'MANUAL', '부수', '횟수'),
  product('DESIGN', '설계서', '세금·인쇄', 'MANUAL', '부수', '횟수'), product('GUIDELINE', '지침서', '세금·인쇄', 'MANUAL', '부수', '횟수'),
  flat('REPAIR', '수선비', '보증보험·기타'), product('TRANSPORT', '운반비', '보증보험·기타', 'MANUAL', '횟수'),
  product('UTILITIES', '수도광열비', '보증보험·기타', 'MONTHS', '개월', undefined, '월 비용 (천원)'),
  insurance('CONTRACT_INSURANCE', '보증보험료(계약)'), insurance('WARRANTY_INSURANCE', '보증보험료(하자)'), insurance('ADVANCE_INSURANCE', '보증보험료(선금)'),
  product('EXTERNAL_EVENT', '잡비/사외행사', '보증보험·기타', 'HEADCOUNT', '인원', '횟수'),
];
export const EXPENSE_SOURCES: Record<ExpenseCalculation['source'], string> = {
  MANUAL: '직접 입력', TOTAL_MM: '전체 투입 M/M', OUR_MM: '당사·자사화 M/M', HEADCOUNT: '투입 인원', MONTHS: '계약 개월', SUPPLY: '공급가액',
};
export function expenseContext(doc: Pick<FullContractDocument, 'manpowerPlans' | 'startDate' | 'endDate' | 'supplyAmount'>): ExpenseContext {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(doc.startDate || '') ? doc.startDate! : '';
  const end = /^\d{4}-\d{2}-\d{2}$/.test(doc.endDate || '') ? doc.endDate! : '';
  const months = start && end && end >= start ? (Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7))+1 : 0;
  const mm = (plan: FullContractDocument['manpowerPlans'][number]) => plan.months.reduce((sum, value) => sum + value, 0);
  return {
    TOTAL_MM: doc.manpowerPlans.reduce((sum, plan) => sum + mm(plan), 0),
    OUR_MM: doc.manpowerPlans.filter(plan => plan.type !== '외주').reduce((sum, plan) => sum + mm(plan), 0),
    HEADCOUNT: new Set(doc.manpowerPlans.filter(plan => mm(plan) > 0).map(plan => plan.employeeId == null ? `row:${plan.id}` : `employee:${plan.employeeId}`)).size,
    MONTHS: months, SUPPLY: doc.supplyAmount,
  };
}
export const expenseMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function calculateExpense(row: DirectExpenseItem, context: ExpenseContext): DirectExpenseItem {
  if (!row.calculation) return row; // 기존 수량·단가·근거를 임의 변환하지 않는다.
  const calc = row.calculation;
  const base = calc.source === 'MANUAL' ? calc.base : context[calc.source];
  const v = (key: string, fallback = 0) => calc.inputs[key] ?? fallback;
  let qty = base, unitPrice = row.unitPrice, basis = '';
  if (calc.method === 'TRAVEL') {
    qty = base * v('trips', 1);
    unitPrice = v('days') * v('dailyCost') + v('nights') * v('lodgingCost') + v('transportCost');
    basis = `${base}명 × ${v('trips', 1)}회 × (${v('days')}일 × ${v('dailyCost')} + ${v('nights')}박 × ${v('lodgingCost')} + 교통 ${v('transportCost')})`;
  } else if (calc.method === 'RATE') {
    unitPrice = v('rate') / 100;
    basis = `${base}천원 × ${v('rate')}%`;
  } else {
    qty = base * v('multiplier', 1);
    basis = `${EXPENSE_SOURCES[calc.source]} ${base} × ${v('multiplier', 1)} × ${unitPrice}천원`;
  }
  return { ...row, calculation: { ...calc, base }, qty, unitPrice, amount: expenseMoney(qty * unitPrice), basis };
}
export function createExpense(template: ExpenseTemplate, context: ExpenseContext): DirectExpenseItem {
  const base = template.source === 'MANUAL' ? 1 : context[template.source];
  return calculateExpense({ id: `expense_${template.code}`, account: template.account, qty: 0, unitPrice: 0, amount: 0, basis: '', note: '', calculation: { categoryCode: template.code, method: template.method, source: template.source, base, inputs: template.method === 'TRAVEL' ? {trips:1} : template.method === 'RATE' ? {} : {multiplier:1} } }, context);
}
export function expenseRows(items: DirectExpenseItem[], context: ExpenseContext): DirectExpenseItem[] {
  const used = new Set<number>();
  const standard = EXPENSE_TEMPLATES.map(template => {
    const index = items.findIndex((item, i) => !used.has(i) && (item.calculation?.categoryCode === template.code || (!item.calculation && item.account === template.account)));
    if (index < 0) return createExpense(template, context);
    used.add(index); return calculateExpense(items[index], context);
  });
  return [...standard, ...items.filter((_, index) => !used.has(index)).map(row => calculateExpense(row, context))];
}
