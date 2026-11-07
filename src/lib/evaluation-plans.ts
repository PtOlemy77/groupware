import type { PerformanceGoal, EvaluationPlanState } from '@/types/evaluation-plans';

/**
 * 평가 진행 상태별 한국어 라벨
 */
export const EVALUATION_STATES: Record<EvaluationPlanState, string> = {
  DRAFT: '목표 작성중',
  SUBMITTED: '목표 검토대기',
  REVISION_REQUIRED: '목표 보완요청',
  APPROVED: '목표 승인 · 실적 작성',
  RESULT_REVISION_REQUIRED: '실적 보완요청',
  RESULT_SUBMITTED: '실적 평가대기',
  EVALUATED: '평가 확정',
};

/**
 * 2026년 인사평가 제도 기준 기본 지표 템플릿 반환
 * - PROJECT: 직무 성과(35점), 업무 일정 준수(35점), 근태/소통/자기개발(30점)
 * - POOL: 인재풀 월별 수행 지표 (5개 영역 각 10점, 가점 50점)
 */
export function goalTemplates(kind: 'PROJECT' | 'POOL'): PerformanceGoal[] {
  if (kind === 'PROJECT') {
    return [
      {
        id: 'goal-1',
        category: 'WORK',
        title: '직무 성과',
        criterion: '1. 기본도 정비 및 WBS 공정 100% 달성 (15점)\n2. 계획 투입공수 대비 절감율 달성 (10점)\n3. 산출물 품질 관리 및 오류율 2% 미만 달성 (10점)',
        direction: 'HIGHER',
        target: 100,
        unit: '%',
        weight: 35,
      },
      {
        id: 'goal-2',
        category: 'SCHEDULE',
        title: '업무 일정 준수',
        criterion: '1. WBS 납기 일정 준수 (15점)\n2. 주간·월간 공정보고서 작성 및 제출 준수 (10점)\n3. 발주처 협의 및 산출물 관리 일정 준수 (10점)',
        direction: 'HIGHER',
        target: 100,
        unit: '%',
        weight: 35,
      },
      {
        id: 'goal-3',
        category: 'COLLABORATION',
        title: '근태/커뮤니케이션/자기개발',
        criterion: '1. 근태 관리 - 지각·결근 0건 및 계획적 연차 사용 (10점)\n2. 리스크·이슈 수시 보고 및 부서 간 협업 (10점)\n3. AI 도구 활용 및 직무 역량 개발 교육 이수 (10점)',
        direction: 'HIGHER',
        target: 100,
        unit: '%',
        weight: 30,
      },
    ];
  }

  return [
    {
      id: 'goal-1',
      category: 'SCHEDULE',
      title: '일정 준수',
      criterion: '전사 임직원 대상 업무 및 가점지표 해당 업무 일정 준수',
      direction: 'HIGHER',
      target: 100,
      unit: '%',
      weight: 10,
    },
    {
      id: 'goal-2',
      category: 'PLAN_REPORT',
      title: '계획 및 보고',
      criterion: 'WBS 연간목표 수립 및 주간 계획·보고서 작성 준수',
      direction: 'HIGHER',
      target: 100,
      unit: '%',
      weight: 10,
    },
    {
      id: 'goal-3',
      category: 'COMMUNICATION',
      title: '의사소통',
      criterion: '부서 간 협업, 전사 활동, 의사소통 필요 업무 수행',
      direction: 'HIGHER',
      target: 100,
      unit: '%',
      weight: 10,
    },
    {
      id: 'goal-4',
      category: 'DEVELOPMENT',
      title: '자기개발',
      criterion: '연간 목표 기반 사내외 교육훈련 이수 및 결과물 제출',
      direction: 'HIGHER',
      target: 40,
      unit: '시간',
      weight: 10,
    },
    {
      id: 'goal-5',
      category: 'COMPLIANCE',
      title: '규정 준수',
      criterion: '인재Pool 근무 가이드 및 사내 인사규정 준수',
      direction: 'HIGHER',
      target: 100,
      unit: '%',
      weight: 10,
    },
  ];
}

/**
 * 해당 연도의 1년 전체 12개월(01월 ~ 12월) 목록 반환 (YYYY-MM 형식)
 */
export function fullYearMonths(target: number | string): string[] {
  let targetYear: number;
  if (typeof target === 'number') {
    targetYear = target;
  } else {
    targetYear = Number(target.slice(0, 4));
    if (isNaN(targetYear)) {
      targetYear = new Date().getFullYear();
    }
  }
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return `${targetYear}-${String(month).padStart(2, '0')}`;
  });
}

/**
 * 시작일과 종료일 범위 내의 월 목록 반환 (YYYY-MM 형식)
 */
export function planMonths(startDate: string, endDate: string): string[] {
  const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormatRegex.test(startDate) || !dateFormatRegex.test(endDate) || endDate < startDate) {
    return [];
  }

  const startYear = Number(startDate.slice(0, 4));
  const startMonth = Number(startDate.slice(5, 7));
  const endYear = Number(endDate.slice(0, 4));
  const endMonth = Number(endDate.slice(5, 7));

  const startAbsoluteMonth = startYear * 12 + startMonth - 1;
  const endAbsoluteMonth = endYear * 12 + endMonth - 1;
  const monthCount = endAbsoluteMonth - startAbsoluteMonth + 1;

  // 최대 24개월까지만 지원
  if (monthCount > 24 || monthCount <= 0) {
    return [];
  }

  return Array.from({ length: monthCount }, (_, index) => {
    const currentAbsoluteMonth = startAbsoluteMonth + index;
    const year = Math.floor(currentAbsoluteMonth / 12);
    const month = (currentAbsoluteMonth % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
}

/**
 * 지표 목표값과 실적값을 바탕으로 달성 점수 자동 계산 (최대 100점)
 */
export function achievement(goal: PerformanceGoal, actual: number | null): number | null {
  if (actual === null || goal.direction === 'MANUAL') {
    return null;
  }

  let calculatedScore: number | null = null;

  if (goal.direction === 'LOWER') {
    // 낮을수록 좋은 지표 (예: 오류율)
    if (actual <= goal.target) {
      calculatedScore = 100;
    } else if (goal.target === 0) {
      calculatedScore = 0;
    } else {
      calculatedScore = (goal.target / actual) * 100;
    }
  } else {
    // 높을수록 좋은 지표 (예: 달성률, 수료시간)
    if (goal.target > 0) {
      calculatedScore = Math.min(100, (actual / goal.target) * 100);
    }
  }

  if (calculatedScore === null) {
    return null;
  }

  // 소수점 둘째 자리까지 반올림
  return Math.round(calculatedScore * 100) / 100;
}

/**
 * 목표 수정 가능 상태 여부
 */
export const goalsEditable = (state: EvaluationPlanState): boolean =>
  state === 'DRAFT' || state === 'REVISION_REQUIRED';

/**
 * 실적 입력 가능 상태 여부
 */
export const resultsEditable = (state: EvaluationPlanState): boolean =>
  state === 'APPROVED' || state === 'RESULT_REVISION_REQUIRED';
