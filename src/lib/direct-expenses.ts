import type { DirectExpenseItem, FullContractDocument } from '@/types/groupware';

export type ExpenseCalculation = NonNullable<DirectExpenseItem['calculation']>;
export type ExpenseContext = Record<Exclude<ExpenseCalculation['source'], 'MANUAL'>, number>;

export interface ExpenseTemplate {
  code: string;
  account: string;
  group: string;
  method: ExpenseCalculation['method'];
  source: ExpenseCalculation['source'];
  baseLabel: string;
  multiplierLabel?: string;
  unitLabel: string;
}

function createProductTemplate(
  code: string,
  account: string,
  group: string,
  source: ExpenseCalculation['source'] = 'MANUAL',
  baseLabel = '수량',
  multiplierLabel?: string,
  unitLabel = '단가 (천원)',
): ExpenseTemplate {
  return {
    code,
    account,
    group,
    method: 'PRODUCT',
    source,
    baseLabel,
    multiplierLabel,
    unitLabel,
  };
}

function createFlatTemplate(
  code: string,
  account: string,
  group: string,
): ExpenseTemplate {
  return createProductTemplate(
    code,
    account,
    group,
    'MANUAL',
    '수량',
    undefined,
    '금액 (천원)',
  );
}

function createTravelTemplate(code: string, account: string): ExpenseTemplate {
  return {
    code,
    account,
    group: '출장·교통',
    method: 'TRAVEL',
    source: 'MANUAL',
    baseLabel: '출장 인원',
    unitLabel: '',
  };
}

function createInsuranceTemplate(code: string, account: string): ExpenseTemplate {
  return {
    code,
    account,
    group: '보증보험·기타',
    method: 'RATE',
    source: 'SUPPLY',
    baseLabel: '기준금액 (천원)',
    unitLabel: '',
  };
}

// 엑셀의 국내출장비·보증보험료 묶음은 상세 행만 합산해 중복 집계를 막는다.
export const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  createProductTemplate('TEMP_STAFF', '잡급(서무)', '인건·복리', 'MONTHS', '개월', '인원', '월 인건비 (천원)'),
  createProductTemplate('WELFARE', '복리/법정복리비', '인건·복리', 'OUR_MM', 'M/M', undefined, 'M/M당 비용 (천원)'),
  createProductTemplate('OVERTIME_MEAL', '복리/특근식대', '인건·복리', 'OUR_MM', 'M/M', '월 식수', '식대 (천원/식)'),
  createProductTemplate('MEETING', '복리/회의비', '인건·복리', 'HEADCOUNT', '인원', '회의 횟수', '1인 회의비 (천원)'),
  createProductTemplate('RECREATION', '복리/위안비', '인건·복리', 'HEADCOUNT', '인원', '횟수'),
  createFlatTemplate('WELFARE_OTHER', '기타', '인건·복리'),
  createTravelTemplate('TRAVEL_SENIOR', '국내출장비/부·차장'),
  createTravelTemplate('TRAVEL_STAFF', '국내출장비/과장 이하'),
  createTravelTemplate('TRAVEL_ABROAD', '해외출장비'),
  createProductTemplate('LOCAL_TRAVEL', '시내교통비', '출장·교통', 'OUR_MM', 'M/M', '월 횟수', '교통비 (천원/회)'),
  createProductTemplate('PM_LOCAL_TRAVEL', 'PM 시내교통비', '출장·교통', 'MONTHS', '개월', '월 횟수', '교통비 (천원/회)'),
  createProductTemplate('COMMUNICATION', '통신비', '사무실·통신', 'MONTHS', '개월', undefined, '월 비용 (천원)'),
  createProductTemplate('DEDICATED_LINE', '통신비(전용회선)', '사무실·통신', 'MONTHS', '개월', '회선 수', '월 회선료 (천원)'),
  createProductTemplate('OFFICE_RENT', '사무실 임차료', '사무실·통신', 'MONTHS', '개월', undefined, '월 임차료 (천원)'),
  createProductTemplate('OFFICE_MANAGEMENT', '사무실 관리비', '사무실·통신', 'MONTHS', '개월', undefined, '월 관리비 (천원)'),
  createFlatTemplate('OFFICE_CONSTRUCTION', '사무실 공사비', '사무실·통신'),
  createFlatTemplate('FEES', '지급수수료', '사무실·통신'),
  createProductTemplate('SUPPLIES_FURNITURE', '소모품비/비품', '소모품·교육'),
  createProductTemplate('SUPPLIES_OFFICE', '소모품비/전산,사무,기타', '소모품·교육', 'OUR_MM', 'M/M', undefined, 'M/M당 비용 (천원)'),
  createProductTemplate('SUPPLIES_OTHER', '소모품비/기타', '소모품·교육'),
  createProductTemplate('TRAINING', '교육훈련비(사외)', '소모품·교육', 'HEADCOUNT', '인원', '교육 횟수', '교육비 (천원/인)'),
  createProductTemplate('DEPRECIATION_IT', '감가상각/전산기기', '장비·임차', 'OUR_MM', 'M/M', undefined, 'M/M당 상각비 (천원)'),
  createProductTemplate('DEPRECIATION_IT_NEW', '감가상각/전산/신규', '장비·임차', 'MONTHS', '사용 개월', '대수', '월 상각비 (천원)'),
  createProductTemplate('DEPRECIATION_FURNITURE', '감가상각/집기비품', '장비·임차', 'OUR_MM', 'M/M', undefined, 'M/M당 상각비 (천원)'),
  createProductTemplate('DEPRECIATION_FURNITURE_NEW', '감가상각/비품/신규', '장비·임차', 'MONTHS', '사용 개월', '수량', '월 상각비 (천원)'),
  createProductTemplate('LEASE', '임차료/리스', '장비·임차', 'MONTHS', '개월', '대수', '월 리스료 (천원)'),
  createProductTemplate('SW_RENT', '임차료/SW', '장비·임차', 'MONTHS', '개월', '라이선스 수', '월 사용료 (천원)'),
  createProductTemplate('RENT_OTHER', '임차/기타', '장비·임차', 'MONTHS', '개월', '수량'),
  createFlatTemplate('STAMP_TAX', '세금/인지대', '세금·인쇄'),
  createFlatTemplate('TAX', '세금/세금', '세금·인쇄'),
  createFlatTemplate('PUBLIC_DUES', '세금/공과', '세금·인쇄'),
  createProductTemplate('BOOK_PRINT', '인쇄도서비', '세금·인쇄', 'MANUAL', '부수', '횟수'),
  createProductTemplate('DELIVERABLE_PRINT', '인쇄도서비/성과', '세금·인쇄', 'MANUAL', '권수', '횟수'),
  createProductTemplate('MANUAL', '매뉴얼작성비', '세금·인쇄', 'MANUAL', '건수'),
  createProductTemplate('REPORT', '보고서', '세금·인쇄', 'MANUAL', '부수', '횟수'),
  createProductTemplate('DESIGN', '설계서', '세금·인쇄', 'MANUAL', '부수', '횟수'),
  createProductTemplate('GUIDELINE', '지침서', '세금·인쇄', 'MANUAL', '부수', '횟수'),
  createFlatTemplate('REPAIR', '수선비', '보증보험·기타'),
  createProductTemplate('TRANSPORT', '운반비', '보증보험·기타', 'MANUAL', '횟수'),
  createProductTemplate('UTILITIES', '수도광열비', '보증보험·기타', 'MONTHS', '개월', undefined, '월 비용 (천원)'),
  createInsuranceTemplate('CONTRACT_INSURANCE', '보증보험료(계약)'),
  createInsuranceTemplate('WARRANTY_INSURANCE', '보증보험료(하자)'),
  createInsuranceTemplate('ADVANCE_INSURANCE', '보증보험료(선금)'),
  createProductTemplate('EXTERNAL_EVENT', '잡비/사외행사', '보증보험·기타', 'HEADCOUNT', '인원', '횟수'),
];

export const EXPENSE_SOURCES: Record<ExpenseCalculation['source'], string> = {
  MANUAL: '직접 입력',
  TOTAL_MM: '전체 투입 M/M',
  OUR_MM: '당사·자사화 M/M',
  HEADCOUNT: '투입 인원',
  MONTHS: '계약 개월',
  SUPPLY: '공급가액',
};

/**
 * 계약문서(인력계획, 기간, 공급가액)로부터 직접경비 자동 산출 기준값(M/M, 인원, 개월 수 등)을 계산한다.
 */
export function expenseContext(
  doc: Pick<FullContractDocument, 'manpowerPlans' | 'startDate' | 'endDate' | 'supplyAmount'>,
): ExpenseContext {
  const isIsoDate = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
  const start = isIsoDate(doc.startDate) ? doc.startDate! : '';
  const end = isIsoDate(doc.endDate) ? doc.endDate! : '';

  let contractMonths = 0;
  if (start && end && end >= start) {
    const startYear = Number(start.slice(0, 4));
    const startMonth = Number(start.slice(5, 7));
    const endYear = Number(end.slice(0, 4));
    const endMonth = Number(end.slice(5, 7));
    contractMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  }

  const sumPlanMonths = (plan: FullContractDocument['manpowerPlans'][number]) => {
    return plan.months.reduce((sum, value) => sum + value, 0);
  };

  const totalMm = doc.manpowerPlans.reduce((sum, plan) => sum + sumPlanMonths(plan), 0);
  const ourMm = doc.manpowerPlans
    .filter((plan) => plan.type !== '외주')
    .reduce((sum, plan) => sum + sumPlanMonths(plan), 0);

  const uniquePersonnelKeys = new Set(
    doc.manpowerPlans
      .filter((plan) => sumPlanMonths(plan) > 0)
      .map((plan) =>
        plan.employeeId == null ? `row:${plan.id}` : `employee:${plan.employeeId}`,
      ),
  );

  return {
    TOTAL_MM: totalMm,
    OUR_MM: ourMm,
    HEADCOUNT: uniquePersonnelKeys.size,
    MONTHS: contractMonths,
    SUPPLY: doc.supplyAmount,
  };
}

/**
 * 소수 둘째 자리(전 단위 정밀도)로 경비 금액을 반올림한다.
 */
export const expenseMoney = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/**
 * 단일 직접경비 행의 산출방식(PRODUCT / TRAVEL / RATE)에 따라 수량·단가·금액·산출근거 문자열을 계산한다.
 */
export function calculateExpense(
  row: DirectExpenseItem,
  context: ExpenseContext,
): DirectExpenseItem {
  // 기존 레거시 행(calculation 정보 없음)은 수량·단가·근거를 임의 변환하지 않는다.
  if (!row.calculation) {
    return row;
  }

  const calc = row.calculation;
  const base = calc.source === 'MANUAL' ? calc.base : context[calc.source];
  const getInput = (key: string, fallback = 0) => calc.inputs[key] ?? fallback;

  let qty = base;
  let unitPrice = row.unitPrice;
  let basis = '';

  if (calc.method === 'TRAVEL') {
    const trips = getInput('trips', 1);
    const days = getInput('days');
    const dailyCost = getInput('dailyCost');
    const nights = getInput('nights');
    const lodgingCost = getInput('lodgingCost');
    const transportCost = getInput('transportCost');

    qty = base * trips;
    unitPrice = days * dailyCost + nights * lodgingCost + transportCost;
    basis = `${base}명 × ${trips}회 × (${days}일 × ${dailyCost} + ${nights}박 × ${lodgingCost} + 교통 ${transportCost})`;
  } else if (calc.method === 'RATE') {
    const ratePercent = getInput('rate');
    unitPrice = ratePercent / 100;
    basis = `${base}천원 × ${ratePercent}%`;
  } else {
    const multiplier = getInput('multiplier', 1);
    qty = base * multiplier;
    basis = `${EXPENSE_SOURCES[calc.source]} ${base} × ${multiplier} × ${unitPrice}천원`;
  }

  return {
    ...row,
    calculation: { ...calc, base },
    qty,
    unitPrice,
    amount: expenseMoney(qty * unitPrice),
    basis,
  };
}

// 직접경비 D6/D7/D14/D15/D22/D23/D26/D31 및 단가표 E48/F48 (천원).
// 단가가 아닌 해당 계약의 비용 총액·인원·공수는 기본값으로 복사하지 않는다.
export const EXPENSE_REFERENCE_DEFAULTS: Record<
  string,
  { unitPrice: number } | { ratePercent: number }
> = {
  OVERTIME_MEAL: { unitPrice: 10 },
  MEETING: { unitPrice: 70 },
  LOCAL_TRAVEL: { unitPrice: 50 },
  PM_LOCAL_TRAVEL: { unitPrice: 200 },
  SUPPLIES_FURNITURE: { unitPrice: 100 },
  SUPPLIES_OFFICE: { unitPrice: 15 },
  DEPRECIATION_IT: { unitPrice: 20 },
  SW_RENT: { unitPrice: 50 },
  TRAVEL_SENIOR: { unitPrice: 187.8 },
  TRAVEL_STAFF: { unitPrice: 178.8 },
  CONTRACT_INSURANCE: { ratePercent: 0.3 },
  WARRANTY_INSURANCE: { ratePercent: 0.27 },
  ADVANCE_INSURANCE: { ratePercent: 0.42 },
};

/**
 * 템플릿 코드에 정의된 기준 단가(천원) 또는 공급가액 비율 기반 참고 단가를 반환한다.
 */
export function referenceExpenseUnitPrice(
  template: ExpenseTemplate,
  context: ExpenseContext,
): number | undefined {
  const reference = EXPENSE_REFERENCE_DEFAULTS[template.code];
  if (!reference) {
    return undefined;
  }

  if ('unitPrice' in reference) {
    return reference.unitPrice;
  }

  return expenseMoney((context.SUPPLY * reference.ratePercent) / 100);
}

/**
 * 표준 템플릿으로부터 초기 직접경비 행(횟수 0, 참고 단가 세팅)을 생성한다.
 */
export function createExpense(
  template: ExpenseTemplate,
  context: ExpenseContext,
): DirectExpenseItem {
  const source = template.method === 'PRODUCT' ? template.source : 'MANUAL';
  const base = source === 'MANUAL' ? 1 : context[source];

  return calculateExpense(
    {
      id: `expense_${template.code}`,
      account: template.account,
      qty: 0,
      unitPrice: referenceExpenseUnitPrice(template, context) ?? 0,
      amount: 0,
      basis: '',
      note: '',
      calculation: {
        categoryCode: template.code,
        method: 'PRODUCT',
        source,
        base,
        inputs: { multiplier: 0 },
      },
    },
    context,
  );
}

/**
 * 저장된 직접경비 목록을 표준 템플릿 순서에 맞춰 병합하고, 사용자 추가/중복 행도 누락 없이 유지한다.
 */
export function expenseRows(
  items: DirectExpenseItem[],
  context: ExpenseContext,
): DirectExpenseItem[] {
  const usedIndexes = new Set<number>();

  const standardRows = EXPENSE_TEMPLATES.map((template) => {
    const matchedIndex = items.findIndex((item, index) => {
      if (usedIndexes.has(index)) {
        return false;
      }
      if (item.calculation?.categoryCode === template.code) {
        return true;
      }
      return !item.calculation && item.account === template.account;
    });

    if (matchedIndex < 0) {
      return createExpense(template, context);
    }

    usedIndexes.add(matchedIndex);
    return calculateExpense(items[matchedIndex], context);
  });

  const customRows = items
    .filter((_, index) => !usedIndexes.has(index))
    .map((row) => calculateExpense(row, context));

  return [...standardRows, ...customRows];
}

/**
 * 간단 입력 화면에 표시할 기준 단위 문자열(MM, 명, 개월 등)을 판별한다.
 */
function resolveCompactUnit(
  source: ExpenseCalculation['source'],
  method?: ExpenseCalculation['method'],
  templateBaseLabel?: string,
): string {
  if (source === 'TOTAL_MM' || source === 'OUR_MM') {
    return 'MM';
  }
  if (source === 'HEADCOUNT' || method === 'TRAVEL') {
    return '명';
  }
  if (source === 'MONTHS') {
    return '개월';
  }

  const label = templateBaseLabel || '';
  if (label.includes('M/M')) {
    return 'MM';
  }
  if (label.includes('인원')) {
    return '명';
  }
  if (label.includes('개월')) {
    return '개월';
  }

  switch (label) {
    case '부수':
      return '부';
    case '권수':
      return '권';
    case '건수':
      return '건';
    case '횟수':
      return '회';
    case 'MM':
      return 'MM';
    case '명':
      return '명';
    default:
      return '식';
  }
}

// 간단 입력 화면은 기존 상세 산출값을 읽기만 하며, 해당 행을 편집할 때만 곱셈식으로 전환한다.
export function compactExpenseFactors(
  row: DirectExpenseItem,
  template?: ExpenseTemplate,
) {
  const calc = row.calculation;
  if (calc?.method === 'RATE') {
    return {
      base: 1,
      unitPrice: row.amount,
      count: 1,
      unit: '식',
    };
  }

  const source = calc?.source || 'MANUAL';
  const unit = resolveCompactUnit(source, calc?.method, template?.baseLabel);
  const countInputKey = calc?.method === 'TRAVEL' ? 'trips' : 'multiplier';

  return {
    base: calc?.base ?? row.qty,
    unitPrice: row.unitPrice,
    count: calc?.inputs[countInputKey] ?? 1,
    unit,
  };
}

/**
 * 간단 입력 화면에서 기준수량(base)·단가(unitPrice)·횟수(count) 중 하나를 수정하고 재계산한다.
 */
export function updateCompactExpense(
  row: DirectExpenseItem,
  context: ExpenseContext,
  field: 'base' | 'unitPrice' | 'count',
  value: number,
  template?: ExpenseTemplate,
): DirectExpenseItem {
  const factors = {
    ...compactExpenseFactors(row, template),
    [field]: value,
  };

  // 기준수량을 직접 수정하거나 기존 요율(RATE) 항목을 금액 수정하면 수동 입력(MANUAL)으로 전환
  const keepAutomaticSource =
    field !== 'base' && row.calculation?.method !== 'RATE';
  const source = keepAutomaticSource
    ? row.calculation?.source || 'MANUAL'
    : 'MANUAL';

  return calculateExpense(
    {
      ...row,
      unitPrice: factors.unitPrice,
      calculation: {
        ...row.calculation,
        categoryCode:
          row.calculation?.categoryCode || template?.code || row.id,
        method: 'PRODUCT',
        source,
        base: factors.base,
        inputs: {
          ...row.calculation?.inputs,
          multiplier: factors.count,
        },
      },
    },
    context,
  );
}

/**
 * 모든 표준 경비 행에 기준 단가표 기본값을 일괄 적용한다.
 */
export function applyReferenceExpenseDefaults(
  items: DirectExpenseItem[],
  context: ExpenseContext,
): DirectExpenseItem[] {
  return expenseRows(items, context).map((row, index) => {
    const template = EXPENSE_TEMPLATES[index];
    const referencePrice = template
      ? referenceExpenseUnitPrice(template, context)
      : undefined;

    if (referencePrice === undefined) {
      return row;
    }

    return updateCompactExpense(row, context, 'unitPrice', referencePrice, template);
  });
}
