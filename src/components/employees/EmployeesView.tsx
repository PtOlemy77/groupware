'use client';

import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';

import React, { useState, useMemo, useEffect } from 'react';
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
  Briefcase,
  AlertCircle,
  Network,
  UserCheck,
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

export default function EmployeesView({
  employees,
  currentUser,
  projects = [],
  approvals = [],
  commonCodes = [],
  onRefresh,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'전체' | '투입대기' | '투입중' | '부서고유업무' | '휴직' | '퇴사'>('전체');
  const [positionFilter, setPositionFilter] = useState('ALL');

  // 프로젝트가 조직도 및 투입현황에 표시될 활성 상태인지 판별 ('프로젝트 수행', '제안준비중', '진행중', '검토중' 또는 계약품의서가 등록된 과제)
  const isActiveProject = (prj: Project): boolean => {
    const st = (prj.status || '').trim();
    if (
      st === '프로젝트 수행' ||
      st === '진행중' ||
      st === '제안준비중' ||
      st === '검토중'
    ) {
      return true;
    }
    // 계약품의서에 등록된 프로젝트인 경우에도 표시 (단, 완료 제외)
    if (st !== '완료') {
      const hasContract = approvals.some(
        (ap) =>
          (ap.category === '계약품의' || ap.category === '계약품의서') &&
          (ap.project_name === prj.name || ap.title === prj.name)
      );
      if (hasContract) return true;
    }
    return false;
  };

  const getProjectMemberIds = (prj: Project): number[] => [...new Set([prj.pm_id, ...(prj.member_ids || [])].filter((id): id is number => !!id))];
  const getProjectMemberNames = (prj: Project): string[] => getProjectMemberIds(prj).map(id => employees.find(e => e.id === id)?.name || '미등록 직원');
  const isUserProject = (prj: Project) => getProjectMemberIds(prj).includes(currentUser.id);

  // 현재 로그인 사용자의 부서 코드
  const myDeptCode = useMemo(() => {
    if (!currentUser) return '';
    const found = DEPARTMENT_CODES.find(
      (d) => cleanDeptName(d.label) === cleanDeptName(currentUser.department)
    );
    return found?.code || currentUser.department_code || '';
  }, [currentUser]);

  // 내가 속한 프로젝트 목록
  const myProjects = useMemo(() => {
    return projects.filter((p) => isActiveProject(p) && isUserProject(p));
  }, [projects, approvals, currentUser]);

  // 조직도 패널 표시 여부
  const [showOrgTree, setShowOrgTree] = useState(true);

  // 조직도 부서 접힘/펼침: 내 부서 및 프로젝트가 있는 사업본부(DEPT_BIZ) 기본 펼침
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { DEPT_BIZ: true };
    if (myDeptCode) init[myDeptCode] = true;
    return init;
  });

  // 사업본부 하위 프로젝트 접힘/펼침
  const [showBizProjects, setShowBizProjects] = useState<boolean>(true);

  // 개별 프로젝트 세부 펼침 (내가 속한 프로젝트가 먼저 펼쳐지고, 없으면 수행중인 프로젝트 기본 펼침)
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    if (myProjects.length > 0) {
      myProjects.forEach((p) => {
        init[p.id] = true;
      });
    } else {
      projects.filter(isActiveProject).forEach((p) => {
        init[p.id] = true;
      });
    }
    return init;
  });

  // 사용자 또는 프로젝트 변경 시 내 부서/프로젝트 자동 펼침 동기화
  useEffect(() => {
    if (!currentUser) return;
    const nextDepts: Record<string, boolean> = { DEPT_BIZ: true };
    if (myDeptCode) nextDepts[myDeptCode] = true;
    setExpandedDepts(nextDepts);
    setShowBizProjects(true);

    const nextPrjs: Record<number, boolean> = {};
    if (myProjects.length > 0) {
      myProjects.forEach((p) => {
        nextPrjs[p.id] = true;
      });
    } else {
      projects.filter(isActiveProject).forEach((p) => {
        nextPrjs[p.id] = true;
      });
    }
    setExpandedProjects(nextPrjs);
  }, [currentUser?.emp_no, myDeptCode, projects.length, approvals.length]);

  const { showAlert, showConfirm } = useModal();

  // 페이지네이션 상태
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 정렬 상태 (기본 정렬: 직급 서열 및 입사일)
  const [sortBy, setSortBy] = useState<'emp_no' | 'name' | 'position' | 'hire_date'>('position');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [initialPassword, setInitialPassword] = useState('');
  const [emailId, setEmailId] = useState('');
  const [formData, setFormData] = useState<Partial<Employee>>({});

  const canEdit = isSystemAdmin(currentUser);

  // 현재 DB에 실제로 존재하는 활성 프로젝트(진행중/수행)에 투입된 직원 명단만 매핑
  // (삭제된 프로젝트나 과거 계약품의서의 유령 프로젝트가 노출되지 않도록 실제 projects 테이블만 기준)
  const assignedProjectsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    projects
      .filter(isActiveProject)
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
  }, [projects]);

  // 직원의 실질적 가용 상태 판별
  // 1. 퇴사 -> 퇴사
  // 2. 휴직 -> 휴직
  // 3. 프로젝트 투입중 -> 진행중인 프로젝트에 배정된 경우 (부서 무관)
  // 4. 사업본부 미투입 인력 -> '투입대기' (회사에서 신규 프로젝트에 즉시 투입 가능한 실질적 가용인원!)
  // 5. 기타 부서 미투입 인력 -> '부서고유업무' (연구개발, 경영지원 등 본연의 업무 수행)
  const getEmployeeAvailability = (emp: Employee): {
    status: '투입대기' | '투입중' | '부서고유업무' | '휴직' | '퇴사';
    label: string;
    isBizDept: boolean;
    projects: string[];
  } => {
    if (emp.status === '퇴사') {
      return { status: '퇴사', label: '퇴사', isBizDept: false, projects: [] };
    }
    if (emp.status === '휴직') {
      return { status: '휴직', label: '휴직', isBizDept: false, projects: [] };
    }
    const currentPrjs = assignedProjectsMap[emp.id] || [];
    const isBiz =
      cleanDeptName(emp.department) === '사업본부' ||
      emp.department_code === 'DEPT_BIZ';

    if (currentPrjs.length > 0) {
      return {
        status: '투입중',
        label: '프로젝트 투입중',
        isBizDept: isBiz,
        projects: currentPrjs,
      };
    }

    if (isBiz) {
      return {
        status: '투입대기',
        label: '사업본부 가용 (대기)',
        isBizDept: true,
        projects: [],
      };
    }

    return {
      status: '부서고유업무',
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
        cleanDeptName(emp.department) === '사업본부' ||
        emp.department_code === 'DEPT_BIZ';

      if (isBiz) bizTotal++;

      if (avail.status === '퇴사') {
        retired++;
      } else if (avail.status === '휴직') {
        suspended++;
      } else if (avail.status === '투입중') {
        activeAssigned++;
      } else if (avail.status === '투입대기') {
        bizAvailable++;
      } else {
        otherDeptCount++;
      }
    });

    const assignmentRate = total > 0 ? Math.round((activeAssigned / total) * 100) : 0;
    const bizAvailabilityRate = bizTotal > 0 ? Math.round((bizAvailable / bizTotal) * 100) : 0;

    return {
      total,
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
    const list = employees.filter((emp) => {
      const avail = getEmployeeAvailability(emp);

      const matchDept =
        deptFilter === 'ALL' || emp.department_code === deptFilter;

      const matchAvailability =
        availabilityFilter === '전체' || avail.status === availabilityFilter;

      const matchPosition =
        positionFilter === 'ALL' || emp.position_code === positionFilter;

      const empNo = getEmpNoFromHireDate(emp.hire_date, emp.emp_no);
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        emp.name.toLowerCase().includes(q) ||
        empNo.toLowerCase().includes(q) ||
        emp.position.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q) ||
        (emp.phone || '').toLowerCase().includes(q) ||
        avail.projects.some((p) => p.toLowerCase().includes(q));

      return matchDept && matchAvailability && matchPosition && matchSearch;
    });

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
  }, [
    employees,
    deptFilter,
    availabilityFilter,
    positionFilter,
    searchQuery,
    sortBy,
    sortOrder,
    assignedProjectsMap,
  ]);

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / (pageSize || 1)));
  const paginatedEmployees = useMemo(() => {
    if (pageSize === 0) return filteredEmployees;
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

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
    });
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setInitialPassword('');
    setEditingEmp(emp);
    const idPart = emp.email?.includes('@') ? emp.email.split('@')[0] : (emp.email || '');
    setEmailId(idPart);
    const matchedDept = DEPARTMENT_CODES.find(
      (d) => d.code === emp.department_code || d.label === emp.department
    );
    const matchedPos = POSITION_CODES.find(
      (p) => p.code === emp.position_code || p.label === emp.position
    );

    setFormData({
      ...emp,
      department_code: matchedDept?.code || emp.department_code || 'DEPT_RND',
      department: matchedDept?.label || emp.department || '기술연구소',
      position_code: matchedPos?.code || emp.position_code || 'POS_STAFF',
      position: matchedPos?.label || emp.position || '담당',
      role: normalizeUserRole(emp.role, emp.position),
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

      const deptObj = DEPARTMENT_CODES.find((d) => d.code === formData.department_code);
      const posObj = POSITION_CODES.find((p) => p.code === formData.position_code);
      const statusObj = EMP_STATUS_CODES.find(
        (s) => s.code === formData.status_code || s.label === formData.status
      );

      const roleCode = getRoleCode(formData.role_code || formData.role);
      const roleInfo = USER_ROLE_CODES.find((r) => r.code === roleCode);

      const payload = {
        ...formData,
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

  const handleDelete = async (id: number) => {
    if (!isExecutiveOrAbove(currentUser)) {
      await showAlert('직원 삭제는 시스템 관리자 또는 임원 권한(이사급 이상)만 가능합니다.', {
        type: 'warning',
      });
      return;
    }
    const confirmed = await showConfirm('정말 해당 직원을 삭제하시겠습니까?', {
      isDanger: true,
      confirmText: '삭제',
    });
    if (!confirmed) return;

    await apiFetch('/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'employees', action: 'delete', id }),
    });
    await onRefresh();
    await showAlert('직원 정보가 삭제되었습니다.', { type: 'success' });
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 회사의 가용인원 파악 대시보드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 전체 임직원 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">전체 임직원</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total}명</div>
            <div className="text-[11px] text-slate-400 mt-0.5">상시 정규인력</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* 프로젝트 투입중 */}
        <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-indigo-700">프로젝트 투입중</div>
            <div className="text-2xl font-extrabold text-indigo-600 mt-1">{stats.activeAssigned}명</div>
            <div className="text-[11px] text-indigo-600/80 mt-0.5 font-medium">
              인력 투입률 {stats.assignmentRate}%
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* 사업본부 가용인력 (신규 프로젝트 즉시 투입 가능) */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-emerald-800">사업본부 가용인력</div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.bizAvailable}명</div>
            <div className="text-[11px] text-emerald-700 mt-0.5 font-bold">
              사업본부 총 {stats.bizTotal}명 중 미투입 (가용률 {stats.bizAvailabilityRate}%)
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* 휴직 (비가용) */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-amber-800">휴직 (비가용)</div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">{stats.suspended}명</div>
            <div className="text-[11px] text-amber-600 mt-0.5">현재 투입 불가</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. 가용상태 탭 & 검색 / 필터 툴바 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* 가용인원 상태 탭 필터 */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold mr-2">
            {[
              { key: '전체', label: `전체 (${stats.total})` },
              { key: '투입대기', label: `사업본부 가용 (${stats.bizAvailable})` },
              { key: '투입중', label: `투입중 (${stats.activeAssigned})` },
              { key: '부서고유업무', label: `타부서 (${stats.otherDeptCount})` },
              { key: '휴직', label: `휴직 (${stats.suspended})` },
              { key: '퇴사', label: `퇴사 (${stats.retired})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setAvailabilityFilter(tab.key as any);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-md transition ${
                  availabilityFilter === tab.key
                    ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 검색 필드 (사번=입사일, 성명, 직급, 부서, 이메일, 연락처) */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="성명, 사번(입사일), 직급, 부서 검색..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-60 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* 부서 필터 (코드 기반 관리) */}
          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="ALL">전체 부서</option>
            {DEPARTMENT_CODES.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>

          {/* 직급 필터 (코드 기반 관리) */}
          <select
            value={positionFilter}
            onChange={(e) => {
              setPositionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="ALL">전체 직급</option>
            {POSITION_CODES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>

          {/* 조직도 토글 버튼 */}
          <button
            onClick={() => setShowOrgTree(!showOrgTree)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              showOrgTree
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>조직도 {showOrgTree ? '접기' : '펼치기'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* 페이지당 표시 개수 */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>표시:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white font-semibold"
            >
              <option value={20}>20명씩</option>
              <option value={25}>25명씩</option>
              <option value={50}>50명씩</option>
              <option value={100}>100명씩</option>
              <option value={0}>전체 보기</option>
            </select>
          </div>

          {canEdit && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" /> 신규 직원 등록
            </button>
          )}
        </div>
      </div>

      {/* 3. 본문 영역: 조직도(선택적 토글) + 컴팩트 목록형 테이블 */}
      <div className="flex gap-4 items-start">
        {/* 사내 조직도 사이드 패널 (첨부 이미지 스타일) */}
        {showOrgTree && (
          <div className="w-80 shrink-0 bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2 select-none">
            {/* 상단 검색 입력창 (이름/아이디/부서/직위/직책/전화) */}
            <div className="relative">
              <div className="flex items-center border border-slate-300 rounded px-2.5 py-1.5 bg-white shadow-2xs focus-within:border-indigo-500">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="이름/아이디/부서/직위/직책/전화"
                  className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent outline-hidden pr-2"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDeptFilter('전체');
                      setCurrentPage(1);
                    }}
                    className="text-slate-400 hover:text-slate-700 p-0.5"
                    title="검색어 초기화"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>
            </div>

            {/* 트리 뷰 본체 (계층 트리 가이드라인 & 사각 [-]/[+] 토글 버튼) */}
            <div className="max-h-[750px] overflow-y-auto pr-1 text-[12px] font-sans text-slate-700 space-y-1">
              {DEPARTMENT_CODES.map((dept) => {
                const isDeptSelected = deptFilter === dept.code && !searchQuery;
                const deptEmps = employees.filter(
                  (e) => e.department_code === dept.code
                );
                const isExpanded = !!expandedDepts[dept.code];
                // 프로젝트는 오직 '사업본부' 밑에만 생길 수 있음
                const isBizDept = dept.code === 'DEPT_BIZ';
                const deptProjects = isBizDept
                  ? projects
                      .filter(isActiveProject)
                      .sort((a, b) => {
                        const aMine = isUserProject(a) ? 1 : 0;
                        const bMine = isUserProject(b) ? 1 : 0;
                        if (bMine !== aMine) return bMine - aMine;
                        return a.name.localeCompare(b.name);
                      })
                  : [];

                // 부서 소속 전체 직원 (투입자 제외 없이 전원 포함)
                const directDeptEmps = deptEmps;

                // 사업본부 정렬은 직급, 입사일 순으로 정렬
                const sortedDirectDeptEmps = [...directDeptEmps].sort(
                  compareEmployeesByPositionAndHireDate
                );

                return (
                  <div key={dept.code} className="relative">
                    {/* 부서 헤더 노드 */}
                    <div
                      className={`flex items-center gap-1.5 py-1 px-1 rounded cursor-pointer transition ${
                        isDeptSelected
                          ? 'bg-indigo-50 text-indigo-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-900 font-bold'
                      }`}
                      onClick={() => {
                        setDeptFilter(dept.code);
                        setSearchQuery('');
                        setCurrentPage(1);
                      }}
                    >
                      {/* 사각형 [-] / [+] 토글 버튼 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDepts((prev) => ({
                            ...prev,
                            [dept.code]: !prev[dept.code],
                          }));
                        }}
                        className="w-3.5 h-3.5 shrink-0 bg-[#64748b] text-white flex items-center justify-center text-[10px] font-mono font-bold leading-none rounded-xs hover:bg-[#475569] shadow-2xs"
                      >
                        {isExpanded ? '−' : '+'}
                      </button>
                      <span className="text-[12px]">{dept.label}</span>
                      <span className="text-[10px] text-slate-400 font-normal font-mono ml-auto">
                        ({deptEmps.length})
                      </span>
                    </div>

                    {/* 부서 하위 트리 가지 */}
                    {isExpanded && (
                      <div className="ml-2 pl-3 border-l border-slate-300 space-y-0.5 py-0.5">
                        {/* 1) 부서 소속 직원 목록 (이름과 직함만 표시 + 클릭 시 우측 조회) */}
                        {sortedDirectDeptEmps.map((emp) => {
                          const isEmpActive = searchQuery === emp.name;
                          return (
                            <div
                              key={emp.id}
                              onClick={() => {
                                setSearchQuery(emp.name);
                                setDeptFilter(dept.code);
                                setCurrentPage(1);
                              }}
                              onDoubleClick={() => canEdit && openEditModal(emp)}
                              className={`relative flex items-center justify-between py-1 px-1.5 rounded cursor-pointer transition border border-transparent before:absolute before:-left-3 before:top-3 before:w-3 before:border-t before:border-slate-300 ${
                                isEmpActive
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
                                  : 'hover:bg-slate-50 text-slate-700'
                              }`}
                              title={canEdit ? '클릭 시 우측 조회 / 더블클릭 시 정보 수정' : '클릭 시 우측 조회'}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0 fill-slate-200" />
                                <span className="text-[12px] font-medium text-slate-800 truncate">
                                  {emp.name} <span className="text-slate-500 font-normal">{emp.position}</span>
                                </span>
                              </div>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(emp);
                                  }}
                                  className="text-slate-400 hover:text-indigo-600 p-0.5 shrink-0"
                                  title="직원 정보 수정"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* 2) 부서 관할 프로젝트 목록 (트리 하위) */}
                        {deptProjects.map((prj) => {
                          const isMine = isUserProject(prj);
                          const isPrjExpanded = !!expandedProjects[prj.id];
                          const isPrjSelected = searchQuery === prj.name;
                          const memberNames = getProjectMemberNames(prj);

                          // PM 인력 정보 추출
                          const pmName = prj.pm_name || memberNames[0] || '';
                          const pmEmp = employees.find((e) => e.id === prj.pm_id);
                          const pmPosition = pmEmp ? pmEmp.position : '';

                          return (
                            <div key={prj.id} className="relative mt-1">
                              {/* 프로젝트 노드 헤더 */}
                              <div
                                onClick={() => {
                                  setSearchQuery(prj.name);
                                  setDeptFilter('전체');
                                  setCurrentPage(1);
                                }}
                                className={`relative flex items-center gap-1.5 py-0.5 px-1 rounded cursor-pointer transition before:absolute before:-left-3 before:top-2.5 before:w-3 before:border-t before:border-slate-300 ${
                                  isPrjSelected
                                    ? 'bg-indigo-600 text-white font-bold'
                                    : isMine
                                    ? 'bg-indigo-50/70 text-indigo-950 font-semibold hover:bg-indigo-100/60'
                                    : 'hover:bg-slate-50 text-slate-800 font-medium'
                                }`}
                              >
                                {/* 사각형 [-] / [+] 토글 버튼 */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedProjects((prev) => ({
                                      ...prev,
                                      [prj.id]: !prev[prj.id],
                                    }));
                                  }}
                                  className={`w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[10px] font-mono font-bold leading-none rounded-xs shadow-2xs ${
                                    isPrjSelected
                                      ? 'bg-white text-indigo-700'
                                      : 'bg-[#64748b] text-white hover:bg-[#475569]'
                                  }`}
                                >
                                  {isPrjExpanded ? '−' : '+'}
                                </button>
                                <span className="text-[12px] truncate flex-1" title={prj.name}>
                                  {prj.name}
                                </span>
                                {isMine && (
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-bold shrink-0 ${
                                      isPrjSelected ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                                    }`}
                                  >
                                    내Pjt
                                  </span>
                                )}
                              </div>

                              {/* 프로젝트 하위 투입 인원 트리 (첨부 이미지와 일치: PM [M] + 팀원들) */}
                              {isPrjExpanded && (
                                <div className="ml-2 pl-3 border-l border-slate-300 space-y-0.5 py-0.5">
                                  {/* PM (책임자) - [M] 배지 및 연락처/이메일 */}
                                  {pmName && (
                                    <div
                                      onClick={() => {
                                        setSearchQuery(pmName);
                                        setCurrentPage(1);
                                      }}
                                      onDoubleClick={() => {
                                        if (pmEmp && canEdit) openEditModal(pmEmp);
                                      }}
                                      className={`relative flex flex-col py-1 px-1.5 rounded cursor-pointer transition border border-transparent before:absolute before:-left-3 before:top-3 before:w-3 before:border-t before:border-slate-300 ${
                                        searchQuery === pmName
                                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
                                          : 'hover:bg-slate-50 text-slate-800'
                                      }`}
                                      title={canEdit ? '더블클릭 시 정보 수정' : '클릭 시 검색'}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1.5 truncate">
                                          {/* [M] 배지가 붙은 유저 아이콘 */}
                                          <div className="relative inline-flex items-center shrink-0">
                                            <User className="w-3.5 h-3.5 text-slate-500 fill-slate-300" />
                                            <span className="absolute -top-1 -right-1 text-[7px] font-black bg-[#1e3a8a] text-white rounded-[1px] px-0.5 leading-tight">
                                              M
                                            </span>
                                          </div>
                                          <span className="text-[12px] font-bold truncate">
                                            {pmName} {pmPosition}
                                          </span>
                                        </div>
                                        {pmEmp && canEdit && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openEditModal(pmEmp);
                                            }}
                                            className="text-slate-400 hover:text-indigo-600 p-0.5 shrink-0"
                                            title="정보 수정"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                      {pmEmp && (
                                        <div className="mt-0.5 pl-5 flex flex-col gap-0.5 text-[10.5px] text-slate-500 font-mono">
                                          {pmEmp.phone && (
                                            <span className="flex items-center gap-1 truncate text-slate-600" title={pmEmp.phone}>
                                              <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                              {pmEmp.phone}
                                            </span>
                                          )}
                                          {pmEmp.email && (
                                            <a
                                              href={`mailto:${pmEmp.email}`}
                                              onClick={(e) => e.stopPropagation()}
                                              className="flex items-center gap-1 truncate text-slate-500 hover:text-indigo-600 hover:underline"
                                              title={pmEmp.email}
                                            >
                                              <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                              <span className="truncate">{pmEmp.email}</span>
                                            </a>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* 투입 팀원들 (직급 및 입사일 순 정렬 + 연락처/이메일 표시) */}
                                  {getProjectMemberIds(prj)
                                    .filter((id) => id !== prj.pm_id)
                                    .map((memberId) => employees.find((e) => e.id === memberId))
                                    .filter((e): e is Employee => Boolean(e))
                                    .sort(compareEmployeesByPositionAndHireDate)
                                    .map((memberEmp) => {
                                      const memberName = memberEmp.name;
                                      const memberPos = memberEmp.position;
                                      const isMemberActive = searchQuery === memberName;

                                      return (
                                        <div
                                          key={memberEmp.id}
                                          onClick={() => {
                                            setSearchQuery(memberName);
                                            setCurrentPage(1);
                                          }}
                                          onDoubleClick={() => {
                                            if (canEdit) openEditModal(memberEmp);
                                          }}
                                          className={`relative flex items-center justify-between py-1 px-1.5 rounded cursor-pointer transition border border-transparent before:absolute before:-left-3 before:top-3 before:w-3 before:border-t before:border-slate-300 ${
                                            isMemberActive
                                              ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
                                              : 'hover:bg-slate-50 text-slate-700'
                                          }`}
                                          title={canEdit ? '클릭 시 우측 조회 / 더블클릭 시 정보 수정' : '클릭 시 우측 조회'}
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0 fill-slate-200" />
                                            <span className="text-[12px] font-medium text-slate-800 truncate">
                                              {memberName} <span className="text-slate-500 font-normal">{memberPos}</span>
                                            </span>
                                          </div>
                                          {canEdit && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openEditModal(memberEmp);
                                              }}
                                              className="text-slate-400 hover:text-indigo-600 p-0.5 shrink-0"
                                              title="정보 수정"
                                            >
                                              <Edit3 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}

                                  {memberNames.length === 0 && !prj.pm_name && (
                                    <div className="text-[11px] text-slate-400 italic py-0.5 pl-1">
                                      투입 인원 정보 없음
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 메인 목록 테이블 (담당업무/기술스택 제외, 사번=입사일, 가용인원 명확 표시) */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>
                조회 인원: <strong className="text-slate-900">{filteredEmployees.length}</strong>명
              </span>
              {availabilityFilter !== '전체' && (
                <span className="text-indigo-600 font-semibold">[{availabilityFilter}]</span>
              )}
              {deptFilter !== 'ALL' && (
                <span className="text-slate-700 font-semibold">
                  [{DEPARTMENT_CODES.find((d) => d.code === deptFilter)?.label || deptFilter}]
                </span>
              )}
              {positionFilter !== 'ALL' && (
                <span className="text-slate-700 font-semibold">
                  [{POSITION_CODES.find((p) => p.code === positionFilter)?.label || positionFilter}]
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              {pageSize > 0 ? `${currentPage} / ${totalPages} 페이지` : '전체 목록'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider select-none">
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-4 py-3 cursor-pointer hover:bg-slate-200/60 transition w-32"
                  >
                    <div className="flex items-center gap-1">
                      <span>성명</span>
                      {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('position')}
                    className="px-3 py-3 cursor-pointer hover:bg-slate-200/60 transition w-32"
                  >
                    <div className="flex items-center gap-1">
                      <span>직급 / 권한</span>
                      {sortBy === 'position' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  <th className="px-4 py-3 w-32">소속 부서</th>
                  <th className="px-4 py-3 min-w-[200px]">프로젝트명</th>
                  <th className="px-4 py-3 min-w-[220px]">연락처 / 이메일</th>
                  <th
                    onClick={() => handleSort('hire_date')}
                    className="px-3 py-3 cursor-pointer hover:bg-slate-200/60 transition w-28"
                  >
                    <div className="flex items-center gap-1">
                      <span>입사일</span>
                      {sortBy === 'hire_date' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </div>
                  </th>
                  {canEdit && <th className="px-3 py-3 text-center w-20">관리</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                      : 'bg-slate-50 text-slate-500 border-slate-200';

                  return (
                    <tr
                      key={emp.id}
                      onClick={(e) => {
                        // 액션 버튼이나 링크 클릭 시에는 행 클릭 이벤트 방지
                        if ((e.target as HTMLElement).closest('button, a')) return;
                        if (canEdit) openEditModal(emp);
                      }}
                      className={`hover:bg-indigo-50/40 transition group ${
                        canEdit ? 'cursor-pointer' : ''
                      }`}
                      title={canEdit ? '클릭하여 직원 정보 수정' : ''}
                    >
                      {/* 성명 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                              emp.status === '퇴사'
                                ? 'bg-slate-200 text-slate-500'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {emp.name.slice(0, 1)}
                          </div>
                          <span
                            className={`font-bold ${
                              emp.status === '퇴사'
                                ? 'text-slate-400 line-through'
                                : 'text-slate-900'
                            }`}
                          >
                            {emp.name}
                          </span>
                          {emp.status === '퇴사' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                              퇴사
                            </span>
                          )}
                          {emp.status === '휴직' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                              휴직
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 직급 / 시스템 권한 등급 (권한은 이름만 표시) */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {emp.position}
                          </span>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${roleBadgeClass}`}
                          >
                            {empRoleLabel}
                          </span>
                        </div>
                      </td>

                      {/* 소속 부서 */}
                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                        {cleanDeptName(emp.department)}
                      </td>

                      {/* 프로젝트명: 수행 중인 프로젝트만 보여주고 투입된 게 없으면 공란 */}
                      <td className="px-4 py-3">
                        {avail.projects.length > 0 ? (
                          <span className="font-semibold text-slate-800">
                            {avail.projects.join(', ')}
                          </span>
                        ) : null}
                      </td>

                      {/* 연락처 / 이메일 통합 표시 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-slate-800 text-xs flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {emp.phone || '-'}
                          </span>
                          <a
                            href={`mailto:${emp.email}`}
                            className="font-mono text-slate-500 hover:text-indigo-600 hover:underline text-[11px] flex items-center gap-1.5"
                          >
                            <Mail className="w-3 h-3 text-slate-400" />
                            {emp.email || '-'}
                          </a>
                        </div>
                      </td>

                      {/* 입사일 */}
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {emp.hire_date || '-'}
                      </td>

                      {/* 관리 액션 */}
                      {canEdit && (
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(emp)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                              title="직원 정보 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                              title="직원 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="text-center py-16 text-slate-400">
                      검색 조건에 일치하는 직원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 컨트롤 */}
          {pageSize > 0 && totalPages > 1 && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                총 {filteredEmployees.length}명 중 {(currentPage - 1) * pageSize + 1} -{' '}
                {Math.min(currentPage * pageSize, filteredEmployees.length)}명 표시
              </span>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                      currentPage === pg
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-white border border-transparent'
                    }`}
                  >
                    {pg}
                  </button>
                ))}

                <button
                  disabled={currentPage === totalPages}
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
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
                    {DEPARTMENT_CODES.map((d) => (
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
                      const posObj = POSITION_CODES.find((p) => p.code === nextPosCode);
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
                    {POSITION_CODES.map((p) => (
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
