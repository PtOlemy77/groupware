export interface CommonCode {
  version?: number;
  id: number;
  group_code: string;
  group_name: string;
  code: string;
  code_name: string;
  sort_order: number;
  is_active: boolean;
  extra_value?: string;
}

export interface DepartmentCodeInfo {
  code: string;
  label: string;
  parent_code: string;
  sort_order: number;
}

export interface PositionCodeInfo {
  code: string;
  label: string;
  level: number;
}

export type RoleCode = 'ROLE_ADMIN' | 'ROLE_EXEC' | 'ROLE_PM' | 'ROLE_STAFF';

export type UserRole =
  | '시스템 관리자'
  | '임원 권한'
  | 'PM 권한'
  | '일반직원'
  | '관리자 권한'
  | '경영팀 권한';

export interface RoleCodeInfo {
  code: RoleCode;
  label: '시스템 관리자' | '임원 권한' | 'PM 권한' | '일반직원';
  rank: number; // 4: 시스템 관리자, 3: 임원 권한, 2: PM 권한, 1: 일반직원
  desc: string;
}

export const USER_ROLE_CODES: RoleCodeInfo[] = [
  {
    code: 'ROLE_ADMIN',
    label: '시스템 관리자',
    rank: 4,
    desc: '시스템 설정, 기준정보(노임단가·공통코드), 임직원 계정·권한 총괄 관리',
  },
  {
    code: 'ROLE_EXEC',
    label: '임원 권한',
    rank: 3,
    desc: '이사급 이상 임원 — 계약품의서 최종 승인·반려, 인사평가 확정, 전사 경영 총괄',
  },
  {
    code: 'ROLE_PM',
    label: 'PM 권한',
    rank: 2,
    desc: 'PM 직군(부장·차장·과장) — 사업·프로젝트 생성·수정, 계약품의서 작성 및 인력 편성',
  },
  {
    code: 'ROLE_STAFF',
    label: '일반직원',
    rank: 1,
    desc: '일반 실무자(대리·담당) — 소속 프로젝트·조직도·투입공수 조회 및 업무 수행',
  },
];

// 코드 기반 권한 판정 헬퍼
export function getRoleCode(userOrRole?: AuthUser | Employee | string | null): RoleCode {
  if (!userOrRole) return 'ROLE_STAFF';
  let raw: string;
  if (typeof userOrRole === 'object') {
    if (userOrRole.role_code) return normalizeRoleCode(userOrRole.role_code);
    raw = userOrRole.role || '';
  } else {
    raw = userOrRole;
  }
  return normalizeRoleCode(raw);
}

function normalizeRoleCode(raw: string): RoleCode {
  const val = (raw || '').trim();
  if (
    val === 'ROLE_ADMIN' ||
    val === 'ROLE_SYS_ADMIN' ||
    val === '시스템 관리자' ||
    val === '관리자 권한' ||
    val === '경영팀 권한'
  ) {
    return 'ROLE_ADMIN';
  }
  if (val === 'ROLE_EXEC' || val === '임원 권한') {
    return 'ROLE_EXEC';
  }
  if (val === 'ROLE_PM' || val === 'PM 권한') {
    return 'ROLE_PM';
  }
  return 'ROLE_STAFF';
}

// 권한 정규화 헬퍼 (라벨 표기용)
export function normalizeUserRole(
  userOrRole?: AuthUser | Employee | string | null,
  _position?: string
): '시스템 관리자' | '임원 권한' | 'PM 권한' | '일반직원' {
  const code = getRoleCode(userOrRole);
  switch (code) {
    case 'ROLE_ADMIN':
      return '시스템 관리자';
    case 'ROLE_EXEC':
      return '임원 권한';
    case 'ROLE_PM':
      return 'PM 권한';
    default:
      return '일반직원';
  }
}

// 1단계(최상위): 시스템 관리자 여부 (코드 비교)
export function isSystemAdmin(userOrRole?: AuthUser | Employee | string | null): boolean {
  return getRoleCode(userOrRole) === 'ROLE_ADMIN';
}

// 2단계: 임원 권한 이상 (시스템 관리자 + 임원 권한)
export function isExecutiveOrAbove(userOrRole?: AuthUser | Employee | string | null, _position?: string): boolean {
  const code = getRoleCode(userOrRole);
  return code === 'ROLE_ADMIN' || code === 'ROLE_EXEC';
}

// 3단계: PM 권한 이상 (시스템 관리자 + 임원 권한 + PM 권한)
export function isPmOrAbove(userOrRole?: AuthUser | Employee | string | null, _position?: string): boolean {
  const code = getRoleCode(userOrRole);
  return code === 'ROLE_ADMIN' || code === 'ROLE_EXEC' || code === 'ROLE_PM';
}

// 직급 서열 및 입사일 기준 정렬 비교 함수
export function compareEmployeesByPositionAndHireDate(a: Employee, b: Employee): number {
  const getLevel = (emp: Employee) => {
    if (emp.position_code) {
      const p = POSITION_CODES.find((x) => x.code === emp.position_code);
      if (p) return p.level;
    }
    const byLabel = POSITION_CODES.find((x) => x.label === emp.position);
    return byLabel ? byLabel.level : 0;
  };
  const levelA = getLevel(a);
  const levelB = getLevel(b);
  if (levelB !== levelA) {
    return levelB - levelA; // 높은 직급 우선 (사장 -> 이사 -> 부장 -> 차장 -> 과장 -> 대리 -> 담당)
  }
  // 직급이 같으면 입사일 오름차순 (오래된 빠른 입사일 먼저)
  const dateA = a.hire_date || '';
  const dateB = b.hire_date || '';
  return dateA.localeCompare(dateB);
}

export interface AuthUser {
  password_change_required?: boolean;
  id: number;
  emp_no: string;
  name: string;
  department_code: string;
  department: string;
  position_code: string;
  position: string;
  email: string;
  phone: string;
  role: UserRole;
  role_code?: RoleCode;
}

export type StatusCode = 'STATUS_ACTIVE' | 'STATUS_LEAVE' | 'STATUS_RETIRED';

export interface StatusCodeInfo {
  code: StatusCode;
  label: '재직' | '휴직' | '퇴사';
  sort_order: number;
}

export const EMP_STATUS_CODES: StatusCodeInfo[] = [
  { code: 'STATUS_ACTIVE', label: '재직', sort_order: 1 },
  { code: 'STATUS_LEAVE', label: '휴직', sort_order: 2 },
  { code: 'STATUS_RETIRED', label: '퇴사', sort_order: 3 },
];

export type ProjectStageCode = 'STAGE_ORDER' | 'STAGE_PROPOSAL' | 'STAGE_EXEC' | 'STAGE_DONE';

export interface ProjectStageCodeInfo {
  code: ProjectStageCode;
  label: '발주예상' | '제안준비중' | '프로젝트 수행' | '완료';
  sort_order: number;
}

export const PROJECT_STAGE_CODES: ProjectStageCodeInfo[] = [
  { code: 'STAGE_ORDER', label: '발주예상', sort_order: 1 },
  { code: 'STAGE_PROPOSAL', label: '제안준비중', sort_order: 2 },
  { code: 'STAGE_EXEC', label: '프로젝트 수행', sort_order: 3 },
  { code: 'STAGE_DONE', label: '완료', sort_order: 4 },
];

export interface Employee {
  version?: number;
  id: number;
  emp_no: string;
  name: string;
  department_code: string;
  department: string;
  position_code: string;
  position: string;
  email: string;
  phone: string;
  hire_date: string;
  status: string;
  status_code?: StatusCode;
  leave_remaining?: number;
  leave_total?: number;
  skills?: string;
  avatar_color: string;
  role?: string;
  role_code?: RoleCode;
  recognized_career_years?: number;
  recognized_career_months?: number;
}

export interface Project {
  version?: number;
  id: number;
  code: string;
  name: string;
  client_name?: string; // 발주기관 / 고객사
  department_code?: string;
  department: string;
  pm_name: string;
  pm_id?: number;
  member_ids?: number[];
  start_date: string;
  end_date: string;
  status: string;
  status_code?: ProjectStageCode;
  progress: number;
  budget: number;
  share_rate?: number; // 당사 지분율 (%)
  our_budget?: number; // 당사 수주 배정액 (만원)
  is_consortium?: boolean; // 컨소시엄 여부
  consortium_partners?: string; // 컨소시엄 참여사
  members: string;
  priority: string;
  description: string;
  target_year?: number;
  yearly_revenue_json?: string; // e.g. { "2026": 45000, "2027": 55000 }
}

export type EquipmentCategory = '모니터' | '데스크탑' | '노트북';
export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = ['모니터', '데스크탑', '노트북'];

export interface Equipment {
  version?: number;
  id: number;
  asset_no: string;
  category: EquipmentCategory | string;
  model_name: string;
  serial_no: string;
  status: string;
  emp_id?: number;
  emp_no?: string;
  assigned_to: string;
  department_code?: string;
  department: string;
  purchase_date: string;
  price: number;
  notes: string;
}

export interface BusinessDeal {
  version?: number;
  id: number;
  title: string;
  client_name: string;
  owner_name: string;
  owner_id?: number;
  converted_project_id?: number;
  stage: string; // '예상사업' | '제안준비' | '제안심사' | '수주확정' | '보류/탈락'
  amount: number; // 만원
  probability: number;
  close_date: string;
  start_date?: string;
  end_date?: string;
  target_year?: number; // 대상 회계연도 (2026, 2027 등)
  deal_type: string;
  notes: string;
  yearly_revenue_json?: string; // e.g. { "2026": 45000, "2027": 55000 }
}

export interface Evaluation {
  employee_id?: number;
  version?: number;
  id: number;
  emp_no: string;
  emp_name: string;
  department_code: string;
  department: string;
  position_code: string;
  position: string;
  period: string;
  kpi_score: number;
  competency_score: number;
  peer_score: number;
  total_score: number;
  grade: string;
  reviewer: string;
  status: string;
  feedback: string;
}

export interface Approval {
  details_loaded?: boolean;
  project_id?: number;
  requester_id?: number;
  approver_id?: number;
  version?: number;
  id: number;
  doc_no: string;
  category: string;
  title: string;
  requester: string;
  requester_position?: string;
  department_code?: string;
  department: string;
  created_at: string;
  status: string;
  amount: number;
  project_name?: string;
  vendor?: string;
  payment_method?: string;
  purpose?: string;
  items_json?: string;
  reviewer_comment?: string;
  approved_by?: string;
}

export interface Holiday {
  id: number;
  holiday_date: string; // YYYY-MM-DD
  holiday_name: string;
  is_statutory?: boolean;
  description?: string;
}

export type TabKey =
  | 'dashboard'
  | 'approvals'
  | 'employees'
  | 'projects'
  | 'reports'
  | 'equipments'
  | 'business_deals'
  | 'evaluations'
  | 'master_data'
  | 'procurement';

// ==========================================
// 11 Sheets Contract Workstation Data Models
// ==========================================

// Sheet 1: 상품원가 (H/W, S/W 라이선스 등)
export interface ProductCostItem {
  id: string;
  category: 'H/W 장비' | 'S/W 패키지' | '클라우드/인프라' | '기타자재';
  itemName: string;
  spec: string;
  qty: number;
  unitPrice: number; // 천원
  amount: number; // 천원 (qty * unitPrice)
  note: string;
}

// Sheet 2 & 4: 투입인력 공수 및 인건비 (월별 일정 M1~M8)
export interface ManpowerPlanItem {
  employeeId?: number;
  id: string;
  type: '당사' | '외주' | '자사화';
  grade: '특급' | '고급' | '중급' | '초급';
  role: string;
  name: string;
  position: string;
  months: number[]; // e.g. [1, 1, 1, 1, 1, 1, 0, 0] (월별 M/M)
  totalMM: number;
  unitPrice: number; // 천원/MM
  laborCost: number; // 천원 (totalMM * unitPrice)
}

// Sheet 3: 외주용역비
export interface OutsourcingItem {
  id: string;
  vendorName: string;
  grade: '특급' | '고급' | '중급' | '초급';
  workScope: string;
  mm: number;
  unitPrice: number; // 천원
  contractAmount: number; // 천원
  note: string;
}

// Sheet 5: 직접경비
export interface DirectExpenseItem {
  id: string;
  account:
    | '복리/특근식대'
    | '복리/회의비'
    | '국내출장비'
    | '시내교통비'
    | '인쇄도서비'
    | '감가상각비'
    | '소모품비'
    | '지급수수료'
    | string;
  itemName?: string;
  qty: number;
  unitPrice: number; // 천원
  basis: string; // 산출근거 식
  amount: number; // 천원 (qty * unitPrice)
  note: string;
  calculation?: {
    categoryCode: string;
    method: 'PRODUCT' | 'TRAVEL' | 'RATE';
    source: 'MANUAL' | 'TOTAL_MM' | 'OUR_MM' | 'HEADCOUNT' | 'MONTHS' | 'SUPPLY';
    base: number;
    inputs: Record<string, number>;
  };
}

// Sheet 7: 리스크 노출도 평가 기반 예비비
export interface RiskEvaluationItem {
  id: string;
  category: '고객성향' | '기술력' | '팀구성도';
  question: string;
  selectedLevel: '상' | '중' | '하';
  score: number; // 1 ~ 5
  exposureWeight: number; // 가중치
  calculatedExposure: number;
}

// Sheet 9: 계약입금 계획 (선금/중도금/잔금)
export interface CashflowMilestoneItem {
  id: string;
  turnName: string; // 선금 (30%), 1차 중도금 (40%), 잔금 (30%)
  milestone: string; // 계약체결/착수, 중간보고회, 완료보고/검수
  plannedDate: string;
  ratePercent: number;
  supplyAmount: number; // 천원
  vatAmount: number; // 천원
  totalAmount: number; // 천원
  status: '입금예정' | '청구완료' | '입금완료';
}

// 종합 계약품의서 통합 데이터 모델 (W-Q-S-12-6)
export interface FullContractDocument {
  docNo: string;
  version: string;
  title: string;
  clientName: string;
  contractPeriod: string;
  startDate?: string;
  endDate?: string;
  linkedProjectId?: number;
  linkedProjectCode?: string;
  contractType: string;
  paymentTerms: string;
  warrantyPeriod: string;
  delayPenaltyRate: number;
  ourShareRate: number;

  // 손익 집계 필드 (천원)
  supplyAmount: number; // 매출액 (A)
  vatAmount: number;

  productCostTotal: number; // 상품원가 (C)
  outsourcingTotal: number; // 외주비 (D)
  laborCostTotal: number; // 당사인건비 (E)
  directExpenseTotal: number; // 직접경비 (F)
  estimatedAsTotal: number; // 추정 AS
  proposalCostTotal: number; // 제안비용

  totalBudget: number; // 총원가/총예산 (B = C+D+E+F+AS+제안)
  salesProfit: number; // 매출이익 (G = A - B)

  contingencyRate: number; // 예비비율 (%)
  contingencyCost: number; // 예비비 (I = B * contingencyRate)
  projectNetProfit: number; // 프로젝트 순손익 (J = G - I)
  profitRate: number; // 당사이익율 (%) = J / A * 100

  // 11개 세부 시트 데이터
  productCosts: ProductCostItem[];
  manpowerPlans: ManpowerPlanItem[];
  outsourcings: OutsourcingItem[];
  directExpenses: DirectExpenseItem[];
  riskEvaluations: RiskEvaluationItem[];
  cashflowMilestones: CashflowMilestoneItem[];

  // 결재 & 합의 라인
  approvalLine: {
    drafter: { name: string; position: string; dept: string; status: string; date: string };
    bizHead: { name: string; position: string; status: string; date?: string; comment?: string };
    ceo: { name: string; position: string; status: string; date?: string; comment?: string };
  };
  consensusLine: {
    qm: { name: string; position: string; dept: string; status: string; date?: string };
    mgmt: { name: string; position: string; dept: string; status: string; date?: string };
    pm: { name: string; position: string; dept: string; status: string; date?: string };
  };
}

// 회사 기본 상수
export const COMPANY_NAME_KO = '(주)스패셜티';
export const COMPANY_NAME_EN = 'SpatialT Inc.';
export const COMPANY_ADDRESS = '전북 전주시 덕진구 만성동 스페이스온 지식산업센터';
export const COMPANY_CEO = '권우석';
export const COMPANY_WEBSITE = 'http://www.spatialt.co.kr/';
export const COMPANY_EMAIL_DOMAIN = '@spatialt.co.kr';

export const STANDARD_UNIT_PRICES = [
  { position: '이사', grade: '특급', desc: '총괄 PM / 공간정보 정책 및 감리 총괄' },
  { position: '부장', grade: '특급', desc: '공간정보 PM / GIS 아키텍처 / 수주 총괄' },
  { position: '차장', grade: '고급', desc: 'GIS 플랫폼 PL / 3D 디지털트윈 설계' },
  { position: '과장', grade: '고급', desc: '품질총괄 / PostGIS DB 검수 / 백엔드' },
  { position: '대리', grade: '중급', desc: 'OpenLayers / Cesium WebGIS 프론트엔드' },
  { position: '담당', grade: '초급', desc: '공간정보 API / 지도 데이터 가공' },
];

export function cleanDeptName(name?: string): string {
  if (!name) return '';
  const trimmed = name.replace(/ST$/, '').trim();
  if (trimmed === '경영지원' || trimmed === '경영지원팀') return '경영지원팀';
  if (trimmed === '사장' || trimmed === '대표이사') return '대표이사';
  return trimmed;
}

export const DEPARTMENT_CODES: DepartmentCodeInfo[] = [
  { code: 'DEPT_CEO', label: '대표이사', parent_code: 'ROOT', sort_order: 1 },
  { code: 'DEPT_BIZ', label: '사업본부', parent_code: 'DEPT_CEO', sort_order: 2 },
  { code: 'DEPT_RND', label: '기술연구소', parent_code: 'DEPT_CEO', sort_order: 3 },
  { code: 'DEPT_QM', label: '품질경영팀', parent_code: 'DEPT_CEO', sort_order: 4 },
  { code: 'DEPT_MGMT', label: '경영지원팀', parent_code: 'ROOT', sort_order: 5 },
];

export const POSITION_CODES: PositionCodeInfo[] = [
  { code: 'POS_STAFF', label: '담당', level: 1 },
  { code: 'POS_AM', label: '대리', level: 2 },
  { code: 'POS_MGR', label: '과장', level: 3 },
  { code: 'POS_DGM', label: '차장', level: 4 },
  { code: 'POS_GM', label: '부장', level: 5 },
  { code: 'POS_DIR', label: '이사', level: 6 },
  { code: 'POS_CEO', label: '사장', level: 7 },
];

// DB common_codes 기반 부서 목록 조회 헬퍼 (DB 우선 적용)
export function getDepartmentsFromCommonCodes(commonCodes?: CommonCode[]): DepartmentCodeInfo[] {
  if (!commonCodes || commonCodes.length === 0) return DEPARTMENT_CODES;
  const fromDb = commonCodes
    .filter((c) => c.group_code === 'DEPARTMENT' && c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      code: c.code,
      label: c.code_name,
      parent_code: c.extra_value || 'DEPT_CEO',
      sort_order: c.sort_order,
    }));
  return fromDb.length > 0 ? fromDb : DEPARTMENT_CODES;
}

// DB common_codes 기반 직급 목록 조회 헬퍼 (DB 우선 적용)
export function getPositionsFromCommonCodes(commonCodes?: CommonCode[]): PositionCodeInfo[] {
  if (!commonCodes || commonCodes.length === 0) return POSITION_CODES;
  const fromDb = commonCodes
    .filter((c) => c.group_code === 'POSITION' && c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      code: c.code,
      label: c.code_name,
      level: Number(c.extra_value) || c.sort_order,
    }));
  return fromDb.length > 0 ? fromDb : POSITION_CODES;
}

export function formatCurrencyManwon(val: number): string {
  if (val >= 10000) {
    const eok = Math.floor(val / 10000);
    const man = val % 10000;
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${val.toLocaleString()}만원`;
}

// 다년도 사업 기간(시작일, 종료일)과 총 금액(만원)을 받아 연도별 귀속 매출(만원)을 안분 계산
export function calculateMultiYearRevenues(
  startDateStr: string,
  endDateStr: string,
  totalAmount: number
): Record<number, number> {
  if (!startDateStr || !endDateStr || !Number.isFinite(totalAmount) || totalAmount < 0) return {};
  const start = new Date(startDateStr), end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return {};

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    return { [startYear]: totalAmount };
  }

  // 각 연도별 수행 개월 수 계산
  const monthsPerYear: Record<number, number> = {};
  let totalMonths = 0;

  for (let y = startYear; y <= endYear; y++) {
    const yStartMonth = y === startYear ? start.getMonth() : 0;
    const yEndMonth = y === endYear ? end.getMonth() : 11;
    const months = Math.max(1, yEndMonth - yStartMonth + 1);
    monthsPerYear[y] = months;
    totalMonths += months;
  }

  const result: Record<number, number> = {};
  let allocatedSum = 0;

  const years = Object.keys(monthsPerYear).map(Number);
  years.forEach((y, idx) => {
    if (idx === years.length - 1) {
      result[y] = totalAmount - allocatedSum;
    } else {
      const share = Math.round((totalAmount * monthsPerYear[y]) / totalMonths);
      result[y] = share;
      allocatedSum += share;
    }
  });

  return result;
}

// 당사 지분율(%) 산출 헬퍼 (기본 100%)
export function getProjectShareRate(project: Project): number {
  if (typeof project.share_rate === 'number' && !isNaN(project.share_rate) && project.share_rate >= 0) {
    return project.share_rate;
  }
  return 100;
}

// 당사 수주/배정 예산(만원) 산출 헬퍼 (컨소시엄 지분율 반영)
export function getProjectOurBudget(project: Project): number {
  if (typeof project.our_budget === 'number' && project.our_budget >= 0) {
    return project.our_budget;
  }
  const shareRate = getProjectShareRate(project);
  return Math.round((project.budget || 0) * (shareRate / 100));
}

// 특정 연도에 귀속되는 프로젝트의 안분 당사 매출액(만원) 산출 (지분율 반영)
export function getMultiYearRevenueForYear(project: Project, targetYear: number = 2026): number {
  return getProjectYearlyScope(project, targetYear).yearOurRevenue;
}

export interface ProjectYearlyScope {
  isMultiYear: boolean;
  currentYear: number;
  yearStartDate: string;
  yearEndDate: string;
  yearMonths: number;
  totalBudget: number;
  yearTotalBudget: number; // 올해 전체 안분 예산
  shareRate: number;       // 지분율 (%)
  yearOurRevenue: number;  // 올해 당사 안분 매출 (지분율 적용)
  fullStartDate: string;
  fullEndDate: string;
}

// 통합 대시보드 및 연차사업 계산 헬퍼: 연차사업의 경우 올해 기간으로만, 지분율로 계산
export function getProjectYearlyScope(
  project: Project,
  currentYear: number = new Date().getFullYear()
): ProjectYearlyScope {
  const shareRate = getProjectShareRate(project);
  const start = new Date(project.start_date);
  const end = new Date(project.end_date);
  const startYear = isNaN(start.getTime()) ? currentYear : start.getFullYear();
  const endYear = isNaN(end.getTime()) ? currentYear : end.getFullYear();
  const isMultiYear = startYear !== endYear;
  const inPeriod = !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end
    && currentYear >= startYear && currentYear <= endYear;

  // 올해 기간 산정 (연차사업의 경우 올해 기간으로만)
  let yearStartDate = project.start_date;
  let yearEndDate = project.end_date;

  if (isMultiYear) {
    if (startYear < currentYear) {
      yearStartDate = `${currentYear}-01-01`;
    }
    if (endYear > currentYear) {
      yearEndDate = `${currentYear}-12-31`;
    }
  }

  // 올해 개월 수
  const yStart = new Date(yearStartDate);
  const yEnd = new Date(yearEndDate);
  let yearMonths = 12;
  if (!isNaN(yStart.getTime()) && !isNaN(yEnd.getTime())) {
    const sm = yStart.getFullYear() === currentYear ? yStart.getMonth() : 0;
    const em = yEnd.getFullYear() === currentYear ? yEnd.getMonth() : 11;
    yearMonths = Math.max(1, em - sm + 1);
  }

  // 올해 전체 안분 예산 (지분율 적용 전)
  let yearTotalBudget = project.budget || 0;
  if (project.yearly_revenue_json) {
    try {
      const breakdown = JSON.parse(project.yearly_revenue_json) as Record<string, number>;
      if (breakdown && typeof breakdown === 'object' && !Array.isArray(breakdown) && Object.keys(breakdown).length > 0) {
        yearTotalBudget = Number(breakdown[String(currentYear)]) || 0;
      } else if (isMultiYear) {
        const calculated = calculateMultiYearRevenues(
          project.start_date,
          project.end_date,
          project.budget
        );
        yearTotalBudget = calculated[currentYear] ?? 0;
      }
    } catch {
      const calculated = calculateMultiYearRevenues(
        project.start_date,
        project.end_date,
        project.budget
      );
      yearTotalBudget = calculated[currentYear] ?? 0;
    }
  } else if (isMultiYear) {
    const calculated = calculateMultiYearRevenues(
      project.start_date,
      project.end_date,
      project.budget
    );
    yearTotalBudget = calculated[currentYear] ?? 0;
  }

  if (!inPeriod) {
    yearTotalBudget = 0;
    yearMonths = 0;
    yearStartDate = '';
    yearEndDate = '';
  }

  // 올해 당사 안분 매출 (지분율 적용)
  const yearOurRevenue = Math.round(yearTotalBudget * (shareRate / 100));

  return {
    isMultiYear,
    currentYear,
    yearStartDate,
    yearEndDate,
    yearMonths,
    totalBudget: project.budget || 0,
    yearTotalBudget,
    shareRate,
    yearOurRevenue,
    fullStartDate: project.start_date,
    fullEndDate: project.end_date,
  };
}


