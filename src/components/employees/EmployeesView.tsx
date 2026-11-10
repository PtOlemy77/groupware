'use client';

import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';
import EmployeeOrgTree from './EmployeeOrgTree';
import { initialDirectoryFilters, directoryPageNumbers, selectDirectoryEmployees, activeDirectoryProject, employeeStatus, projectEmployeeIds, type DirectoryFilters, type AvailabilityFilter } from '@/lib/employee-directory';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  TableEmpty,
} from '@/components/common/Table';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Employee,
  Project,
  Approval,
  AuthUser,
  RoleCode,
  StatusCode,
  EMP_STATUS_CODES,
  USER_ROLE_CODES,
  getRoleCode,
  normalizeUserRole,
  isSystemAdmin,
  isExecutiveOrAbove,
  isPmOrAbove,
  compareEmployeesByPositionAndHireDate,
  DEPARTMENT_CODES,
  POSITION_CODES,
  getDepartmentsFromCommonCodes,
  getPositionsFromCommonCodes,
  COMPANY_EMAIL_DOMAIN,
  cleanDeptName,
  CommonCode,
} from '@/types/groupware';
import {
  Users,
  Search,
  Plus,
  Edit3,
  Trash2,
  Mail,
  Phone,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Folder,
  User,
  X,
  CheckCircle2,
  AlertCircle,
  Network,
  UserX,
  Clock,
  Sparkles,
} from 'lucide-react';

interface Props {
  employees: Employee[];
  currentUser: AuthUser;
  projects?: Project[];
  approvals?: Approval[];
  commonCodes?: CommonCode[];
  onRefresh: () => Promise<void>;
}

// 입사일(YYYY-MM-DD)로부터 8자리 사번(YYYYMMDD)을 생성하는 헬퍼
function getEmpNoFromHireDate(hireDate?: string, defaultNo?: string): string {
  if (hireDate && hireDate.includes('-')) {
    return hireDate.replace(/-/g, '');
  }
  return defaultNo || '';
}

export interface TenureInfo {
  yearsOrder: number; // 사내 N년차 (한국식: 당해연도 - 입사연도 + 1)
  fullYears: number;  // 사내 만 N년 근속
  fullMonths: number; // 사내 만 N개월 근속
  tenureText: string; // 사내 근속 기간: "N년 M개월" 또는 "N개월"
  actualYearsOrder: number; // 인정 경력 + 사내 근속 합산 실제 N년차
  recognizedText: string; // 인정 경력: "N년 M개월"
  totalCareerMonths: number; // 통산 총 경력 개월수 (인정 경력 + 사내 근속)
  totalCareerText: string; // 통산 총 경력: "N년 M개월"
}

// 입사일 기준 사내 근속 및 인정 경력 합산 실제 연차 자동 계산 헬퍼
export function calcTenure(
  hireDate?: string,
  recognizedYears: number = 0,
  recognizedMonths: number = 0,
  targetDate = new Date()
): TenureInfo {
  const recY = Math.max(0, Number(recognizedYears) || 0);
  const recM = Math.max(0, Math.min(11, Number(recognizedMonths) || 0));
  const recognizedTotalMonths = recY * 12 + recM;

  const recognizedText =
    recY > 0 && recM > 0
      ? `${recY}년 ${recM}개월`
      : recY > 0
      ? `${recY}년`
      : recM > 0
      ? `${recM}개월`
      : '0년';

  if (!hireDate || !hireDate.includes('-')) {
    const actualYearsOrder = Math.max(1, recY + 1);
    return {
      yearsOrder: 1,
      fullYears: 0,
      fullMonths: 0,
      tenureText: '-',
      actualYearsOrder,
      recognizedText,
      totalCareerMonths: recognizedTotalMonths,
      totalCareerText: recognizedText,
    };
  }
  const parts = hireDate.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    const actualYearsOrder = Math.max(1, recY + 1);
    return {
      yearsOrder: 1,
      fullYears: 0,
      fullMonths: 0,
      tenureText: '-',
      actualYearsOrder,
      recognizedText,
      totalCareerMonths: recognizedTotalMonths,
      totalCareerText: recognizedText,
    };
  }
  const [hYear, hMonth, hDay] = parts;
  const tYear = targetDate.getFullYear();
  const tMonth = targetDate.getMonth() + 1;
  const tDay = targetDate.getDate();

  // 1. 한국식 사내 N년차 (입사 당해연도가 1년차)
  const yearsOrder = Math.max(1, tYear - hYear + 1);

  // 2. 사내 만 근속 기간 계산
  let internalMonths = (tYear - hYear) * 12 + (tMonth - hMonth);
  if (tDay < hDay) {
    internalMonths -= 1;
  }
  if (internalMonths < 0) {
    return {
      yearsOrder,
      fullYears: 0,
      fullMonths: 0,
      tenureText: '입사 예정',
      actualYearsOrder: Math.max(1, recY + 1),
      recognizedText,
      totalCareerMonths: recognizedTotalMonths,
      totalCareerText: recognizedText,
    };
  }

  const fullYears = Math.floor(internalMonths / 12);
  const remainingMonths = internalMonths % 12;

  let tenureText = '';
  if (fullYears > 0 && remainingMonths > 0) {
    tenureText = `${fullYears}년 ${remainingMonths}개월`;
  } else if (fullYears > 0) {
    tenureText = `${fullYears}년`;
  } else {
    tenureText = `${remainingMonths}개월`;
  }

  // 3. 실제 연차 = 사내 연차 + 인정 경력(년) + (잔여 개월수 합산 12개월 이상 시 보정)
  const extraYearsFromMonths = Math.floor((remainingMonths + recM) / 12);
  const actualYearsOrder = yearsOrder + recY + extraYearsFromMonths;

  // 4. 통산 총 경력 (인정 경력 + 사내 근속)
  const totalCareerMonths = internalMonths + recognizedTotalMonths;
  const totalYears = Math.floor(totalCareerMonths / 12);
  const totalRemMonths = totalCareerMonths % 12;
  let totalCareerText = '';
  if (totalYears > 0 && totalRemMonths > 0) {
    totalCareerText = `${totalYears}년 ${totalRemMonths}개월`;
  } else if (totalYears > 0) {
    totalCareerText = `${totalYears}년`;
  } else {
    totalCareerText = `${totalRemMonths}개월`;
  }

  return {
    yearsOrder,
    fullYears,
    fullMonths: internalMonths,
    tenureText,
    actualYearsOrder,
    recognizedText,
    totalCareerMonths,
    totalCareerText,
  };
}

export default function EmployeesView({
  employees,
  currentUser,
  projects = [],
  approvals = [],
  commonCodes = [],
  onRefresh,
}: Props) {
  const [filters, setFilters] = useState<DirectoryFilters>({ ...initialDirectoryFilters });
  const { query: searchQuery, department: deptFilter, position: positionFilter, availability: availabilityFilter } = filters;
  const [showOrgTree, setShowOrgTree] = useState(true);
  const resultsRef = useRef<HTMLDivElement>(null);
  const updateFilters = (patch: Partial<DirectoryFilters>) => { setFilters(previous => ({ ...previous, ...patch })); setCurrentPage(1); };
  const resetFilters = () => { setFilters({ ...initialDirectoryFilters }); setCurrentPage(1); };
  const selectFromOrg = (patch: Partial<DirectoryFilters>) => {
    updateFilters(patch);
    if (window.innerWidth < 1280) requestAnimationFrame(() => {
      resultsRef.current?.focus({ preventScroll: true });
      resultsRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };
  const selectAvailability = (availability: AvailabilityFilter) => { setFilters({ ...initialDirectoryFilters, availability }); setCurrentPage(1); };
  const activeProjects = useMemo(() => projects.filter(project => activeDirectoryProject(project, approvals)), [projects, approvals]);
  const getProjectMemberIds = projectEmployeeIds;
  const { showAlert, showConfirm } = useModal();

  // 페이지네이션 상태 (사용자 요청: 5/10/15/20명 단위로 축소하여 스크롤 최적화)
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 정렬 상태 (기본 정렬: 직급 서열 및 입사일)
  const [sortBy, setSortBy] = useState<'emp_no' | 'name' | 'position' | 'hire_date'>('position');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [initialPassword, setInitialPassword] = useState('');
  const [emailId, setEmailId] = useState('');
  const [formData, setFormData] = useState<Partial<Employee>>({});

  // DB(common_codes)에서 부서 및 직급 동적 조회 (DB 우선 연동)
  const departmentOptions = useMemo(() => {
    return getDepartmentsFromCommonCodes(commonCodes);
  }, [commonCodes]);

  const positionOptions = useMemo(() => {
    return getPositionsFromCommonCodes(commonCodes);
  }, [commonCodes]);

  const canEdit = isSystemAdmin(currentUser);

  // 현재 DB에 실제로 존재하는 활성 프로젝트(진행중/수행)에 투입된 직원 명단만 매핑
  // (삭제된 프로젝트나 과거 계약품의서의 유령 프로젝트가 노출되지 않도록 실제 projects 테이블만 기준)
  const assignedProjectsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    activeProjects
      .forEach((prj) => {
        const names = getProjectMemberIds(prj);
        names.forEach((name) => {
          if (!map[name]) map[name] = [];
          if (!map[name].includes(prj.name)) {
            map[name].push(prj.name);
          }
        });
      });

    return map;
  }, [activeProjects]);

  // 직원의 실질적 가용 상태 판별
  // 1. 퇴사 -> 퇴사
  // 2. 휴직 -> 휴직
  // 3. 프로젝트 투입중 -> 진행중인 프로젝트에 배정된 경우 (부서 무관)
  // 4. 사업본부 미투입 인력 -> '투입대기' (회사에서 신규 프로젝트에 즉시 투입 가능한 실질적 가용인원!)
  // 5. 기타 부서 미투입 인력 -> '부서고유업무' (연구개발, 경영지원 등 본연의 업무 수행)
  const getEmployeeAvailability = (emp: Employee): {
    status: 'POOL' | 'ASSIGNED' | 'DEPARTMENT' | 'LEAVE' | 'RETIRED';
    label: string;
    isBizDept: boolean;
    projects: string[];
  } => {
    if (employeeStatus(emp) === 'STATUS_RETIRED') {
      return { status: 'RETIRED', label: '퇴사', isBizDept: false, projects: [] };
    }
    if (employeeStatus(emp) === 'STATUS_LEAVE') {
      return { status: 'LEAVE', label: '휴직', isBizDept: false, projects: [] };
    }
    const currentPrjs = assignedProjectsMap[emp.id] || [];
    const isBiz =
      emp.department_code === 'DEPT_BIZ';

    if (currentPrjs.length > 0) {
      return {
        status: 'ASSIGNED',
        label: '프로젝트 투입중',
        isBizDept: isBiz,
        projects: currentPrjs,
      };
    }

    if (isBiz) {
      return {
        status: 'POOL',
        label: '사업본부 가용 (대기)',
        isBizDept: true,
        projects: [],
      };
    }

    return {
      status: 'DEPARTMENT',
      label: '부서 고유업무',
      isBizDept: false,
      projects: [],
    };
  };

  // 상단 가용인원 통계: 가용인원은 프로젝트에 투입되지 않은 '사업본부' 인력으로만 표시
  const stats = useMemo(() => {
    const total = employees.length;
    let activeAssigned = 0; // 전사 프로젝트 투입중
    let bizAvailable = 0;   // 사업본부 가용인력 (프로젝트 미투입 사업본부 인력)
    let bizTotal = 0;       // 사업본부 총원
    let suspended = 0;      // 휴직
    let retired = 0;        // 퇴사
    let otherDeptCount = 0; // 타 부서 고유업무

    employees.forEach((emp) => {
      const avail = getEmployeeAvailability(emp);
      const isBiz =
        emp.department_code === 'DEPT_BIZ';

      if (isBiz && employeeStatus(emp) === 'STATUS_ACTIVE') bizTotal++;

      if (avail.status === 'RETIRED') {
        retired++;
      } else if (avail.status === 'LEAVE') {
        suspended++;
      } else if (avail.status === 'ASSIGNED') {
        activeAssigned++;
      } else if (avail.status === 'POOL') {
        bizAvailable++;
      } else {
        otherDeptCount++;
      }
    });

    const activeTotal = total - retired;
    const assignmentRate = activeTotal > 0 ? Math.round((activeAssigned / activeTotal) * 100) : 0;
    const bizAvailabilityRate = bizTotal > 0 ? Math.round((bizAvailable / bizTotal) * 100) : 0;

    return {
      total,
      activeTotal,
      activeAssigned,
      bizAvailable,
      bizTotal,
      suspended,
      retired,
      otherDeptCount,
      assignmentRate,
      bizAvailabilityRate,
    };
  }, [employees, assignedProjectsMap]);

  // 필터링 및 정렬
  const filteredEmployees = useMemo(() => {
    const list = selectDirectoryEmployees(employees, projects, approvals, filters);
    return list.sort((a, b) => {
      if (
        sortBy === 'position' ||
        (deptFilter === 'DEPT_BIZ' && sortBy !== 'name' && sortBy !== 'hire_date')
      ) {
        const cmp = compareEmployeesByPositionAndHireDate(a, b);
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      if (sortBy === 'hire_date') {
        const dateA = a.hire_date || '';
        const dateB = b.hire_date || '';
        const cmp = dateA.localeCompare(dateB);
        return sortOrder === 'asc' ? cmp : -cmp;
      }

      const empNoA = getEmpNoFromHireDate(a.hire_date, a.emp_no);
      const empNoB = getEmpNoFromHireDate(b.hire_date, b.emp_no);

      if (sortBy === 'emp_no') {
        return sortOrder === 'asc' ? empNoA.localeCompare(empNoB) : empNoB.localeCompare(empNoA);
      }

      let valA: string = a[sortBy] || '';
      let valB: string = b[sortBy] || '';
      const cmp = valA.localeCompare(valB, 'ko');
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [employees, projects, approvals, filters, sortBy, sortOrder]);

  const treeEmployees = useMemo(() => selectDirectoryEmployees(employees, projects, approvals, {
    ...filters, department: 'ALL', employeeId: null, projectId: null,
  }), [employees, projects, approvals, filters]);

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / (pageSize || 1)));
  const safePage = Math.min(currentPage, totalPages);
  const pageNumbers = directoryPageNumbers(totalPages, safePage);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);
  const paginatedEmployees = useMemo(() => {
    if (pageSize === 0) return filteredEmployees;
    const start = (safePage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, safePage, pageSize]);

  const handleSort = (field: 'emp_no' | 'name' | 'position' | 'hire_date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const openCreateModal = () => {
    setInitialPassword('');
    setEditingEmp(null);
    setEmailId('');
    const defaultHireDate = new Date().toISOString().split('T')[0];
    const defaultEmpNo = `EMP-${crypto.randomUUID()}`;

    setFormData({
      emp_no: defaultEmpNo,
      name: '',
      department_code: 'DEPT_BIZ',
      department: '사업본부',
      position_code: 'POS_STAFF',
      position: '담당',
      email: '',
      phone: '010-0000-0000',
      hire_date: defaultHireDate,
      status: '재직',
      avatar_color: 'indigo',
      role: '일반직원',
      recognized_career_years: 0,
      recognized_career_months: 0,
    });
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setInitialPassword('');
    setEditingEmp(emp);
    const idPart = emp.email?.includes('@') ? emp.email.split('@')[0] : (emp.email || '');
    setEmailId(idPart);
    const matchedDept = departmentOptions.find(
      (d) => d.code === emp.department_code || d.label === emp.department
    );
    const matchedPos = positionOptions.find(
      (p) => p.code === emp.position_code || p.label === emp.position
    );

    setFormData({
      ...emp,
      department_code: matchedDept?.code || emp.department_code || 'DEPT_RND',
      department: matchedDept?.label || emp.department || '기술연구소',
      position_code: matchedPos?.code || emp.position_code || 'POS_STAFF',
      position: matchedPos?.label || emp.position || '담당',
      role: normalizeUserRole(emp.role, emp.position),
      recognized_career_years: emp.recognized_career_years ?? 0,
      recognized_career_months: emp.recognized_career_months ?? 0,
    });
    setModalOpen(true);
  };

  // 입사일 변경 시 사번(YYYYMMDD) 자동 동기화
  const handleHireDateChange = (hireDate: string) => {
    const autoEmpNo = hireDate.replace(/-/g, '');
    setFormData((prev) => ({
      ...prev,
      hire_date: hireDate,
      emp_no: prev.emp_no ? prev.emp_no : autoEmpNo,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const trimmedId = emailId.trim();
      const finalEmail = trimmedId
        ? (trimmedId.includes('@') ? trimmedId : `${trimmedId}${COMPANY_EMAIL_DOMAIN}`)
        : (formData.email || '');

      const deptObj = departmentOptions.find((d) => d.code === formData.department_code);
      const posObj = positionOptions.find((p) => p.code === formData.position_code);
      const statusObj = EMP_STATUS_CODES.find(
        (s) => s.code === formData.status_code || s.label === formData.status
      );

      const roleCode = getRoleCode(formData.role_code || formData.role);
      const roleInfo = USER_ROLE_CODES.find((r) => r.code === roleCode);

      const payload = {
        ...formData,
        recognized_career_years: Math.max(0, Number(formData.recognized_career_years) || 0),
        recognized_career_months: Math.max(0, Math.min(11, Number(formData.recognized_career_months) || 0)),
        ...(initialPassword ? { password: initialPassword } : {}),
        emp_no: formData.emp_no || getEmpNoFromHireDate(formData.hire_date, formData.emp_no),
        email: finalEmail,
        department_code: deptObj?.code || formData.department_code || 'DEPT_RND',
        department: deptObj?.label || formData.department || '기술연구소',
        position_code: posObj?.code || formData.position_code || 'POS_STAFF',
        position: posObj?.label || formData.position || '담당',
        role_code: roleCode,
        role: roleInfo?.label || formData.role || '일반직원',
        status_code: statusObj?.code || formData.status_code || 'STATUS_ACTIVE',
        status: statusObj?.label || formData.status || '재직',
      };

      const targetId = editingEmp ? editingEmp.id : formData.id;
      const targetVersion = editingEmp?.version ?? formData.version;
      const res = await apiFetch('/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'employees',
          action: editingEmp ? 'update' : 'create',
          id: targetId,
          version: targetVersion,
          data: {
            ...payload,
            version: targetVersion,
          },
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        await showAlert(resData.message || '직원 정보 저장 중 서버 응답 오류가 발생했습니다.', {
          type: 'error',
        });
        return;
      }

      setModalOpen(false);
      await onRefresh();
      await showAlert(`[${payload.name}] 직원 정보가 성공적으로 저장되었습니다.`, {
        type: 'success',
      });
    } catch (err) {
      console.error('Failed to save employee:', err);
      await showAlert('직원 정보 저장에 실패했습니다. 네트워크 또는 서버 상태를 확인해주세요.', {
        type: 'error',
      });
    }
  };

  const handleRetire = async (employee: Employee) => {
    if (!canEdit || employee.id === currentUser.id) return;
    const confirmed = await showConfirm(`${employee.name} 직원을 퇴사 처리하고 계정을 비활성화할까요? 기존 업무 이력은 보존됩니다.`, { title: '직원 퇴사 처리', isDanger: true, confirmText: '퇴사 처리' });
    if (!confirmed) return;
    try {
      await apiFetch('/api/groupware', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'employees', action: 'update', id: employee.id, version: employee.version, data: { status_code: 'STATUS_RETIRED', account_enabled: false } }) });
      await onRefresh();
      void showAlert('퇴사 처리했습니다. 직원 이력은 퇴사 탭에서 확인할 수 있습니다.', { type: 'success' });
    } catch (error) { void showAlert(error instanceof Error ? error.message : '퇴사 처리에 실패했습니다.', { type: 'error', autoClose: false }); }
  };

  return (
    <div className="space-y-4">
      <section aria-label="직원 검색 및 필터" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
        {/* 상단: 검색어, 부서, 직급 필터 */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor="employee-directory-search" className="mb-1.5 block text-xs font-semibold text-slate-600">
              직원·프로젝트 검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={17} />
              <input
                id="employee-directory-search"
                value={searchQuery}
                onChange={event => updateFilters({ query: event.target.value, employeeId: null })}
                placeholder="이름, 사번, 부서, 직급, 연락처, 프로젝트"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() => updateFilters({ query: '', employeeId: null })}
                  className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="employee-department-filter" className="mb-1.5 block text-xs font-semibold text-slate-600">
              소속 부서
            </label>
            <select
              id="employee-department-filter"
              value={deptFilter}
              onChange={event => updateFilters({ department: event.target.value, employeeId: null, projectId: null })}
              className="max-w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="ALL">전체 부서</option>
              <option value="DEPT_POOL">인재풀 · 가용 {stats.bizAvailable}명</option>
              {departmentOptions.map(department => (
                <option key={department.code} value={department.code}>
                  {department.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="employee-position-filter" className="mb-1.5 block text-xs font-semibold text-slate-600">
              직급
            </label>
            <select
              id="employee-position-filter"
              value={positionFilter}
              onChange={event => updateFilters({ position: event.target.value, employeeId: null })}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="ALL">전체 직급</option>
              {positionOptions.map(position => (
                <option key={position.code} value={position.code}>
                  {position.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            조건 초기화
          </button>
        </div>

        {/* 하단: 직원 상태 필터 탭, 조직도 토글 버튼, 페이지 크기, 등록 버튼 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="직원 상태">
              {([
                ['ALL', `전체 (${stats.activeTotal})`],
                ['ASSIGNED', `프로젝트 투입 (${stats.activeAssigned})`],
                ['POOL', `인재풀 (${stats.bizAvailable})`],
                ['LEAVE', `휴직 (${stats.suspended})`],
                ['RETIRED', `퇴사 (${stats.retired})`],
              ] as [AvailabilityFilter, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={availabilityFilter === value}
                  onClick={() => selectAvailability(value)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    availabilityFilter === value
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              aria-expanded={showOrgTree}
              onClick={() => setShowOrgTree(!showOrgTree)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Network size={16} />
              조직도 {showOrgTree ? '접기' : '펼치기'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="employee-page-size" className="text-xs text-slate-500">
              페이지당 인원
            </label>
            <select
              id="employee-page-size"
              value={pageSize}
              onChange={event => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              {[5, 10, 15, 20].map(size => (
                <option key={size} value={size}>
                  {size}명씩 보기
                </option>
              ))}
            </select>
            {canEdit && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus size={17} />
                신규 직원 등록
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="flex min-w-0 flex-col items-stretch gap-4 xl:flex-row xl:items-start">
        {showOrgTree && (
          <EmployeeOrgTree
            employees={treeEmployees}
            projects={activeProjects}
            filters={filters}
            defaultDepartment={currentUser.department_code}
            departmentOptions={departmentOptions}
            onSelect={selectFromOrg}
            onReset={resetFilters}
            onEdit={canEdit ? openEditModal : undefined}
          />
        )}
        {/* 메인 목록 테이블 (담당업무/기술스택 제외, 사번=입사일, 가용인원 명확 표시) */}
        <div ref={resultsRef} id="employee-directory-results" tabIndex={-1} role="region" aria-label="직원 검색 결과" className="scroll-mt-20 min-w-0 flex-1 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div role="status" aria-live="polite" className="flex min-w-0 flex-wrap items-center gap-2"><span>조회 인원: <strong data-testid="employee-result-count">{filteredEmployees.length}</strong>명</span>
              {filters.projectId !== null && <button type="button" aria-label="프로젝트 선택 해제" onClick={() => updateFilters({ projectId: null })} className="flex items-center gap-1 rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">{projects.find(project => project.id === filters.projectId)?.name || '선택한 프로젝트'}<X size={12} /></button>}
              {filters.employeeId !== null && <button type="button" aria-label="직원 선택 해제" onClick={() => updateFilters({ employeeId: null })} className="flex items-center gap-1 rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">{employees.find(employee => employee.id === filters.employeeId)?.name || '선택한 직원'}<X size={12} /></button>}
              {deptFilter !== 'ALL' && <span className="rounded bg-slate-200 px-2 py-1 text-xs">{deptFilter === 'DEPT_POOL' ? '인재풀 · 프로젝트 미투입' : departmentOptions.find(department => department.code === deptFilter)?.label}</span>}
              {positionFilter !== 'ALL' && <span className="text-xs text-slate-500">{positionOptions.find(position => position.code === positionFilter)?.label}</span>}
              {searchQuery && <span className="break-all text-xs text-slate-500">검색: {searchQuery}</span>}
            </div><span className="text-xs text-slate-400">{safePage} / {totalPages} 페이지</span>
          </div>

          <div className="overflow-x-auto" role="region" aria-label="직원 목록 가로 스크롤" tabIndex={0}>
            <Table aria-label="직원 목록" className="min-w-[720px]">
              <TableHead>
                <tr>
                  <TableHeaderCell
                    aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="w-32 cursor-pointer hover:bg-slate-200/60 transition"
                  >
                    <button type="button" aria-label="성명 정렬" onClick={() => handleSort('name')} className="flex w-full items-center gap-1 text-left font-bold text-slate-600">
                      <span>성명</span>
                      {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell
                    aria-sort={sortBy === 'position' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="w-36 cursor-pointer hover:bg-slate-200/60 transition"
                  >
                    <button type="button" aria-label="직급 정렬" onClick={() => handleSort('position')} className="flex w-full items-center gap-1 text-left font-bold text-slate-600">
                      <span>직급 / 권한</span>
                      {sortBy === 'position' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </button>
                  </TableHeaderCell>
                  <TableHeaderCell className="min-w-[200px]">프로젝트명</TableHeaderCell>
                  <TableHeaderCell className="min-w-[220px]">연락처 / 이메일</TableHeaderCell>
                  <TableHeaderCell
                    aria-sort={sortBy === 'hire_date' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className="w-32 cursor-pointer hover:bg-slate-200/60 transition"
                  >
                    <button type="button" aria-label="입사일 정렬" onClick={() => handleSort('hire_date')} className="flex w-full items-center gap-1 text-left font-bold text-slate-600">
                      <span>입사일</span>
                      {sortBy === 'hire_date' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </button>
                  </TableHeaderCell>
                  {canEdit && <TableHeaderCell align="center" className="sticky right-0 bg-slate-50 w-20">관리</TableHeaderCell>}
                </tr>
              </TableHead>
              <TableBody>
                {paginatedEmployees.map((emp) => {
                  const avail = getEmployeeAvailability(emp);
                  const empRoleCode = getRoleCode(emp);
                  const empRoleLabel = normalizeUserRole(emp);
                  const roleBadgeClass =
                    empRoleCode === 'ROLE_ADMIN'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : empRoleCode === 'ROLE_EXEC'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : empRoleCode === 'ROLE_PM'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200';

                  return (
                    <TableRow
                      key={emp.id}
                      onClick={(e) => {
                        // 액션 버튼이나 링크 클릭 시에는 행 클릭 이벤트 방지
                        if ((e.target as HTMLElement).closest('button, a')) return;
                        if (canEdit) openEditModal(emp);
                      }}
                      className={canEdit ? 'cursor-pointer' : ''}
                      title={canEdit ? '클릭하여 직원 정보 수정' : ''}
                    >
                      {/* 성명 */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                              employeeStatus(emp) === 'STATUS_RETIRED'
                                ? 'bg-slate-200 text-slate-500'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {emp.name.slice(0, 1)}
                          </div>
                          <span
                            className={`font-semibold ${
                              employeeStatus(emp) === 'STATUS_RETIRED'
                                ? 'text-slate-400 line-through'
                                : 'text-slate-900'
                            }`}
                          >
                            {emp.name}
                          </span>
                          {employeeStatus(emp) === 'STATUS_RETIRED' && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              퇴사
                            </span>
                          )}
                          {employeeStatus(emp) === 'STATUS_LEAVE' && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              휴직
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* 직급 / 시스템 권한 등급 */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                            {emp.position}
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${roleBadgeClass}`}
                          >
                            {empRoleLabel}
                          </span>
                        </div>
                      </TableCell>

                      {/* 프로젝트명 */}
                      <TableCell>
                        {avail.projects.length > 0 ? (
                          <span className="font-semibold text-slate-800">
                            {avail.projects.join(', ')}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>

                      {/* 연락처 / 이메일 통합 표시 */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-slate-800 text-xs flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {emp.phone || '-'}
                          </span>
                          {emp.email ? (
                            <a
                              href={`mailto:${emp.email}`}
                              className="font-mono text-slate-500 hover:text-indigo-600 hover:underline text-xs flex items-center gap-1.5"
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {emp.email || '-'}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">연락처 비공개</span>
                          )}
                        </div>
                      </TableCell>

                      {/* 입사일 */}
                      <TableCell className="whitespace-nowrap text-xs font-mono text-slate-600">
                        {emp.hire_date || '-'}
                      </TableCell>

                      {/* 관리 액션 */}
                      {canEdit && (
                        <TableCell align="center" className="sticky right-0 bg-white whitespace-nowrap shadow-[-4px_0_8px_-6px_#94a3b8]">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(emp)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                              aria-label={`${emp.name} 정보 수정`}
                              title="직원 정보 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => void handleRetire(emp)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                              title="직원 퇴사 처리"
                              aria-label={`${emp.name} 퇴사 처리`}
                              disabled={emp.id === currentUser.id || employeeStatus(emp) === 'STATUS_RETIRED'}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {filteredEmployees.length === 0 && (
                  <TableEmpty
                    colSpan={canEdit ? 6 : 5}
                    message="검색 조건에 일치하는 직원이 없습니다."
                  />
                )}
              </TableBody>
            </Table>
          </div>

          {/* 페이지네이션 컨트롤 */}
          {pageSize > 0 && totalPages > 1 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">
                총 {filteredEmployees.length}명 중 {(safePage - 1) * pageSize + 1} -{' '}
                {Math.min(safePage * pageSize, filteredEmployees.length)}명 표시
              </span>

              <div className="flex max-w-full flex-wrap items-center gap-1">
                <button
                  aria-label="직원 이전 페이지"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                </button>

                {pageNumbers.map((pg, index) => (
                  <React.Fragment key={pg}>
                  {index > 0 && pg > pageNumbers[index - 1] + 1 && <span aria-hidden="true" className="px-1 text-slate-400">…</span>}
                  <button
                    key={pg}
                    aria-label={`직원 ${pg}페이지`}
                    aria-current={safePage === pg ? 'page' : undefined}
                    onClick={() => setCurrentPage(pg)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                      safePage === pg
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-white border border-transparent'
                    }`}
                  >
                    {pg}
                  </button>
                  </React.Fragment>
                ))}

                <button
                  aria-label="직원 다음 페이지"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 신규 직원 등록 / 수정 모달 (입사일이 사번이 되고, 기술스택 제외) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingEmp ? '직원 정보 수정' : '신규 직원 등록'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* 입사일 & 사번 (입사연월일이 사번이 됨) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    입사일 <span className="text-indigo-600 font-normal">(사번 자동 생성)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.hire_date || ''}
                    onChange={(e) => handleHireDateChange(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    사번 <span className="text-slate-400 font-normal">(입사연월일 YYYYMMDD)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.emp_no || ''}
                    onChange={(e) => setFormData({ ...formData, emp_no: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold text-indigo-700 bg-white"
                  />
                </div>
              </div>

              {/* 인정 경력 (외부 경력 인정 기간) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    인정 경력 (년)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={70}
                      value={formData.recognized_career_years ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recognized_career_years: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full p-2.5 pr-8 border border-slate-300 rounded-xl font-semibold"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 select-none pointer-events-none">
                      년
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    인정 경력 (개월)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={11}
                      value={formData.recognized_career_months ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recognized_career_months: Math.min(
                            11,
                            Math.max(0, parseInt(e.target.value) || 0)
                          ),
                        })
                      }
                      className="w-full p-2.5 pr-10 border border-slate-300 rounded-xl font-semibold"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 select-none pointer-events-none">
                      개월
                    </span>
                  </div>
                </div>
              </div>

              {/* 인정경력 + 사내 근속 합산 실제 연차 계산 안내 카드 */}
              {formData.hire_date && (() => {
                const tenure = calcTenure(
                  formData.hire_date,
                  formData.recognized_career_years || 0,
                  formData.recognized_career_months || 0
                );
                return (
                  <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        실제 연차 계산 <span className="text-slate-500 font-normal">(인정경력 + 사내근속)</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-indigo-700 bg-white border border-indigo-300 px-2 py-0.5 rounded-lg shadow-2xs">
                          실제 {tenure.actualYearsOrder}년차
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          (사내 {tenure.yearsOrder}년차)
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-indigo-100/90 grid grid-cols-3 gap-1 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-xs">인정 경력</span>
                        <strong className="text-slate-800 font-semibold">{tenure.recognizedText}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-xs">사내 근속</span>
                        <strong className="text-slate-800 font-semibold">만 {tenure.tenureText}</strong>
                      </div>
                      <div>
                        <span className="text-indigo-600 block text-xs font-bold">통산 총 경력</span>
                        <strong className="text-indigo-950 font-extrabold">{tenure.totalCareerText}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 성명 & 소속 부서 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">성명</label>
                  <input
                    type="text"
                    required
                    placeholder="성명 입력"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">소속 부서</label>
                  <select
                    value={formData.department_code || 'DEPT_RND'}
                    onChange={(e) => setFormData({ ...formData, department_code: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    {departmentOptions.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 직급 & 근무/가용 상태 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">직급</label>
                  <select
                    value={formData.position_code || 'POS_STAFF'}
                    onChange={(e) => {
                      const nextPosCode = e.target.value;
                      const posObj = positionOptions.find((p) => p.code === nextPosCode);
                      const nextPosLabel = posObj?.label || '담당';
                      // 직급과 권한은 완전히 별개: 직급 변경 시 권한(role)은 영향받지 않고 유지
                      setFormData({
                        ...formData,
                        position_code: nextPosCode,
                        position: nextPosLabel,
                      });
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    {positionOptions.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">근무 / 재직 상태</label>
                  <select
                    value={formData.status_code || (formData.status === '휴직' ? 'STATUS_LEAVE' : formData.status === '퇴사' ? 'STATUS_RETIRED' : 'STATUS_ACTIVE')}
                    onChange={(e) => {
                      const sc = EMP_STATUS_CODES.find((s) => s.code === e.target.value);
                      setFormData({
                        ...formData,
                        status_code: e.target.value as StatusCode,
                        status: sc?.label || '재직',
                      });
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    {EMP_STATUS_CODES.map((sc) => (
                      <option key={sc.code} value={sc.code}>
                        {sc.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 시스템 권한 등급 (코드 기반 관리) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  그룹웨어 권한 등급
                </label>
                <select
                  value={getRoleCode(formData.role_code || formData.role)}
                  onChange={(e) => {
                    const rc = USER_ROLE_CODES.find((r) => r.code === e.target.value);
                    setFormData({
                      ...formData,
                      role_code: e.target.value as RoleCode,
                      role: rc?.label || '일반직원',
                    });
                  }}
                  className="w-full p-2.5 border border-indigo-300 rounded-xl bg-white font-bold text-indigo-900"
                >
                  {USER_ROLE_CODES.map((rc) => (
                    <option key={rc.code} value={rc.code}>
                      {rc.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="block font-semibold">{editingEmp ? '비밀번호 재설정 (선택)' : '초기 비밀번호 (필수)'}
                <input type="password" autoComplete="new-password" minLength={12} required={!editingEmp} value={initialPassword} onChange={e => setInitialPassword(e.target.value)} className="w-full border rounded p-2 mt-1" />
                <span className="text-xs text-slate-500">12자 이상. 최초 로그인 후 변경해야 합니다.</span>
              </label>
              {/* 사내 이메일 계정 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">사내 이메일 계정</label>
                <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white">
                  <input
                    type="text"
                    required
                    placeholder="아이디 입력"
                    value={emailId}
                    onChange={(e) => setEmailId(e.target.value)}
                    className="flex-1 p-2.5 outline-none font-semibold text-slate-800"
                  />
                  <span className="px-3 py-2.5 bg-slate-100 text-slate-500 font-medium select-none border-l border-slate-200">
                    {COMPANY_EMAIL_DOMAIN}
                  </span>
                </div>
              </div>

              {/* 연락처 */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">연락처</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
                >
                  {editingEmp ? '수정 완료' : '직원 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
