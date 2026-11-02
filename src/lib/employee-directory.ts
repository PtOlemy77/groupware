import type { Approval, Employee, Project, StatusCode, ProjectStageCode } from '@/types/groupware';
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
  query: '', department: 'ALL', position: 'ALL', availability: 'ALL', employeeId: null, projectId: null,
};
// Compatibility conversion is confined to the boundary; all decisions below use codes.
const oldStatuses: Record<string, StatusCode> = { 재직: 'STATUS_ACTIVE', 휴직: 'STATUS_LEAVE', 퇴사: 'STATUS_RETIRED' };
const oldStages: Record<string, ProjectStageCode> = { '프로젝트 수행': 'STAGE_EXEC', 진행중: 'STAGE_EXEC', 제안준비중: 'STAGE_PROPOSAL', 검토중: 'STAGE_PROPOSAL', 완료: 'STAGE_DONE', 발주예상: 'STAGE_ORDER' };
export const employeeStatus = (employee: Employee): StatusCode => employee.status_code || oldStatuses[employee.status] || 'STATUS_ACTIVE';
export const projectEmployeeIds = (project: Project) => [...new Set([project.pm_id, ...(project.member_ids || [])].filter((id): id is number => typeof id === 'number' && id > 0))];
export function activeDirectoryProject(project: Project, approvals: Approval[] = []) {
  const stage = project.status_code || oldStages[project.status];
  if (stage === 'STAGE_EXEC' || stage === 'STAGE_PROPOSAL') return true;
  return stage !== 'STAGE_DONE' && approvals.some(approval => approval.project_id === project.id && ['계약품의', '계약품의서'].includes(approval.category));
}
export const normalizedDirectoryText = (value: string) => value.toLocaleLowerCase('ko-KR').replace(/[\s\-().]/g, '');
export function employeeMatchesQuery(employee: Employee, query: string, projects: Project[]) {
  const words = query.trim().split(/\s+/).filter(Boolean).map(normalizedDirectoryText);
  const values = [employee.name, employee.emp_no, employee.hire_date, employee.position, employee.department,
    employee.email, employee.phone, ...projects.filter(project => projectEmployeeIds(project).includes(employee.id)).flatMap(project => [project.name, project.code])]
    .map(value => normalizedDirectoryText(value || ''));
  return words.every(word => values.some(value => value.includes(word)));
}
export function selectDirectoryEmployees(employees: Employee[], projects: Project[], approvals: Approval[], filters: DirectoryFilters) {
  const activeProjects = projects.filter(project => activeDirectoryProject(project, approvals));
  const assigned = new Set(activeProjects.flatMap(projectEmployeeIds));
  const chosenProject = filters.projectId === null ? null : projects.find(project => project.id === filters.projectId);
  const chosenMembers = new Set(chosenProject ? projectEmployeeIds(chosenProject) : []);
  return employees.filter(employee => {
    const status = employeeStatus(employee);
    if (filters.availability === 'RETIRED' ? status !== 'STATUS_RETIRED' : status === 'STATUS_RETIRED') return false;
    if (filters.availability === 'LEAVE' && status !== 'STATUS_LEAVE') return false;
    if (filters.availability === 'ASSIGNED' && (status !== 'STATUS_ACTIVE' || !assigned.has(employee.id))) return false;
    const inPool = employee.department_code === 'DEPT_BIZ' && status === 'STATUS_ACTIVE' && !assigned.has(employee.id);
    if ((filters.availability === 'POOL' || filters.department === 'DEPT_POOL') && !inPool) return false;
    if (filters.department !== 'ALL' && filters.department !== 'DEPT_POOL' && employee.department_code !== filters.department) return false;
    if (filters.position !== 'ALL' && employee.position_code !== filters.position) return false;
    if (filters.employeeId !== null && employee.id !== filters.employeeId) return false;
    if (filters.projectId !== null && !chosenMembers.has(employee.id)) return false;
    return employeeMatchesQuery(employee, filters.query, activeProjects);
  });
}

export function directoryPageNumbers(total: number, current: number): number[] {
  if (total <= 7) return Array.from({ length: Math.max(1, total) }, (_, index) => index + 1);
  return [...new Set([1, ...Array.from({ length: 5 }, (_, index) => Math.min(total - 2, Math.max(3, current)) - 2 + index), total])].sort((a, b) => a - b);
}
