'use client';

import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';

import React, { useState, useMemo } from 'react';
import { Equipment, Employee, AuthUser, isPmOrAbove, formatCurrencyManwon } from '@/types/groupware';
import {
  Laptop,
  Search,
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
} from 'lucide-react';

interface Props {
  equipments: Equipment[];
  employees?: Employee[];
  currentUser: AuthUser;
  onRefresh: () => Promise<void>;
}

export default function EquipmentsView({
  equipments,
  employees = [],
  currentUser,
  onRefresh,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [categoryFilter, setCategoryFilter] = useState('전체');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<Partial<Equipment>>({});

  const { showAlert, showConfirm } = useModal();
  const canEdit = isPmOrAbove(currentUser);

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

  // 자산 현황 요약 통계
  const stats = useMemo(() => {
    const totalCount = equipments.length;
    const totalValue = equipments.reduce((sum, eq) => sum + (eq.price || 0), 0);
    const inUseCount = equipments.filter((eq) => eq.status === '사용중').length;
    const idleCount = equipments.filter((eq) => eq.status === '유휴' || eq.assigned_to === '미배정').length;
    return { totalCount, totalValue, inUseCount, idleCount };
  }, [equipments]);

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
      await showAlert('자산 관리는 시스템 관리자, 임원 또는 PM 권한만 가능합니다.', {
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
      {/* 1. 상단 통계 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 mb-1">총 등록 자산</div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {stats.totalCount}대
          </div>
          <div className="text-[11px] text-slate-400 mt-1">IT 장비 및 워크스테이션</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 mb-1">총 자산 취득가액</div>
          <div className="text-2xl font-black text-indigo-600 font-mono">
            {formatCurrencyManwon(stats.totalValue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">회사 취득 장비 합산액</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs">
          <div className="text-xs font-bold text-emerald-800 mb-1">임직원 지급 사용중</div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {stats.inUseCount}대
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">직원 PK 1:1 매핑 실사용</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 mb-1">예비 / 유휴 자산</div>
          <div className="text-2xl font-black text-slate-700 font-mono">
            {stats.idleCount}대
          </div>
          <div className="text-[11px] text-slate-400 mt-1">미배정 예비 자산</div>
        </div>
      </div>

      {/* 2. 검색 및 필터 툴바 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="자산번호, 모델명, 지급직원명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 w-72 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium"
          >
            <option value="전체">전체 구분</option>
            <option value="노트북">노트북</option>
            <option value="워크스테이션">워크스테이션</option>
            <option value="서버장비">서버장비</option>
            <option value="네트워크">네트워크</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white font-medium"
          >
            <option value="전체">전체 상태</option>
            <option value="사용중">사용중</option>
            <option value="유휴">유휴</option>
            <option value="수리중">수리중</option>
            <option value="폐기">폐기</option>
          </select>
        </div>

        {canEdit && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" /> 신규 자산 등록
          </button>
        )}
      </div>

      {/* 3. 자산 목록 테이블 (직원 PK / 사번 정합성 검증 컬럼 포함) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">자산번호</th>
                <th className="px-5 py-3.5">구분</th>
                <th className="px-5 py-3.5">모델명 및 규격</th>
                <th className="px-5 py-3.5">일련번호 (S/N)</th>
                <th className="px-5 py-3.5">지급 담당자</th>
                <th className="px-5 py-3.5">소속 부서</th>
                <th className="px-5 py-3.5 text-right">취득가액</th>
                <th className="px-5 py-3.5 text-center">상태</th>
                {canEdit && <th className="px-5 py-3.5 text-center">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEquipments.map((eq) => {
                // 직원 테이블에서 실제 일치하는 직원 찾기
                let matchedEmp: Employee | undefined = undefined;
                if (eq.emp_id) matchedEmp = empIdMap.get(eq.emp_id);
                if (!matchedEmp && eq.emp_no) matchedEmp = empNoMap.get(eq.emp_no);
                if (!matchedEmp && eq.assigned_to) matchedEmp = empNameMap.get(eq.assigned_to);

                const isUnassigned = !eq.assigned_to || eq.assigned_to === '미배정';

                return (
                  <tr key={eq.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-600">
                      {eq.asset_no}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-700 text-[11px]">
                        {eq.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 max-w-xs truncate">
                      {eq.model_name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                      {eq.serial_no}
                    </td>

                    {/* 지급 담당자 (이름 직급만 표시, 사번 제외) */}
                    <td className="px-5 py-3.5">
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
                    </td>

                    <td className="px-5 py-3.5 text-slate-600">
                      {matchedEmp ? matchedEmp.department : eq.department}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900 font-mono">
                      {formatCurrencyManwon(eq.price)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          eq.status === '사용중'
                            ? 'bg-emerald-100 text-emerald-700'
                            : eq.status === '유휴'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {eq.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-center">
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
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. 등록 / 수정 모달 (실제 직원 테이블 PK/사번 선택 콤보박스) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">
                  {editingEq ? '자산 정보 수정' : '신규 자산 등록'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
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
                    value={formData.category || '노트북'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="노트북">노트북</option>
                    <option value="워크스테이션">워크스테이션</option>
                    <option value="서버장비">서버장비</option>
                    <option value="네트워크">네트워크</option>
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
                  <span className="text-[10px] text-indigo-600 font-semibold">
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

                <div className="text-[11px] pt-1 text-slate-600">
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

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm transition"
                >
                  {editingEq ? '수정 완료' : '등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
