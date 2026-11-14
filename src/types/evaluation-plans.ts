/**
 * 성과평가(수행평가) 계획 및 실적 상태
 */
export type EvaluationPlanState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVISION_REQUIRED'
  | 'APPROVED'
  | 'RESULT_REVISION_REQUIRED'
  | 'RESULT_SUBMITTED'
  | 'EVALUATED';

/**
 * 성과평가 목표 항목
 */
export interface PerformanceGoal {
  id: string;
  category: string;
  title: string;
  criterion: string;
  direction: 'HIGHER' | 'LOWER' | 'MANUAL';
  target: number;
  unit: string;
  weight: number;
}

/**
 * 성과평가 실적 항목
 */
export interface PerformanceResult {
  goal_id: string;
  actual: number | null;
  evidence: string;
  score?: number;
  reason?: string;
}

/**
 * 개인별 성과평가 계획 및 평가 결과 문서
 */
export interface PerformancePlan {
  id: number;
  version: number;
  employee_id: number;
  employee_name: string;
  emp_no: string;
  project_id: number | null;
  project_name: string;
  assignment_id: number | null;
  reviewer_id: number;
  reviewer_name: string;
  kind: 'PROJECT' | 'POOL';
  state: EvaluationPlanState;
  title: string;
  start_date: string;
  end_date: string;
  goals: PerformanceGoal[];
  results: PerformanceResult[];
  planned_mm: Record<string, number>;
  actual_mm: Record<string, number>;
  review_comment: string;
  result_comment: string;
  score: number | null;
  performance_points: number | null;
  planned_mm_total: number;
  actual_mm_total: number;
  approved_on: string | null;
  approved_by: number | null;
  goals_hash: string | null;
  can_review: boolean;
  can_edit_goals: boolean;
  can_edit_results: boolean;
}

/**
 * 프로젝트 투입 배정 정보 (평가 대상 과업)
 */
export interface PerformanceAssignment {
  id: number;
  project_id: number;
  project_name: string;
  start_date: string;
  end_date: string;
  ended: boolean;
  pm_id: number;
  requires_executive: boolean;
  needs_plan: boolean;
  contract_doc_no?: string | null;
  synced_mm?: Record<string, number>;
  synced_total_mm?: number;
  progress?: number;
  stage_code?: string;
}

/**
 * 성과평가 목록 화면 응답 모델
 */
export interface PerformanceList {
  enabled: boolean;
  plans: PerformancePlan[];
  total: number;
  assignments: PerformanceAssignment[];
  pool_available: boolean;
  reviewers: {
    id: number;
    name: string;
    executive: boolean;
  }[];
  summary: {
    actual_mm: number;
    score: number | null;
    performance_points: number | null;
    contract_total_mm?: number;
    capacity_points?: number;
  };
}
