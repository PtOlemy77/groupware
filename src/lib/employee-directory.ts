import type {
  Approval,
  Employee,
  Project,
  StatusCode,
  ProjectStageCode,
} from '@/types/groupware';

export type AvailabilityFilter = 'ALL' | 'ASSIGNED' | 'POOL' | 'LEAVE' | 'RETIRED';

export interface DirectoryFilters {
  query: string;
  department: string;
  position: string;
  availability: AvailabilityFilter;
  employeeId: number | null;
  projectId: number | null;
}

export const initialDirectoryFilters: DirectoryFilters = {
  query: '',
  department: 'ALL',
  position: 'ALL',
  availability: 'ALL',
  employeeId: null,
  projectId: null,
};

// Compatibility conversion is confined to the boundary; all decisions below use codes.
const LEGACY_STATUS_MAP: Record<string, StatusCode> = {
  재직: 'STATUS_ACTIVE',
  휴직: 'STATUS_LEAVE',
  퇴사: 'STATUS_RETIRED',
};

const LEGACY_STAGE_MAP: Record<string, ProjectStageCode> = {
  '프로젝트 수행': 'STAGE_EXEC',
  진행중: 'STAGE_EXEC',
  제안준비중: 'STAGE_PROPOSAL',
  검토중: 'STAGE_PROPOSAL',
  완료: 'STAGE_DONE',
  발주예상: 'STAGE_ORDER',
};

/**
 * 직원의 재직 상태 코드를 반환한다 (레거시 한글 문자열 호환 변환 포함).
 */
export function employeeStatus(employee: Employee): StatusCode {
  return employee.status_code || LEGACY_STATUS_MAP[employee.status] || 'STATUS_ACTIVE';
}

/**
 * 프로젝트에 투입된 PM 및 참여 인력의 고유 직원 ID 목록을 추출한다.
 */
export function projectEmployeeIds(project: Project): number[] {
  const rawIds = [project.pm_id, ...(project.member_ids || [])];
  const validIds = rawIds.filter(
    (id): id is number => typeof id === 'number' && id > 0,
  );
  return [...new Set(validIds)];
}

/**
 * 현재 수행 중이거나 계약품의가 연결된 활성 프로젝트 여부를 판정한다.
 */
export function activeDirectoryProject(
  project: Project,
  approvals: Approval[] = [],
): boolean {
  const stage = project.status_code || LEGACY_STAGE_MAP[project.status];
  if (stage === 'STAGE_EXEC' || stage === 'STAGE_PROPOSAL') {
    return true;
  }

  const hasLinkedContract = approvals.some(
    (approval) =>
      approval.project_id === project.id &&
      ['계약품의', '계약품의서'].includes(approval.category),
  );
  return stage !== 'STAGE_DONE' && hasLinkedContract;
}

/**
 * 검색 비교를 위해 공백, 하이픈, 괄호, 점을 제거하고 소문자로 정규화한다.
 */
export function normalizedDirectoryText(value: string): string {
  return value.toLocaleLowerCase('ko-KR').replace(/[\s\-().]/g, '');
}

/**
 * 직원의 인적사항 및 참여 프로젝트명/코드가 검색어(공백 구분 다중 단어)와 모두 일치하는지 검사한다.
 */
export function employeeMatchesQuery(
  employee: Employee,
  query: string,
  projects: Project[],
): boolean {
  const keywords = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizedDirectoryText);

  if (keywords.length === 0) {
    return true;
  }

  const assignedProjectFields = projects
    .filter((project) => projectEmployeeIds(project).includes(employee.id))
    .flatMap((project) => [project.name, project.code]);

  const searchableValues = [
    employee.name,
    employee.emp_no,
    employee.hire_date,
    employee.position,
    employee.department,
    employee.email,
    employee.phone,
    ...assignedProjectFields,
  ].map((value) => normalizedDirectoryText(value || ''));

  return keywords.every((keyword) =>
    searchableValues.some((target) => target.includes(keyword)),
  );
}

/**
 * 조직도·임직원 필터 조건(재직 상태, 투입 여부, 가용 인력풀, 부서, 직급, 검색어)에 맞는 직원 목록을 반환한다.
 */
export function selectDirectoryEmployees(
  employees: Employee[],
  projects: Project[],
  approvals: Approval[],
  filters: DirectoryFilters,
): Employee[] {
  const activeProjects = projects.filter((project) =>
    activeDirectoryProject(project, approvals),
  );
  const assignedEmployeeIds = new Set(activeProjects.flatMap(projectEmployeeIds));

  const chosenProject =
    filters.projectId === null
      ? null
      : projects.find((project) => project.id === filters.projectId);
  const chosenProjectMemberIds = new Set(
    chosenProject ? projectEmployeeIds(chosenProject) : [],
  );

  return employees.filter((employee) => {
    const status = employeeStatus(employee);

    // 퇴사자 필터가 아닌 경우 퇴사 직원은 제외
    const isRetiredMatch =
      filters.availability === 'RETIRED'
        ? status === 'STATUS_RETIRED'
        : status !== 'STATUS_RETIRED';
    if (!isRetiredMatch) {
      return false;
    }

    if (filters.availability === 'LEAVE' && status !== 'STATUS_LEAVE') {
      return false;
    }

    if (
      filters.availability === 'ASSIGNED' &&
      (status !== 'STATUS_ACTIVE' || !assignedEmployeeIds.has(employee.id))
    ) {
      return false;
    }

    // 사업본부 재직자 중 활성 프로젝트 미배정 인원을 '인력풀(POOL)'로 분류
    const isInAvailablePool =
      employee.department_code === 'DEPT_BIZ' &&
      status === 'STATUS_ACTIVE' &&
      !assignedEmployeeIds.has(employee.id);

    if (
      (filters.availability === 'POOL' || filters.department === 'DEPT_POOL') &&
      !isInAvailablePool
    ) {
      return false;
    }

    if (
      filters.department !== 'ALL' &&
      filters.department !== 'DEPT_POOL' &&
      employee.department_code !== filters.department
    ) {
      return false;
    }

    if (
      filters.position !== 'ALL' &&
      employee.position_code !== filters.position
    ) {
      return false;
    }

    if (filters.employeeId !== null && employee.id !== filters.employeeId) {
      return false;
    }

    if (filters.projectId !== null && !chosenProjectMemberIds.has(employee.id)) {
      return false;
    }

    return employeeMatchesQuery(employee, filters.query, activeProjects);
  });
}

/**
 * 전체 페이지 수와 현재 페이지를 기준으로 페이지네이션 버튼 목록(최대 7개 슬롯)을 생성한다.
 */
export function directoryPageNumbers(total: number, current: number): number[] {
  if (total <= 7) {
    const length = Math.max(1, total);
    return Array.from({ length }, (_, index) => index + 1);
  }

  const centerPage = Math.min(total - 2, Math.max(3, current));
  const middlePages = Array.from(
    { length: 5 },
    (_, index) => centerPage - 2 + index,
  );

  return [...new Set([1, ...middlePages, total])].sort((a, b) => a - b);
}
