import { useState } from 'react';
import { ChevronDown, ChevronRight, Building2, User, Briefcase, Users, Edit3 } from 'lucide-react';
import { DEPARTMENT_CODES, compareEmployeesByPositionAndHireDate, type Employee, type Project } from '@/types/groupware';
import { employeeStatus, projectEmployeeIds, type DirectoryFilters } from '@/lib/employee-directory';

interface Props {
  employees: Employee[];
  projects: Project[];
  filters: DirectoryFilters;
  defaultDepartment?: string;
  onSelect: (filters: Partial<DirectoryFilters>) => void;
  onReset: () => void;
  onEdit?: (employee: Employee) => void;
}
export default function EmployeeOrgTree({ employees, projects, filters, defaultDepartment, onSelect, onReset, onEdit }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(['dept-DEPT_BIZ', `dept-${defaultDepartment}`]));
  const searching = Boolean(filters.query.trim());
  const toggle = (key: string) => setOpen(previous => { const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const expanded = (key: string) => searching || open.has(key);
  const selectedStyle = 'bg-indigo-50 text-indigo-800 font-semibold';
  const rowStyle = 'min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500';
  const choose = (selection: Partial<DirectoryFilters>) => onSelect({ department: 'ALL', position: 'ALL', availability: 'ALL', query: '', employeeId: null, projectId: null, ...selection });
  const person = (employee: Employee, key: string) => <li key={key} className="flex min-w-0 items-center gap-1">
    <button type="button" data-employee-id={employee.id} aria-pressed={filters.employeeId === employee.id} onClick={() => choose({ employeeId: employee.id, availability: employeeStatus(employee) === 'STATUS_RETIRED' ? 'RETIRED' : 'ALL' })} className={`${rowStyle} ${filters.employeeId === employee.id ? selectedStyle : 'text-slate-700'}`}>
      <span className="flex items-center gap-2"><User size={15} className="shrink-0 text-slate-400" /><span className="min-w-0 break-words">{employee.name} <span className="text-xs text-slate-500">{employee.position}</span></span></span>
    </button>
    {onEdit && <button type="button" aria-label={`${employee.name} 정보 수정`} onClick={() => onEdit(employee)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Edit3 size={14} /></button>}
  </li>;
  const disclosure = (key: string, label: string) => <button type="button" aria-label={`${label} ${expanded(key) ? '접기' : '펼치기'}`} aria-expanded={expanded(key)} disabled={searching} onClick={() => toggle(key)} className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40">{expanded(key) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>;
  const assigned = new Set(projects.flatMap(projectEmployeeIds));
  const pool = employees.filter(employee => employee.department_code === 'DEPT_BIZ' && employeeStatus(employee) === 'STATUS_ACTIVE' && !assigned.has(employee.id));
  return <aside aria-label="조직도" className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white shadow-xs xl:sticky xl:top-20 xl:w-72 2xl:w-80">
    <div className="border-b border-slate-100 px-4 py-3"><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">조직도</h2><button type="button" onClick={onReset} className="rounded px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">전체 보기</button></div><p className="mt-1 text-xs leading-relaxed text-slate-500">부서·프로젝트·직원을 선택하면 목록에 반영됩니다.</p></div>
    <div className="max-h-80 overflow-y-auto p-2 xl:max-h-[65vh]">
      {searching && <p role="status" className="px-2 py-2 text-xs text-indigo-600">검색 결과에 해당하는 조직과 직원만 표시합니다.</p>}
      <ul className="space-y-1">{DEPARTMENT_CODES.map(department => {
        const people = employees.filter(employee => employee.department_code === department.code).sort(compareEmployeesByPositionAndHireDate);
        const deptProjects = department.code === 'DEPT_BIZ' ? projects.filter(project => projectEmployeeIds(project).some(id => employees.some(employee => employee.id === id)) || (!searching && filters.availability === 'ALL')) : [];
        if (searching && !people.length && !deptProjects.length) return null;
        const key = `dept-${department.code}`;
        return <li key={key}><div className="flex items-center gap-1">{disclosure(key, department.label)}<button type="button" data-department-code={department.code} aria-pressed={filters.department === department.code} onClick={() => choose({ department: department.code })} className={`${rowStyle} ${filters.department === department.code ? selectedStyle : 'font-semibold text-slate-800'}`}><span className="flex items-center gap-2"><Building2 size={15} className="shrink-0" /><span className="flex-1">{department.label}</span><span className="text-xs tabular-nums text-slate-400">{people.length}</span></span></button></div>
          {expanded(key) && <ul className="ml-5 space-y-0.5 border-l border-slate-200 pl-2">
            {people.filter(employee => department.code !== 'DEPT_BIZ' || employeeStatus(employee) !== 'STATUS_ACTIVE').map(employee => person(employee, `${key}-${employee.id}`))}
            {deptProjects.map(project => {
              const members = employees.filter(employee => projectEmployeeIds(project).includes(employee.id)).sort(compareEmployeesByPositionAndHireDate);
              const projectKey = `project-${project.id}`;
              return <li key={projectKey}><div className="flex items-center gap-1">{disclosure(projectKey, project.name)}<button type="button" data-project-id={project.id} aria-pressed={filters.projectId === project.id} onClick={() => choose({ projectId: project.id })} className={`${rowStyle} ${filters.projectId === project.id ? selectedStyle : 'text-slate-700'}`}><span className="flex items-start gap-2"><Briefcase size={14} className="mt-0.5 shrink-0 text-indigo-500" /><span className="min-w-0 flex-1 break-words">{project.name}</span><span className="text-xs text-slate-400">{members.length}</span></span></button></div>{expanded(projectKey) && <ul className="ml-5 space-y-0.5 border-l border-slate-200 pl-2">{members.map(employee => person(employee, `${projectKey}-${employee.id}`))}{!members.length && <li className="px-2 py-2 text-xs text-slate-400">배정된 인원이 없습니다.</li>}</ul>}</li>;
            })}
            {department.code === 'DEPT_BIZ' && (!searching || pool.length > 0) && <li><div className="flex items-center gap-1">{disclosure('pool', '인재풀')}<button type="button" aria-pressed={filters.department === 'DEPT_POOL' || filters.availability === 'POOL'} onClick={() => choose({ department: 'DEPT_POOL' })} className={`${rowStyle} ${filters.department === 'DEPT_POOL' || filters.availability === 'POOL' ? selectedStyle : 'text-emerald-700'}`}><span className="flex items-center gap-2"><Users size={14} />인재풀<span className="ml-auto text-xs">{pool.length}</span></span></button></div>{expanded('pool') && <ul className="ml-5 border-l border-slate-200 pl-2">{pool.map(employee => person(employee, `pool-${employee.id}`))}{!pool.length && <li className="px-2 py-2 text-xs text-slate-400">가용 인력이 없습니다.</li>}</ul>}</li>}
          </ul>}
        </li>;
      })}</ul>
      {searching && !employees.length && <p className="px-3 py-5 text-center text-sm text-slate-400">일치하는 직원이 없습니다.</p>}
    </div>
  </aside>;
}
