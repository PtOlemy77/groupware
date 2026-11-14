import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  Briefcase,
  Users,
  Edit3,
} from 'lucide-react';
import {
  DEPARTMENT_CODES,
  compareEmployeesByPositionAndHireDate,
  type Employee,
  type Project,
  type DepartmentCodeInfo,
} from '@/types/groupware';
import {
  employeeStatus,
  projectEmployeeIds,
  type DirectoryFilters,
} from '@/lib/employee-directory';

interface Props {
  employees: Employee[];
  projects: Project[];
  filters: DirectoryFilters;
  defaultDepartment?: string;
  departmentOptions?: DepartmentCodeInfo[];
  onSelect: (filters: Partial<DirectoryFilters>) => void;
  onReset: () => void;
  onEdit?: (employee: Employee) => void;
}

const SELECTED_ITEM_STYLE = 'bg-indigo-50 text-indigo-800 font-semibold';
const BASE_ROW_STYLE =
  'min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500';

export default function EmployeeOrgTree({
  employees,
  projects,
  filters,
  defaultDepartment,
  departmentOptions,
  onSelect,
  onReset,
  onEdit,
}: Props) {
  const departments =
    departmentOptions && departmentOptions.length > 0
      ? departmentOptions
      : DEPARTMENT_CODES;

  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () => new Set(['dept-DEPT_BIZ', `dept-${defaultDepartment}`]),
  );

  const isSearching = Boolean(filters.query.trim());

  const toggleNode = (key: string) => {
    setOpenKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 검색어가 입력된 상태에서는 모든 트리 노드를 자동으로 펼쳐 보여준다.
  const isExpanded = (key: string) => isSearching || openKeys.has(key);

  const selectFilter = (selection: Partial<DirectoryFilters>) => {
    onSelect({
      department: 'ALL',
      position: 'ALL',
      availability: 'ALL',
      query: '',
      employeeId: null,
      projectId: null,
      ...selection,
    });
  };

  // 사업본부 재직자 중 어떤 프로젝트에도 배정되지 않은 인원을 인재풀로 계산
  const assignedEmployeeIds = new Set(projects.flatMap(projectEmployeeIds));
  const poolEmployees = employees.filter(
    (employee) =>
      employee.department_code === 'DEPT_BIZ' &&
      employeeStatus(employee) === 'STATUS_ACTIVE' &&
      !assignedEmployeeIds.has(employee.id),
  );

  const renderEmployeeNode = (employee: Employee, key: string) => {
    const isSelected = filters.employeeId === employee.id;
    const retiredFilter =
      employeeStatus(employee) === 'STATUS_RETIRED' ? 'RETIRED' : 'ALL';

    return (
      <li key={key} className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          data-employee-id={employee.id}
          title={`${employee.name} · ${employee.department} · ${employee.emp_no}`}
          aria-label={`${employee.name} ${employee.position} 선택, ${employee.department}, 사번 ${employee.emp_no}`}
          aria-pressed={isSelected}
          onClick={() =>
            selectFilter({
              employeeId: employee.id,
              availability: retiredFilter,
            })
          }
          className={`${BASE_ROW_STYLE} ${isSelected ? SELECTED_ITEM_STYLE : 'text-slate-700'}`}
        >
          <span className="flex items-center gap-2">
            <User size={15} className="shrink-0 text-slate-400" />
            <span className="min-w-0 break-words">
              {employee.name}{' '}
              <span className="text-xs text-slate-500">{employee.position}</span>
            </span>
          </span>
        </button>

        {onEdit && (
          <button
            type="button"
            aria-label={`${employee.name} 정보 수정`}
            onClick={() => onEdit(employee)}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
          >
            <Edit3 size={14} />
          </button>
        )}
      </li>
    );
  };

  const renderDisclosureButton = (key: string, label: string) => {
    const expanded = isExpanded(key);
    return (
      <button
        type="button"
        aria-label={`${label} ${expanded ? '접기' : '펼치기'}`}
        aria-expanded={expanded}
        disabled={isSearching}
        onClick={() => toggleNode(key)}
        className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
      >
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
    );
  };

  return (
    <aside
      aria-label="조직도"
      className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white shadow-xs xl:sticky xl:top-20 xl:w-72 2xl:w-80"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">조직도</h2>
          <button
            type="button"
            onClick={onReset}
            className="rounded px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            전체 보기
          </button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          부서·프로젝트·직원을 선택하면 목록에 반영됩니다.
        </p>
      </div>

      <div className="max-h-80 overflow-y-auto p-2 xl:max-h-[65vh]">
        {isSearching && (
          <p role="status" className="px-2 py-2 text-xs text-indigo-600">
            검색 결과에 해당하는 조직과 직원만 표시합니다.
          </p>
        )}

        <ul className="space-y-1">
          {departments.map((department) => {
            const departmentMembers = employees
              .filter((employee) => employee.department_code === department.code)
              .sort(compareEmployeesByPositionAndHireDate);

            // 사업본부는 산하 프로젝트 및 인재풀 구조로 세분화하여 표시
            const isBizDept = department.code === 'DEPT_BIZ';
            const departmentProjects = isBizDept
              ? projects.filter((project) => {
                  const hasMatchedMember = projectEmployeeIds(project).some((id) =>
                    employees.some((employee) => employee.id === id),
                  );
                  return (
                    hasMatchedMember ||
                    (!isSearching && filters.availability === 'ALL')
                  );
                })
              : [];

            if (
              isSearching &&
              departmentMembers.length === 0 &&
              departmentProjects.length === 0
            ) {
              return null;
            }

            const deptKey = `dept-${department.code}`;
            const isDeptSelected = filters.department === department.code;

            // 사업본부 재직 인원은 하위 프로젝트·인재풀 노드에서 보여주므로 여기서는 비재직(휴직·퇴사)만 직접 노출
            const directMembers = departmentMembers.filter(
              (employee) =>
                !isBizDept || employeeStatus(employee) !== 'STATUS_ACTIVE',
            );

            const isPoolSelected =
              filters.department === 'DEPT_POOL' || filters.availability === 'POOL';

            return (
              <li key={deptKey}>
                <div className="flex items-center gap-1">
                  {renderDisclosureButton(deptKey, department.label)}
                  <button
                    type="button"
                    data-department-code={department.code}
                    aria-pressed={isDeptSelected}
                    onClick={() => selectFilter({ department: department.code })}
                    className={`${BASE_ROW_STYLE} ${
                      isDeptSelected
                        ? SELECTED_ITEM_STYLE
                        : 'font-semibold text-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Building2 size={15} className="shrink-0" />
                      <span className="flex-1">{department.label}</span>
                      <span className="text-xs tabular-nums text-slate-400">
                        {departmentMembers.length}
                      </span>
                    </span>
                  </button>
                </div>

                {isExpanded(deptKey) && (
                  <ul className="ml-5 space-y-0.5 border-l border-slate-200 pl-2">
                    {directMembers.map((employee) =>
                      renderEmployeeNode(employee, `${deptKey}-${employee.id}`),
                    )}

                    {departmentProjects.map((project) => {
                      const projectMemberIds = projectEmployeeIds(project);
                      const projectMembers = employees
                        .filter((employee) =>
                          projectMemberIds.includes(employee.id),
                        )
                        .sort(compareEmployeesByPositionAndHireDate);

                      const projectKey = `project-${project.id}`;
                      const isProjectSelected = filters.projectId === project.id;

                      return (
                        <li key={projectKey}>
                          <div className="flex items-center gap-1">
                            {renderDisclosureButton(projectKey, project.name)}
                            <button
                              type="button"
                              data-project-id={project.id}
                              aria-pressed={isProjectSelected}
                              onClick={() =>
                                selectFilter({ projectId: project.id })
                              }
                              className={`${BASE_ROW_STYLE} ${
                                isProjectSelected
                                  ? SELECTED_ITEM_STYLE
                                  : 'text-slate-700'
                              }`}
                            >
                              <span className="flex items-start gap-2">
                                <Briefcase
                                  size={14}
                                  className="mt-0.5 shrink-0 text-indigo-500"
                                />
                                <span className="min-w-0 flex-1 break-words">
                                  {project.name}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {projectMembers.length}
                                </span>
                              </span>
                            </button>
                          </div>

                          {isExpanded(projectKey) && (
                            <ul className="ml-5 space-y-0.5 border-l border-slate-200 pl-2">
                              {projectMembers.map((employee) =>
                                renderEmployeeNode(
                                  employee,
                                  `${projectKey}-${employee.id}`,
                                ),
                              )}
                              {projectMembers.length === 0 && (
                                <li className="px-2 py-2 text-xs text-slate-400">
                                  배정된 인원이 없습니다.
                                </li>
                              )}
                            </ul>
                          )}
                        </li>
                      );
                    })}

                    {isBizDept && (!isSearching || poolEmployees.length > 0) && (
                      <li>
                        <div className="flex items-center gap-1">
                          {renderDisclosureButton('pool', '인재풀')}
                          <button
                            type="button"
                            aria-pressed={isPoolSelected}
                            onClick={() =>
                              selectFilter({ department: 'DEPT_POOL' })
                            }
                            className={`${BASE_ROW_STYLE} ${
                              isPoolSelected
                                ? SELECTED_ITEM_STYLE
                                : 'text-emerald-700'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Users size={14} />
                              인재풀
                              <span className="ml-auto text-xs">
                                {poolEmployees.length}
                              </span>
                            </span>
                          </button>
                        </div>

                        {isExpanded('pool') && (
                          <ul className="ml-5 border-l border-slate-200 pl-2">
                            {poolEmployees.map((employee) =>
                              renderEmployeeNode(employee, `pool-${employee.id}`),
                            )}
                            {poolEmployees.length === 0 && (
                              <li className="px-2 py-2 text-xs text-slate-400">
                                가용 인력이 없습니다.
                              </li>
                            )}
                          </ul>
                        )}
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {isSearching && employees.length === 0 && (
          <p className="px-3 py-5 text-center text-sm text-slate-400">
            일치하는 직원이 없습니다.
          </p>
        )}
      </div>
    </aside>
  );
}
