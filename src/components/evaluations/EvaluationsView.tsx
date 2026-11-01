'use client';

import { apiFetch } from '@/lib/api';

import React, { useState, useMemo } from 'react';
import { Evaluation, AuthUser, isExecutiveOrAbove, Employee, DEPARTMENT_CODES, POSITION_CODES } from '@/types/groupware';
import { Award, Search, Plus, Edit3, Trash2, CheckCircle2, User } from 'lucide-react';

interface Props {
  evaluations: Evaluation[];
  currentUser: AuthUser;
  employees?: Employee[];
  onRefresh: () => Promise<void>;
}

export default function EvaluationsView({ evaluations, currentUser, employees = [], onRefresh }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('전체');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEv, setEditingEv] = useState<Evaluation | null>(null);
  const [formData, setFormData] = useState<Partial<Evaluation>>({});

  // 이사급 이상 임원 권한 및 시스템 관리자만 인사평가 작성/수정 가능
  const canEdit = isExecutiveOrAbove(currentUser.role, currentUser.position);

  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((ev) => {
      const matchGrade = gradeFilter === '전체' || ev.grade === gradeFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        ev.emp_name.toLowerCase().includes(q) ||
        ev.emp_no.toLowerCase().includes(q) ||
        ev.feedback.toLowerCase().includes(q);
      return matchGrade && matchSearch;
    });
  }, [evaluations, gradeFilter, searchQuery]);

  const openCreateModal = () => {
    setEditingEv(null);
    const firstEmp = employees.length > 0 ? employees[0] : null;
    setFormData({
      employee_id: firstEmp?.id,
      emp_no: firstEmp?.emp_no || '',
      emp_name: firstEmp?.name || '',
      department_code: firstEmp?.department_code || 'DEPT_BIZ',
      department: firstEmp?.department || '사업본부',
      position_code: firstEmp?.position_code || 'POS_DGM',
      position: firstEmp?.position || '차장',
      period: `${new Date().getFullYear()}년 ${new Date().getMonth() < 6 ? '상반기' : '하반기'}`,
      kpi_score: 0,
      competency_score: 0,
      peer_score: 0,
      total_score: 0,
      grade: 'D',
      reviewer: currentUser.name,
      status: '작성중',
      feedback: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (ev: Evaluation) => {
    setEditingEv(ev);
    setFormData(ev);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const kpi = Number(formData.kpi_score || 0);
    const comp = Number(formData.competency_score || 0);
    const peer = Number(formData.peer_score || 0);
    const total = Math.round((kpi * 0.5 + comp * 0.3 + peer * 0.2) * 10) / 10;
    const grade = total >= 93 ? 'S' : total >= 87 ? 'A' : total >= 78 ? 'B' : total >= 68 ? 'C' : 'D';

    const payload = {
      ...formData,
      total_score: total,
      grade,
    };

    await apiFetch('/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'evaluations',
        action: editingEv ? 'update' : 'create',
        id: editingEv?.id,
        data: payload,
      }),
    });
    setModalOpen(false);
    await onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!canEdit) {
      alert('인사평가 관리는 시스템 관리자 또는 임원 권한(이사급 이상)만 가능합니다.');
      return;
    }
    if (!confirm('정말 삭제하시겠습니까?')) return;

    await apiFetch('/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'evaluations', action: 'delete', id }),
    });
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="평가대상자, 사번, 피드백 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-64 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            {['전체', 'S', 'A', 'B', 'C', 'D'].map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  gradeFilter === g ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                {g} 등급
              </button>
            ))}
          </div>
        </div>

        {canEdit && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" /> 인사평가 작성
          </button>
        )}
      </div>

      {/* Evaluations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">평가대상자</th>
                <th className="px-5 py-3.5">부서 / 직급</th>
                <th className="px-5 py-3.5">평가 기간</th>
                <th className="px-5 py-3.5 text-center">KPI 점수</th>
                <th className="px-5 py-3.5 text-center">역량 점수</th>
                <th className="px-5 py-3.5 text-center">다면 점수</th>
                <th className="px-5 py-3.5 text-center">종합 점수</th>
                <th className="px-5 py-3.5 text-center">최종 등급</th>
                <th className="px-5 py-3.5">종합 피드백</th>
                {canEdit && <th className="px-5 py-3.5 text-center">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvaluations.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-slate-900">{ev.emp_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{ev.emp_no}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-800">{ev.department}</div>
                    <div className="text-[11px] text-slate-500">{ev.position}</div>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-600">{ev.period}</td>
                  <td className="px-5 py-3.5 text-center font-semibold text-slate-800">{ev.kpi_score}</td>
                  <td className="px-5 py-3.5 text-center font-semibold text-slate-800">{ev.competency_score}</td>
                  <td className="px-5 py-3.5 text-center font-semibold text-slate-800">{ev.peer_score}</td>
                  <td className="px-5 py-3.5 text-center font-extrabold text-indigo-600 text-sm">
                    {ev.total_score}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ev.grade === 'S'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : ev.grade === 'A'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {ev.grade}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">{ev.feedback}</td>
                  {canEdit && (
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(ev)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingEv ? '인사평가 수정' : '인사평가 작성'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    평가 대상 직원 선택 ({employees.length}명)
                  </label>
                  {employees.length > 0 ? (
                    <select
                      value={formData.emp_no || ''}
                      onChange={(e) => {
                        const selectedNo = e.target.value;
                        const target = employees.find((emp) => emp.emp_no === selectedNo);
                        if (target) {
                          setFormData({
                            ...formData,
                            employee_id: target.id,
                            emp_no: target.emp_no,
                            emp_name: target.name,
                            department: target.department,
                            department_code: target.department_code,
                            position: target.position,
                            position_code: target.position_code,
                          });
                        }
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg font-bold bg-white text-slate-800"
                    >
                      {employees.map((emp) => (
                        <option key={emp.emp_no} value={emp.emp_no}>
                          {emp.name} ({emp.position} / {emp.department}) - {emp.emp_no}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={formData.emp_name || ''}
                      onChange={(e) => setFormData({ ...formData, emp_name: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                    />
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">사번 / 직급</label>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-700 font-bold flex items-center justify-between">
                    <span>{formData.emp_no || '-'}</span>
                    <span className="text-xs font-sans text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {formData.department} · {formData.position}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">KPI 점수 (50%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.kpi_score || 0}
                    onChange={(e) => setFormData({ ...formData, kpi_score: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">역량 점수 (30%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.competency_score || 0}
                    onChange={(e) => setFormData({ ...formData, competency_score: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">다면 점수 (20%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.peer_score || 0}
                    onChange={(e) => setFormData({ ...formData, peer_score: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">종합 피드백</label>
                <textarea
                  rows={3}
                  value={formData.feedback || ''}
                  onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  placeholder="성과 및 개발 필요 역량 작성"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  {editingEv ? '수정 완료' : '평가 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

