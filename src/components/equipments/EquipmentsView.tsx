'use client';

import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';

import React, { useState, useMemo } from 'react';
import {
  Equipment,
  Employee,
  AuthUser,
  CommonCode,
  isExecutiveOrAbove,
  formatCurrencyManwon,
  EQUIPMENT_CATEGORIES,
} from '@/types/groupware';
import {
  Laptop,
  Plus,
  Edit3,
  Trash2,
  Server,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Building2,
  ShieldCheck,
  Check,
  Monitor,
} from 'lucide-react';
import {
  Button,
  PageHeaderBar,
  SearchInput,
  Modal,
  Select,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  TableEmpty,
} from '@/components/common';

interface Props {
  equipments: Equipment[];
  employees?: Employee[];
  commonCodes?: CommonCode[];
  currentUser: AuthUser;
  onRefresh: () => Promise<void>;
}

export default function EquipmentsView({
  equipments,
  employees = [],
  commonCodes = [],
  currentUser,
  onRefresh,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [categoryFilter, setCategoryFilter] = useState('전체');

  // DB(common_codes)에서 장비 구분 목록 동적 조회 (DB 우선)
  const categories = useMemo(() => {
    const dbCats = commonCodes
      .filter((c) => c.group_code === 'EQUIPMENT_CATEGORY' && c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => c.code_name);
    return dbCats.length > 0 ? dbCats : (Array.from(EQUIPMENT_CATEGORIES) as string[]);
  }, [commonCodes]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<Partial<Equipment>>({});

  const { showAlert, showConfirm } = useModal();
  const canEdit = isExecutiveOrAbove(currentUser);

  // 직원 맵 생성 (id 기반 & emp_no 기반 & name 기반 빠른 조회)
  const empIdMap = useMemo(() => {
    const map = new Map<number, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const empNoMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.emp_no, e));
    return map;
  }, [employees]);

  const empNameMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.name, e));
    return map;
  }, [employees]);

  // 필터링된 장비 목록
  const filteredEquipments = useMemo(() => {
    return equipments.filter((eq) => {
      const matchCat = categoryFilter === '전체' || eq.category === categoryFilter;
      const matchStatus = statusFilter === '전체' || eq.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        eq.model_name.toLowerCase().includes(q) ||
        eq.asset_no.toLowerCase().includes(q) ||
        eq.assigned_to.toLowerCase().includes(q) ||
        (eq.emp_no && eq.emp_no.toLowerCase().includes(q)) ||
        eq.serial_no.toLowerCase().includes(q);
      return matchCat && matchStatus && matchSearch;
    });
  }, [equipments, categoryFilter, statusFilter, searchQuery]);


  const openCreateModal = () => {
    setEditingEq(null);
    setFormData({
      asset_no: `ST-EQ-${String(equipments.length + 1).padStart(3, '0')}`,
      category: '노트북',
      model_name: 'LG Gram Pro 16 (Ultra 7, 32GB, 512GB)',
      serial_no: `SN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      status: '사용중',
      emp_id: currentUser.id,
      emp_no: currentUser.emp_no,
      assigned_to: currentUser.name,
      department: currentUser.department,
      purchase_date: new Date().toISOString().split('T')[0],
      price: 240,
      notes: '사내 업무용 표준 지급 자산',
    });
    setModalOpen(true);
  };

  const openEditModal = (eq: Equipment) => {
    setEditingEq(eq);
    // 현재 배정된 직원이 있으면 직원 정보 보완
    let matchedEmp: Employee | undefined = undefined;
    if (eq.emp_id) matchedEmp = empIdMap.get(eq.emp_id);
    if (!matchedEmp && eq.emp_no) matchedEmp = empNoMap.get(eq.emp_no);
    if (!matchedEmp && eq.assigned_to) matchedEmp = empNameMap.get(eq.assigned_to);

    setFormData({
      ...eq,
      emp_id: matchedEmp ? matchedEmp.id : eq.emp_id,
      emp_no: matchedEmp ? matchedEmp.emp_no : eq.emp_no,
      assigned_to: matchedEmp ? matchedEmp.name : eq.assigned_to,
      department: matchedEmp ? matchedEmp.department : eq.department,
    });
    setModalOpen(true);
  };

  // 모달에서 직원 선택 시 직원 PK/사번/부서 자동 동기화
  const handleSelectEmployee = (empIdStr: string) => {
    if (!empIdStr || empIdStr === 'UNASSIGNED') {
      setFormData((prev) => ({
        ...prev,
        emp_id: undefined,
        emp_no: '',
        assigned_to: '미배정',
        department_code: 'DEPT_MGMT',
        department: '경영지원팀',
        status: '유휴',
      }));
      return;
    }
    const empId = Number(empIdStr);
    const emp = empIdMap.get(empId);
    if (emp) {
      setFormData((prev) => ({
        ...prev,
        emp_id: emp.id,
        emp_no: emp.emp_no,
        assigned_to: emp.name,
        department_code: emp.department_code || 'DEPT_MGMT',
        department: emp.department,
        status: '사용중',
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'equipments',
        action: editingEq ? 'update' : 'create',
        id: editingEq?.id,
        data: formData,
      }),
    });
    setModalOpen(false);
    await onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!canEdit) {
      await showAlert('자산 관리는 시스템 관리자 또는 임원 권한만 가능합니다.', {
        type: 'warning',
      });
      return;
    }
    const confirmed = await showConfirm('정말 해당 자산을 삭제하시겠습니까?', {
      isDanger: true,
      confirmText: '삭제',
    });
    if (!confirmed) return;

    await apiFetch('/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'equipments', action: 'delete', id }),
    });
    await onRefresh();
    await showAlert('자산이 성공적으로 삭제되었습니다.', { type: 'success' });
  };

  return (
    <div className="space-y-4">
      {/* 1. 공통 검색 및 필터 툴바 */}
      <PageHeaderBar
        left={
          <>
            <SearchInput
              placeholder="자산번호, 모델명, 지급직원명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              className="w-72"
            />

            <Select
              size="sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="전체">전체 장비 구분</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>

            <Select
              size="sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="전체">전체 상태</option>
              <option value="사용중">사용중</option>
              <option value="유휴">유휴</option>
              <option value="수리중">수리중</option>
              <option value="폐기">폐기</option>
            </Select>
          </>
        }
        right={
          canEdit ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={openCreateModal}
            >
              신규 자산 등록
            </Button>
          ) : undefined
        }
      />

      {/* 3. 자산 목록 테이블 */}
      <TableContainer>
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>자산번호</TableHeaderCell>
              <TableHeaderCell>구분</TableHeaderCell>
              <TableHeaderCell>모델명 및 규격</TableHeaderCell>
              <TableHeaderCell>일련번호 (S/N)</TableHeaderCell>
              <TableHeaderCell>지급 담당자</TableHeaderCell>
              <TableHeaderCell>소속 부서</TableHeaderCell>
              <TableHeaderCell align="right">취득가액</TableHeaderCell>
              <TableHeaderCell align="center">상태</TableHeaderCell>
              {canEdit && <TableHeaderCell align="center">관리</TableHeaderCell>}
            </tr>
          </TableHead>
          <TableBody>
            {filteredEquipments.length === 0 && (
              <TableEmpty colSpan={canEdit ? 9 : 8} message="등록된 자산이 없습니다." />
            )}
            {filteredEquipments.map((eq) => {
              // 직원 테이블에서 실제 일치하는 직원 찾기
              let matchedEmp: Employee | undefined = undefined;
              if (eq.emp_id) matchedEmp = empIdMap.get(eq.emp_id);
              if (!matchedEmp && eq.emp_no) matchedEmp = empNoMap.get(eq.emp_no);
              if (!matchedEmp && eq.assigned_to) matchedEmp = empNameMap.get(eq.assigned_to);

              const isUnassigned = !eq.assigned_to || eq.assigned_to === '미배정';

              return (
                <TableRow key={eq.id}>
                  <TableCell className="font-mono font-bold text-indigo-600">
                    {eq.asset_no}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-bold text-xs border ${
                        eq.category === '모니터'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : eq.category === '데스크탑'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {eq.category}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900 max-w-xs truncate">
                    {eq.model_name}
                  </TableCell>
                  <TableCell className="text-slate-500 font-mono text-xs">
                    {eq.serial_no}
                  </TableCell>

                  {/* 지급 담당자 */}
                  <TableCell>
                    {isUnassigned ? (
                      <span className="text-slate-400 font-medium">미배정 (사내 예비)</span>
                    ) : matchedEmp ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{matchedEmp.name}</span>
                        <span className="text-slate-600 font-medium">
                          {matchedEmp.position}
                        </span>
                      </div>
                    ) : (
                      <span className="font-medium text-slate-800">{eq.assigned_to}</span>
                    )}
                  </TableCell>

                  <TableCell className="text-slate-600">
                    {matchedEmp ? matchedEmp.department : eq.department}
                  </TableCell>
                  <TableCell align="right" className="font-bold text-slate-900 font-mono">
                    {formatCurrencyManwon(eq.price)}
                  </TableCell>
                  <TableCell align="center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        eq.status === '사용중'
                          ? 'bg-emerald-100 text-emerald-700'
                          : eq.status === '유휴'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {eq.status}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell align="center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(eq)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                          title="자산 정보 수정"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(eq.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="자산 삭제"
                          aria-label="자산 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 4. 등록 / 수정 모달 (공통 Modal 적용) */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEq ? '자산 정보 수정' : '신규 자산 등록'}
        description="모니터, 데스크탑, 노트북 자산의 시리얼 번호 및 지급 직원을 관리합니다."
        icon={<Laptop className="w-5 h-5 text-indigo-600" />}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setModalOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form="equipment-form"
            >
              {editingEq ? '수정 완료' : '등록 완료'}
            </Button>
          </>
        }
      >
        <form id="equipment-form" onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">자산 관리 번호</label>
              <input
                type="text"
                required
                value={formData.asset_no || ''}
                onChange={(e) => setFormData({ ...formData, asset_no: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">장비 구분</label>
              <select
                value={formData.category || (categories[0] || '모니터')}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">모델명 / 상세 규격</label>
            <input
              type="text"
              required
              value={formData.model_name || ''}
              onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
              placeholder="예: MacBook Pro 16 (M4 Max, 64GB, 1TB)"
              className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">시리얼 번호 (S/N)</label>
              <input
                type="text"
                value={formData.serial_no || ''}
                onChange={(e) => setFormData({ ...formData, serial_no: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">취득가액 (만원)</label>
              <input
                type="number"
                value={formData.price || 0}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-indigo-600"
              />
            </div>
          </div>

          {/* 직원 테이블 PK 연동 콤보박스 */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-indigo-900 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                지급 대상 직원 선택
              </label>
              <span className="text-xs text-indigo-600 font-semibold">
                * 이름 / 직급 / 소속부서 자동 바인딩
              </span>
            </div>

            <select
              value={formData.emp_id ? String(formData.emp_id) : 'UNASSIGNED'}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              className="w-full p-2.5 border border-indigo-300 rounded-xl bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="UNASSIGNED">미배정 (사내 공용 / 유휴 자산)</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.position} ({emp.department})
                </option>
              ))}
            </select>

            <div className="text-xs pt-1 text-slate-600">
              지급 대상 부서: <strong className="text-slate-800">{formData.department || '경영지원팀'}</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">취득일자</label>
              <input
                type="date"
                value={formData.purchase_date || ''}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">사용 상태</label>
              <select
                value={formData.status || '사용중'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
              >
                <option value="사용중">사용중 (지급완료)</option>
                <option value="유휴">유휴 (보관/예비)</option>
                <option value="수리중">수리중</option>
                <option value="폐기">폐기</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">비고 / 용도 메모</label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="예: 공간정보 GIS 아키텍처 및 3D 렌더링 개발용 지급 장비"
              className="w-full p-2.5 border border-slate-300 rounded-xl leading-relaxed resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
