'use client';

import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';

import React, { useState, useMemo } from 'react';
import { Evaluation, AuthUser, isExecutiveOrAbove, Employee } from '@/types/groupware';
import { Award, Plus, Edit3, Trash2 } from 'lucide-react';
import {
  Button, Modal, Card, Badge,
  TabGroup,
  PageHeaderBar,
  SearchInput,
} from '@/components/common';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  TableEmpty,
} from '@/components/common/Table';

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

  const { showAlert, showConfirm } = useModal();

  // 이사급 이상 임원 권한 및 시스템 관리자만 인사평가 작성/수정 가능
  const canEdit = isExecutiveOrAbove(currentUser);

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
      await showAlert('인사평가 관리는 시스템 관리자 또는 임원 권한(이사급 이상)만 가능합니다.', {
        type: 'warning',
      });
      return;
    }
    const confirmed = await showConfirm('정말 인사평가 데이터를 삭제하시겠습니까?', {
      isDanger: true,
      confirmText: '삭제',
    });
    if (!confirmed) return;

    await apiFetch('/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'evaluations', action: 'delete', id }),
    });
    await onRefresh();
    await showAlert('인사평가가 삭제되었습니다.', { type: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* 공통 검색 및 필터 툴바 */}
      <PageHeaderBar
        left={
          <>
            <SearchInput
              placeholder="평가대상자, 사번, 피드백 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              className="w-full sm:w-64"
            />

            <TabGroup
              items={['전체', 'S', 'A', 'B', 'C', 'D'].map((g) => ({
                key: g,
                label: g === '전체' ? '전체 등급' : `${g} 등급`,
              }))}
              activeKey={gradeFilter}
              onChange={(g) => setGradeFilter(g)}
              variant="segmented"
              size="sm"
              className="max-w-full flex-wrap"
            />
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
              인사평가 작성
            </Button>
          ) : undefined
        }
      />

      {/* Evaluations Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHead>
              <tr>
                <TableHeaderCell>평가대상자</TableHeaderCell>
                <TableHeaderCell>부서 / 직급</TableHeaderCell>
                <TableHeaderCell>평가 기간</TableHeaderCell>
                <TableHeaderCell align="center">KPI 점수</TableHeaderCell>
                <TableHeaderCell align="center">역량 점수</TableHeaderCell>
                <TableHeaderCell align="center">다면 점수</TableHeaderCell>
                <TableHeaderCell align="center">종합 점수</TableHeaderCell>
                <TableHeaderCell align="center">최종 등급</TableHeaderCell>
                <TableHeaderCell>종합 피드백</TableHeaderCell>
                {canEdit && <TableHeaderCell align="center">관리</TableHeaderCell>}
              </tr>
            </TableHead>
            <TableBody>
              {filteredEvaluations.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell>
                    <div className="font-bold text-slate-900">{ev.emp_name}</div>
                    <div className="text-xs text-slate-400 font-mono">{ev.emp_no}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-800">{ev.department}</div>
                    <div className="text-xs text-slate-500">{ev.position}</div>
                  </TableCell>
                  <TableCell className="font-medium text-slate-600">{ev.period}</TableCell>
                  <TableCell align="center" className="font-semibold text-slate-800">{ev.kpi_score}</TableCell>
                  <TableCell align="center" className="font-semibold text-slate-800">{ev.competency_score}</TableCell>
                  <TableCell align="center" className="font-semibold text-slate-800">{ev.peer_score}</TableCell>
                  <TableCell align="center" className="font-bold text-indigo-600">
                    {ev.total_score}
                  </TableCell>
                  <TableCell align="center">
                    <Badge variant={ev.grade === 'S' ? 'purple' : ev.grade === 'A' ? 'success' : 'info'}>{ev.grade}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 min-w-48 max-w-xs whitespace-pre-wrap break-words">{ev.feedback}</TableCell>
                  {canEdit && (
                    <TableCell align="center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm"
                          title="평가 수정"
                          aria-label="평가 수정"
                          onClick={() => openEditModal(ev)}
                          className="text-slate-400 hover:text-indigo-600"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm"
                          title="평가 삭제"
                          aria-label="평가 삭제"
                          onClick={() => handleDelete(ev.id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filteredEvaluations.length === 0 && (
                <TableEmpty colSpan={canEdit ? 10 : 9} message="해당 조건의 인사평가 내역이 없습니다." />
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editingEv ? '인사평가 수정' : '인사평가 작성'} description="기존 종합평가 점수와 피드백을 관리합니다."
        icon={<Award size={20} />} size="lg" closeOnBackdrop={false} closeOnEsc={false}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
          <Button type="submit" form="legacy-evaluation-form">{editingEv ? '수정 완료' : '평가 등록'}</Button>
        </>}>
            <form id="legacy-evaluation-form" onSubmit={handleSave} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      className="w-full min-w-0 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold bg-white text-slate-800"
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
                      className="w-full min-w-0 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                    />
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">사번 / 직급</label>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 flex flex-wrap gap-2 items-center justify-between">
                    <span>{formData.emp_no || '-'}</span>
                    <span className="text-xs font-sans text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {formData.department} · {formData.position}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">KPI 점수 (50%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.kpi_score || 0}
                    onChange={(e) => setFormData({ ...formData, kpi_score: Number(e.target.value) })}
                    className="w-full min-w-0 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm text-center font-bold"
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
                    className="w-full min-w-0 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm text-center font-bold"
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
                    className="w-full min-w-0 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">종합 피드백</label>
                <textarea
                  rows={3}
                  value={formData.feedback || ''}
                  onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                  className="w-full min-w-0 px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  placeholder="성과 및 개발 필요 역량 작성"
                />
              </div>

            </form>
      </Modal>
    </div>
  );
}
