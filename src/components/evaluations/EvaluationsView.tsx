'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';
import { EVALUATION_STATES, goalTemplates, planMonths, fullYearMonths, achievement } from '@/lib/evaluation-plans';
import type { Evaluation, AuthUser, Employee } from '@/types/groupware';
import type {
  PerformancePlan,
  PerformanceList,
  PerformanceGoal,
  PerformanceResult,
  EvaluationPlanState,
} from '@/types/evaluation-plans';
import LegacyEvaluationsView from './LegacyEvaluationsView';
import { Plus, LockKeyhole, RefreshCw, ClipboardCheck, Award, Clock3, ClipboardList, Trash2 } from 'lucide-react';
import { PageHeaderBar, TabGroup, Button, Modal, Card, Badge, SearchInput } from '@/components/common';

interface EvaluationsViewProps {
  evaluations: Evaluation[];
  currentUser: AuthUser;
  employees?: Employee[];
  onRefresh: () => Promise<void>;
}

const inputClass =
  'w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:bg-slate-50 disabled:text-slate-600';
const labelClass = 'block min-w-0 text-xs font-semibold text-slate-700 mb-1';

const stateVariants: Record<EvaluationPlanState, 'neutral' | 'warning' | 'danger' | 'success' | 'info'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  REVISION_REQUIRED: 'danger',
  APPROVED: 'success',
  RESULT_REVISION_REQUIRED: 'danger',
  RESULT_SUBMITTED: 'info',
  EVALUATED: 'success',
};

export default function EvaluationsView(props: EvaluationsViewProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const [tab, setTab] = useState<'plans' | 'legacy'>('plans');

  const checkConfig = useCallback(async () => {
    try {
      const response = await apiFetch('/api/evaluation-plans/config');
      const data = await response.json();
      setEnabled(data.enabled);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정을 읽지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void checkConfig();
  }, [checkConfig, props.currentUser.id]);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-white p-5">
        <p className="text-sm text-rose-700">{error}</p>
        <Button variant="secondary" className="mt-3" onClick={() => void checkConfig()}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (enabled === null) {
    return <p role="status" className="p-5 text-sm text-slate-500">인사평가를 불러오고 있습니다.</p>;
  }

  if (!enabled) {
    return <LegacyEvaluationsView {...props} />;
  }

  return (
    <div className="min-w-0 space-y-4">
      <PageHeaderBar
        left={
          <TabGroup
            items={[
              { key: 'plans', label: '수행목표·실적' },
              { key: 'legacy', label: '기존 종합평가' },
            ]}
            activeKey={tab}
            onChange={key => setTab(key === 'legacy' ? 'legacy' : 'plans')}
            variant="segmented"
            size="sm"
            ariaLabel="인사평가 보기"
          />
        }
      />
      {tab === 'legacy' ? (
        <LegacyEvaluationsView {...props} />
      ) : (
        <PerformancePlans currentUser={props.currentUser} onRefresh={props.onRefresh} />
      )}
    </div>
  );
}

function PerformancePlans({ currentUser, onRefresh }: Pick<EvaluationsViewProps, 'currentUser' | 'onRefresh'>) {
  const { showAlert, showConfirm } = useModal();
  const currentYear = new Date().getFullYear();

  // 검색 및 목록 필터 상태
  const [year, setYear] = useState<number>(currentYear);
  const [page, setPage] = useState<number>(0);
  const [query, setQuery] = useState<string>('');
  const [filter, setFilter] = useState<string>('');

  // 목록 데이터 및 로딩 상태
  const [data, setData] = useState<PerformanceList | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // 모달 및 폼 상태
  const [open, setOpen] = useState<boolean>(false);
  const [selected, setSelected] = useState<PerformancePlan | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // 작성/편집 세부 필드
  const [kind, setKind] = useState<'PROJECT' | 'POOL'>('PROJECT');
  const [assignmentId, setAssignmentId] = useState<number | ''>('');
  const [reviewerId, setReviewerId] = useState<number | ''>('');
  const [title, setTitle] = useState<string>('');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [planned, setPlanned] = useState<Record<string, number>>({});
  const [actualMm, setActualMm] = useState<Record<string, number>>({});
  const [results, setResults] = useState<PerformanceResult[]>([]);
  const [comment, setComment] = useState<string>('');
  const [scores, setScores] = useState<Record<string, { score: number | ''; reason: string }>>({});

  const requestRef = useRef<number>(0);

  // 목록 조회
  const load = useCallback(async () => {
    const ticket = ++requestRef.current;
    setLoading(true);
    try {
      const response = await apiFetch(
        `/api/evaluation-plans?year=${year}&page=${page}&size=50&q=${encodeURIComponent(query)}&state=${filter}`
      );
      const nextData = await response.json();
      if (ticket === requestRef.current) {
        setData(nextData);
        setError('');
      }
    } catch (err) {
      if (ticket === requestRef.current) {
        setError(err instanceof Error ? err.message : '목록을 읽지 못했습니다.');
      }
    } finally {
      if (ticket === requestRef.current) {
        setLoading(false);
      }
    }
  }, [year, page, query, filter]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 150);
    return () => {
      clearTimeout(timer);
      requestRef.current++;
    };
  }, [load]);

  // 선택된 수행평가 세부 데이터를 폼 상태에 바인딩
  const putSelected = (plan: PerformancePlan) => {
    setSelected(plan);
    setKind(plan.kind);
    setAssignmentId(plan.assignment_id ?? '');
    setReviewerId(plan.reviewer_id);
    setTitle(plan.title);
    setStart(plan.start_date);
    setEnd(plan.end_date);
    setGoals(plan.goals);

    // 1년 전체 12개월(01~12월) 목록을 기준으로 0~1 공수 초기화 및 바인딩
    const planYear = Number(plan.start_date?.slice(0, 4)) || year;
    const fullPlanned: Record<string, number> = {};
    const fullActual: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${planYear}-${String(m).padStart(2, '0')}`;
      fullPlanned[monthKey] = plan.planned_mm?.[monthKey] ?? 0;
      fullActual[monthKey] = plan.actual_mm?.[monthKey] ?? (plan.planned_mm?.[monthKey] ?? 0);
    }
    setPlanned(fullPlanned);
    setActualMm(fullActual);

    const initialResults = plan.goals.map(
      goal => plan.results.find(res => res.goal_id === goal.id) || { goal_id: goal.id, actual: null, evidence: '' }
    );
    setResults(initialResults);

    const initialScores: Record<string, { score: number | ''; reason: string }> = Object.fromEntries(
      plan.goals.map(goal => {
        const found = initialResults.find(r => r.goal_id === goal.id);
        const resolvedScore = found?.score ?? achievement(goal, found?.actual ?? null) ?? '';
        return [
          goal.id,
          {
            score: resolvedScore as number | '',
            reason: found?.reason || '',
          },
        ];
      })
    );
    setScores(initialScores);
    setComment('');
  };

  const run = async (task: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await task();
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : '저장하지 못했습니다.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const write = async (url: string, body: unknown): Promise<PerformancePlan> => {
    const response = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    window.dispatchEvent(new Event('data-change-saved'));
    return result;
  };

  const refresh = async () => {
    await load();
    await onRefresh();
  };

  // 프로젝트 배정 또는 인재풀 선택 시 기본 데이터 및 품의서 M/M 1년 전체(01~12월) 동기화
  const choose = (nextKind: 'PROJECT' | 'POOL', id: number | '') => {
    setKind(nextKind);
    setAssignmentId(id);
    setReviewerId('');
    setGoals(goalTemplates(nextKind));
    setResults([]);
    setScores({});
    setComment('');

    if (nextKind === 'PROJECT') {
      const assignment = data?.assignments.find(item => item.id === id);
      setStart(assignment?.start_date || `${year}-01-01`);
      setEnd(assignment?.end_date || `${year}-12-31`);
      setTitle(assignment ? `${assignment.project_name} 수행목표` : '프로젝트 수행목표');

      if (assignment && !assignment.requires_executive) {
        setReviewerId(assignment.pm_id);
      }

      // 1년 전체 12개월(01~12월)을 0으로 기본 채우고, 계약품의서에서 승인된 M/M 바인딩
      const targetYear = Number((assignment?.start_date || `${year}-01-01`).slice(0, 4)) || year;
      const initialMm: Record<string, number> = {};
      for (let m = 1; m <= 12; m++) {
        const monthKey = `${targetYear}-${String(m).padStart(2, '0')}`;
        initialMm[monthKey] = 0;
      }
      if (assignment?.synced_mm && Object.keys(assignment.synced_mm).length > 0) {
        Object.assign(initialMm, assignment.synced_mm);
      }
      setPlanned(initialMm);
      setActualMm(initialMm);
    } else {
      const month = year === currentYear ? new Date().getMonth() + 1 : 1;
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      setStart(`${prefix}-01`);
      setEnd(`${prefix}-${new Date(year, month, 0).getDate()}`);
      setTitle(`${prefix} 인재풀 월별 수행목표`);

      // 인재풀: 해당 연도 12개월 중 현재 월은 1.0, 나머지는 0으로 초기화
      const initialMm: Record<string, number> = {};
      for (let m = 1; m <= 12; m++) {
        const monthKey = `${year}-${String(m).padStart(2, '0')}`;
        initialMm[monthKey] = m === month ? 1 : 0;
      }
      setPlanned(initialMm);
      setActualMm(initialMm);
    }
  };

  const create = (nextKind?: 'PROJECT' | 'POOL', id?: number) => {
    setSelected(null);
    const defaultKind = nextKind || ((data?.assignments.length || 0) > 0 ? 'PROJECT' : 'POOL');
    const defaultId = id ?? data?.assignments[0]?.id ?? '';
    choose(defaultKind, defaultId);
    setOpen(true);
  };

  const detail = (plan: PerformancePlan) =>
    void run(async () => {
      const response = await apiFetch(`/api/evaluation-plans/${plan.id}`);
      const fullPlan = await response.json();
      putSelected(fullPlan);
      setOpen(true);
    });

  const getGoalBody = () => ({
    title,
    start_date: start,
    end_date: end,
    goals,
    planned_mm: planned,
    reviewer_id: reviewerId || null,
  });

  const saveGoals = async () => {
    const body = selected
      ? { version: selected.version, ...getGoalBody() }
      : { kind, assignment_id: kind === 'PROJECT' ? assignmentId || null : null, ...getGoalBody() };
    const saved = await write(selected ? `/api/evaluation-plans/${selected.id}/save_goals` : '/api/evaluation-plans', body);
    putSelected(saved);
    await refresh();
    return saved;
  };

  const act = async (action: string, body: object = {}, targetPlan = selected) => {
    if (!targetPlan) return;
    const next = await write(`/api/evaluation-plans/${targetPlan.id}/${action}`, {
      version: targetPlan.version,
      ...body,
    });
    if (action === 'delete_draft') {
      setOpen(false);
      setSelected(null);
    } else {
      putSelected(next);
    }
    await refresh();
  };

  const saveResults = async () => {
    if (!selected) throw new Error('승인된 목표를 선택하세요.');
    const resultsBody = results.map(({ goal_id, actual, evidence }) => ({ goal_id, actual, evidence }));
    const saved = await write(`/api/evaluation-plans/${selected.id}/save_results`, {
      version: selected.version,
      results: resultsBody,
      actual_mm: actualMm,
    });
    putSelected(saved);
    await refresh();
    return saved;
  };

  const isOwner = !selected || selected.employee_id === currentUser.id;
  const editGoals = isOwner && (!selected || selected.can_edit_goals);
  const editResults = Boolean(selected?.can_edit_results);
  const isLocked = Boolean(selected?.goals_hash);

  const currentAssignment = data?.assignments.find(item => item.id === (assignmentId || selected?.assignment_id));
  const reviewerOptions =
    data?.reviewers.filter(r => kind === 'POOL' || !currentAssignment?.requires_executive || r.executive) || [];

  // 월별 M/M 공수 입력 그리드 (1년 12개월 전체 표시 및 0~1 공수 관리)
  const renderMmEditor = (
    values: Record<string, number>,
    setValues: (val: Record<string, number>) => void,
    disabled: boolean,
    prefix: string
  ) => {
    const months = fullYearMonths(start || year);
    return (
      <fieldset disabled={disabled || saving} className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {months.map(month => {
          const isWithinPeriod = !start || !end || (month >= start.slice(0, 7) && month <= end.slice(0, 7));
          return (
            <label key={month} className="space-y-1 text-center block">
              <span className={`block text-xs font-semibold ${isWithinPeriod ? 'text-slate-800' : 'text-slate-400'}`}>
                {month.slice(5)}월
              </span>
              <div className="relative">
                <input
                  aria-label={`${prefix} ${month}`}
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={values[month] ?? 0}
                  placeholder="0"
                  onChange={e =>
                    setValues({
                      ...values,
                      [month]: Math.max(0, Math.min(1, Number(e.target.value) || 0)),
                    })
                  }
                  className={`w-full rounded-xl border py-1.5 pl-1.5 pr-6 text-right text-xs font-mono font-bold transition disabled:bg-slate-50 disabled:text-slate-500 ${
                    isWithinPeriod
                      ? 'border-indigo-300 bg-white text-indigo-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                      : 'border-slate-200 bg-slate-50/80 text-slate-500 focus:border-slate-400'
                  }`}
                />
                <span className="pointer-events-none absolute right-1.5 top-2 text-[10px] font-normal text-slate-400">
                  MM
                </span>
              </div>
            </label>
          );
        })}
      </fieldset>
    );
  };

  const changeResult = (goalId: string, patch: Partial<PerformanceResult>) => {
    setResults(previous => previous.map(res => (res.goal_id === goalId ? { ...res, ...patch } : res)));
  };

  const reviewPending =
    Boolean(selected?.can_review) && (selected?.state === 'SUBMITTED' || selected?.state === 'RESULT_SUBMITTED');
  const totalWeight = goals.reduce((sum, goal) => sum + goal.weight, 0);

  // 모달 하단 액션 버튼 그룹
  const modalActions = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div>
        {selected && editGoals && (
          <Button
            variant="ghost"
            size="md"
            className="text-rose-600 hover:bg-rose-50"
            disabled={saving}
            icon={<Trash2 size={16} />}
            onClick={() =>
              void run(async () => {
                const confirmed = await showConfirm('작성 중인 수행목표를 삭제하시겠습니까?', {
                  isDanger: true,
                  confirmText: '삭제',
                });
                if (confirmed) {
                  await act('delete_draft');
                }
              })
            }
          >
            초안 삭제
          </Button>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="md" disabled={saving} onClick={() => setOpen(false)}>
          닫기
        </Button>

        {editGoals && (
          <>
            <Button variant="secondary" size="md" disabled={saving} onClick={() => void run(() => saveGoals())}>
              초안 저장
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={saving}
              onClick={() =>
                void run(async () => {
                  const saved = await saveGoals();
                  await act('submit', {}, saved);
                })
              }
            >
              목표 제출
            </Button>
          </>
        )}

        {selected?.can_review && selected.state === 'SUBMITTED' && (
          <>
            <Button
              variant="secondary"
              size="md"
              disabled={saving}
              onClick={() => void run(() => act('request_revision', { comment }))}
            >
              목표 보완 요청
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={saving}
              onClick={() =>
                void run(async () => {
                  const confirmed = await showConfirm(
                    '목표를 승인하면 목표·배점·계획 공수는 잠기고 실적만 입력할 수 있습니다. 승인하시겠습니까?',
                    { confirmText: '승인' }
                  );
                  if (confirmed) {
                    await act('approve', { comment });
                  }
                })
              }
            >
              목표 승인
            </Button>
          </>
        )}

        {editResults && (
          <>
            <Button variant="secondary" size="md" disabled={saving} onClick={() => void run(() => saveResults())}>
              결과 임시저장
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={saving}
              onClick={() =>
                void run(async () => {
                  const saved = await saveResults();
                  await act('submit_results', {}, saved);
                })
              }
            >
              결과 제출
            </Button>
          </>
        )}

        {selected?.can_review && selected.state === 'RESULT_SUBMITTED' && (
          <>
            <Button
              variant="secondary"
              size="md"
              disabled={saving}
              onClick={() => void run(() => act('request_result_revision', { comment }))}
            >
              실적 보완 요청
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={saving}
              onClick={() =>
                void run(async () => {
                  const confirmed = await showConfirm(
                    '수행평가 점수를 확정하시겠습니까? 확정 후 결과와 점수는 변경할 수 없습니다.',
                    { confirmText: '확정' }
                  );
                  if (confirmed) {
                    await act('evaluate', {
                      comment,
                      scores: goals.map(goal => ({
                        goal_id: goal.id,
                        score: scores[goal.id]?.score,
                        reason: scores[goal.id]?.reason || '',
                      })),
                    });
                  }
                })
              }
            >
              평가 확정
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <section className="min-w-0 space-y-3" aria-label="수행평가 관리">
      {/* 2026 인사평가 연동 슬림 현황 바 (성과 50점 + 수행 35점 + 수행평점 100점 + 실적공수) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/20 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
              <Award size={13} className="text-indigo-600" /> 성과지표 (공수연동)
            </div>
            <div className="text-[10px] text-indigo-600/80">
              품의 승인 {data?.summary.contract_total_mm ?? 0} MM
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-black text-indigo-700 font-mono">
              {data?.summary.capacity_points == null ? '—' : `${data.summary.capacity_points}`}{' '}
              <span className="text-xs font-normal text-indigo-500">/ 50</span>
            </div>
          </div>
        </div>

        <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <ClipboardCheck size={13} className="text-amber-500" /> 수행지표 환산
            </div>
            <div className="text-[10px] text-slate-400">프로젝트 수행평가</div>
          </div>
          <div className="text-right">
            <div className="text-base font-black text-slate-800 font-mono">
              {data?.summary.performance_points == null ? '—' : `${data.summary.performance_points}`}{' '}
              <span className="text-xs font-normal text-slate-400">/ 35</span>
            </div>
          </div>
        </div>

        <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <ClipboardList size={13} className="text-slate-600" /> 확정 수행평점
            </div>
            <div className="text-[10px] text-slate-400">{year}년 가중 평균</div>
          </div>
          <div className="text-base font-black text-slate-700 font-mono">
            {data?.summary.score == null ? '—' : `${data.summary.score}`}{' '}
            <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
        </div>

        <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <Clock3 size={13} className="text-emerald-600" /> 확정 실적 공수
            </div>
            <div className="text-[10px] text-slate-400">평가 확정 수행 실적</div>
          </div>
          <div className="text-base font-black text-emerald-600 font-mono">
            {data?.summary.actual_mm ?? 0} MM
          </div>
        </div>
      </div>

      {/* 작성 대기 중인 목표 카드 안내 */}
      {data && (data.assignments.some(item => item.needs_plan) || data.pool_available) && (
        <Card padding="sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ClipboardList size={17} className="text-indigo-500" />작성할 목표
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {data.assignments
                .filter(assignment => assignment.needs_plan)
                .map(assignment => (
                  <Button
                    key={assignment.id}
                    variant="outline"
                    size="sm"
                    className="max-w-full text-left [&>span]:break-words [&>span]:min-w-0"
                    onClick={() => create('PROJECT', assignment.id)}
                  >
                    {assignment.project_name} · 목표 작성 필요
                  </Button>
                ))}
              {data.pool_available && (
                <Button variant="outline" size="sm" onClick={() => create('POOL')}>
                  인재풀 월별 목표 작성
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 검색 및 필터 헤더 바 */}
      <PageHeaderBar
        left={
          <>
            <select
              aria-label="수행평가 연도"
              value={year}
              onChange={e => {
                setYear(Number(e.target.value));
                setPage(0);
              }}
              className={inputClass.replace('w-full ', '') + ' w-28'}
            >
              {Array.from({ length: currentYear - 2020 + 5 }, (_, i) => 2020 + i)
                .reverse()
                .map(y => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
            </select>
            <select
              aria-label="수행평가 상태"
              value={filter}
              onChange={e => {
                setFilter(e.target.value);
                setPage(0);
              }}
              className={inputClass.replace('w-full ', '') + ' w-52'}
            >
              <option value="">전체 상태</option>
              {Object.entries(EVALUATION_STATES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </>
        }
        right={
          <>
            <SearchInput
              aria-label="수행평가 검색"
              value={query}
              placeholder="직원·프로젝트·목표 제목 검색"
              onChange={e => {
                setQuery(e.target.value);
                setPage(0);
              }}
              onClear={() => {
                setQuery('');
                setPage(0);
              }}
              className="w-full sm:w-64"
            />
            <Button
              variant="secondary"
              aria-label="수행평가 새로고침"
              disabled={loading}
              icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />}
              onClick={() => void load()}
            />
            <Button
              disabled={!data || (!data.pool_available && !data.assignments.length)}
              icon={<Plus size={16} />}
              onClick={() => create()}
            >
              수행목표 작성
            </Button>
          </>
        }
      />

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* 목록 테이블 */}
      <Card
        padding="none"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span role="status">{loading ? '불러오는 중' : `조회 ${data?.total ?? 0}건`}</span>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0 || loading}
                onClick={() => setPage(p => p - 1)}
              >
                이전
              </Button>
              <span className="tabular-nums">
                {page + 1} / {Math.max(1, Math.ceil((data?.total ?? 0) / 50))}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={(page + 1) * 50 >= (data?.total ?? 0) || loading}
                onClick={() => setPage(p => p + 1)}
              >
                다음
              </Button>
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table
            aria-label="수행평가 목록"
            aria-busy={loading}
            className="w-full min-w-[920px] text-left text-sm text-slate-700"
          >
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
              <tr>
                {['대상자', '프로젝트 / 인재풀', '기간', '상태', '검토자', '투입공수(계획/실적)', '수행 점수', '확인'].map(t => (
                  <th key={t} className="whitespace-nowrap px-4 py-3.5">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.plans.map(plan => (
                <tr key={plan.id} className="transition hover:bg-slate-50/80">
                  <td className="px-4 py-4">
                    <strong className="text-slate-900">{plan.employee_name}</strong>
                    <div className="mt-1 text-xs text-slate-400">{plan.emp_no}</div>
                  </td>
                  <td className="max-w-xs break-words px-4 py-4">
                    <div className="font-semibold text-slate-800">{plan.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{plan.project_name}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs leading-relaxed">
                    {plan.start_date}
                    <br />
                    {plan.end_date}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={stateVariants[plan.state]} className="whitespace-nowrap">
                      {EVALUATION_STATES[plan.state]}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">{plan.reviewer_name}</td>
                  <td className="px-4 py-4 tabular-nums">
                    <div className="font-semibold text-slate-800">
                      계획: <span className="font-mono text-indigo-700">{plan.planned_mm_total ?? 0}</span> MM
                    </div>
                    <div className="text-xs text-slate-400">
                      실적: <span className={`font-mono ${plan.actual_mm_total ? 'font-bold text-emerald-600' : ''}`}>{plan.actual_mm_total ?? 0}</span> MM
                    </div>
                  </td>
                  <td className="px-4 py-4 font-bold tabular-nums text-indigo-600">{plan.score ?? '—'}</td>
                  <td className="px-4 py-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => detail(plan)}
                      aria-label={`${plan.title} 상세`}
                    >
                      상세
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && !data?.plans.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-slate-500">
                    <ClipboardList size={28} className="mx-auto mb-3 text-slate-300" />
                    조회 가능한 수행평가가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 작성 및 상세 모달 */}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={selected ? '수행평가 상세' : '수행평가 작성'}
        description={
          selected
            ? `${selected.employee_name} · ${EVALUATION_STATES[selected.state]}`
            : '프로젝트 배정마다 작성하고, 인재풀은 월별로 작성합니다.'
        }
        icon={<Award className="w-5 h-5 text-indigo-600" />}
        size="2xl"
        closeOnBackdrop={false}
        closeOnEsc={false}
        footer={modalActions}
      >
        {isLocked && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-xs text-emerald-800 shadow-2xs"
          >
            <LockKeyhole size={16} className="shrink-0 text-emerald-600" />
            <div>
              <strong className="font-bold">목표 제출내역 잠금:</strong> 승인된 목표·배점·계획 공수는 변경할 수 없으며
              실적과 실제 공수만 입력할 수 있습니다.
            </div>
          </div>
        )}

        {(selected?.review_comment || selected?.result_comment) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 shadow-2xs space-y-1">
            <div className="font-bold text-amber-950 flex items-center gap-1.5">
              <span>검토·보완 의견</span>
            </div>
            {selected.review_comment && (
              <p className="whitespace-pre-wrap break-words text-slate-700">{selected.review_comment}</p>
            )}
            {selected.result_comment && (
              <p className="whitespace-pre-wrap break-words text-slate-700">{selected.result_comment}</p>
            )}
          </div>
        )}

        {/* 1. 기본 정보 & 계획 공수 패널 */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-200/80 pb-2">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">기본 정보 및 계획 공수</h4>
            <span className="text-xs text-slate-500 font-medium">월 최대 1.0 MM · 담당 PM/검토자 승인</span>
          </div>

          <fieldset disabled={!editGoals || saving} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            {!selected && (
              <>
                <div className="lg:col-span-2">
                  <label className={labelClass}>작성 구분</label>
                  <select
                    aria-label="작성 구분"
                    value={kind}
                    className={inputClass}
                    onChange={e => choose(e.target.value as 'PROJECT' | 'POOL', data?.assignments[0]?.id ?? '')}
                  >
                    <option value="PROJECT" disabled={!data?.assignments.length}>
                      프로젝트 목표
                    </option>
                    <option value="POOL" disabled={!data?.pool_available}>
                      인재풀 월별 목표
                    </option>
                  </select>
                </div>

                {kind === 'PROJECT' && (
                  <div className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">프로젝트 배정</label>
                      {currentAssignment?.contract_doc_no && (
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          품의번호 {currentAssignment.contract_doc_no}
                        </span>
                      )}
                    </div>
                    <select
                      aria-label="프로젝트 배정"
                      value={assignmentId}
                      className={inputClass}
                      onChange={e => choose('PROJECT', Number(e.target.value))}
                    >
                      <option value="">배정 선택</option>
                      {data?.assignments.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.project_name} · {item.start_date}
                          {item.ended ? ' (종료)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div
              className={
                selected
                  ? 'sm:col-span-2 lg:col-span-4'
                  : kind === 'PROJECT'
                    ? 'lg:col-span-3'
                    : 'lg:col-span-6'
              }
            >
              <label className={labelClass}>목표 제목</label>
              <input
                aria-label="목표 제목"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: 2026 공간정보 플랫폼 구축 목표"
                className={inputClass}
              />
            </div>

            <div className="lg:col-span-2">
              <label className={labelClass}>검토자</label>
              <select
                aria-label="목표 검토자"
                className={inputClass}
                value={reviewerId}
                disabled={saving || !editGoals || (kind === 'PROJECT' && !currentAssignment?.requires_executive)}
                onChange={e => setReviewerId(Number(e.target.value) || '')}
              >
                <option value="">검토자 선택</option>
                {selected && !reviewerOptions.some(r => r.id === selected.reviewer_id) && (
                  <option value={selected.reviewer_id}>{selected.reviewer_name}</option>
                )}
                {reviewerOptions.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.executive ? ' (임원)' : ' (PM)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-1">
              <label className={labelClass}>시작일</label>
              <input
                aria-label="목표 시작일"
                type="date"
                value={start}
                onChange={e => setStart(e.target.value)}
                className={inputClass + ' px-1.5'}
              />
            </div>

            <div className="lg:col-span-1">
              <label className={labelClass}>종료일</label>
              <input
                aria-label="목표 종료일"
                type="date"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className={inputClass + ' px-1.5'}
              />
            </div>
          </fieldset>

          {/* 계획 공수 한 줄 그리드 및 품의서 연동 안내 */}
          <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                계획 투입 공수 (MM)
                {currentAssignment?.contract_doc_no ? (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    계약품의 승인 공수 자동 연동 ({currentAssignment.synced_total_mm ?? 0} MM)
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">품의서 작성 내역 실시간 반영</span>
                )}
              </span>
              {currentAssignment?.progress != null && (
                <span className="text-[11px] text-slate-500">
                  프로젝트 공정률{' '}
                  <strong className="text-indigo-600 font-mono font-bold">
                    {currentAssignment.progress}%
                  </strong>
                </span>
              )}
            </div>
            {renderMmEditor(planned, setPlanned, !editGoals, '계획 공수')}
          </div>
        </div>

        {/* 2. 수행목표 지표 목록 테이블 */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">수행목표 지표</h4>
              <Badge variant={totalWeight > 100 ? 'danger' : 'info'}>
                배점 합계 {totalWeight}점 / 100점
              </Badge>
            </div>
            {editGoals && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={14} />}
                disabled={saving}
                onClick={() =>
                  setGoals(previous => [
                    ...previous,
                    {
                      id: crypto.randomUUID(),
                      category: kind === 'POOL' ? 'APPROVED_WORK' : 'CUSTOM',
                      title: '추가 수행지표',
                      criterion: '',
                      direction: 'HIGHER',
                      target: 0,
                      unit: '',
                      weight: 0,
                    },
                  ])
                }
              >
                지표 추가
              </Button>
            )}
          </div>

          <fieldset disabled={!editGoals || saving}>
            <div
              aria-hidden="true"
              className="hidden lg:grid grid-cols-[32px_minmax(0,1.2fr)_minmax(0,2fr)_120px_80px_70px_80px_36px] gap-2.5 px-4 py-2 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-600"
            >
              <span>#</span>
              <span>지표명</span>
              <span>개인 목표·달성기준</span>
              <span>달성 방식</span>
              <span className="text-right">목표값</span>
              <span>단위</span>
              <span className="text-right">배점</span>
              <span />
            </div>

            <ol aria-label="수행목표 입력" className="divide-y divide-slate-100">
              {goals.map((goal, index) => {
                const change = (patch: Partial<PerformanceGoal>) =>
                  setGoals(previous =>
                    previous.map(item => (item.id === goal.id ? { ...item, ...patch } : item))
                  );

                return (
                  <li
                    key={goal.id}
                    className="grid grid-cols-1 lg:grid-cols-[32px_minmax(0,1.2fr)_minmax(0,2fr)_120px_80px_70px_80px_36px] gap-2.5 items-center px-4 py-2.5 hover:bg-slate-50/50 transition"
                  >
                    <span className="text-xs font-bold tabular-nums text-indigo-600">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <input
                      aria-label={`지표 ${index + 1} 명칭`}
                      value={goal.title}
                      onChange={e => change({ title: e.target.value })}
                      placeholder="지표명"
                      className={inputClass}
                    />
                    <input
                      aria-label={`지표 ${index + 1} 목표`}
                      value={goal.criterion}
                      placeholder="측정 가능한 목표와 확인 방법"
                      onChange={e => change({ criterion: e.target.value })}
                      className={inputClass}
                    />
                    <select
                      aria-label={`지표 ${index + 1} 달성방식`}
                      value={goal.direction}
                      onChange={e => change({ direction: e.target.value as PerformanceGoal['direction'] })}
                      className={inputClass}
                    >
                      <option value="HIGHER">높을수록 좋음</option>
                      <option value="LOWER">낮을수록 좋음</option>
                      <option value="MANUAL">정성·근거 평가</option>
                    </select>
                    <input
                      aria-label={`지표 ${index + 1} 목표값`}
                      type="number"
                      min="0"
                      step="any"
                      disabled={goal.direction === 'MANUAL' || !editGoals || saving}
                      value={goal.target}
                      onChange={e => change({ target: Number(e.target.value) || 0 })}
                      className={inputClass + ' text-right font-mono'}
                    />
                    <input
                      aria-label={`지표 ${index + 1} 단위`}
                      value={goal.unit}
                      onChange={e => change({ unit: e.target.value })}
                      placeholder="건, % 등"
                      className={inputClass + ' text-center'}
                    />
                    <input
                      aria-label={`지표 ${index + 1} 배점`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={goal.weight}
                      onChange={e => change({ weight: Number(e.target.value) || 0 })}
                      className={inputClass + ' text-right font-bold text-indigo-600 font-mono'}
                    />
                    {editGoals ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        aria-label={`지표 ${index + 1} 삭제`}
                        onClick={() => setGoals(previous => previous.filter(item => item.id !== goal.id))}
                        className="text-slate-400 hover:text-rose-600 p-1.5 h-8 w-8 flex items-center justify-center"
                      >
                        <Trash2 size={15} />
                      </Button>
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ol>
          </fieldset>
        </div>

        {/* 3. 실적 입력 (승인 완료 및 locked 상태일 때) */}
        {isLocked && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">개인 실적 · 증빙 및 실제 투입 공수</h4>
              <span className="text-xs text-slate-500 font-medium">실적값 및 증빙 설명 입력</span>
            </div>
            <fieldset disabled={!editResults || saving}>
              <div className="divide-y divide-slate-100">
                {goals.map((goal, index) => {
                  const currentResult = results.find(res => res.goal_id === goal.id);
                  return (
                    <div
                      key={goal.id}
                      className="grid grid-cols-1 lg:grid-cols-[180px_120px_minmax(0,1fr)] gap-3 items-center px-4 py-3 hover:bg-slate-50/50 transition"
                    >
                      <div className="truncate text-xs font-bold text-slate-800">
                        {goal.title}{' '}
                        <span className="text-slate-500 font-normal">
                          ({goal.target} {goal.unit})
                        </span>
                      </div>
                      <div>
                        {goal.direction !== 'MANUAL' ? (
                          <input
                            aria-label={`지표 ${index + 1} 실적값`}
                            type="number"
                            min="0"
                            step="any"
                            value={currentResult?.actual ?? ''}
                            onChange={e =>
                              changeResult(goal.id, {
                                actual: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className={inputClass + ' text-right font-mono'}
                            placeholder="실적값"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 text-center block py-2 bg-slate-50 rounded-xl border border-slate-200">
                            정성 평가
                          </span>
                        )}
                      </div>
                      <div>
                        <input
                          aria-label={`지표 ${index + 1} 실적 증빙`}
                          value={currentResult?.evidence || ''}
                          onChange={e => changeResult(goal.id, { evidence: e.target.value })}
                          placeholder="실적 설명 및 사내 보관 증빙 위치"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {/* 실제 투입 공수 편집 */}
            <div className="p-4 bg-slate-50/60 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">실제 투입 공수 (MM)</span>
                <span className="text-xs text-slate-500">제출 건 합산 월 최대 1.0 MM</span>
              </div>
              {renderMmEditor(actualMm, setActualMm, !editResults, '실제 공수')}
            </div>
          </div>
        )}

        {/* 4. PM · 검토자 평가 확인 */}
        {reviewPending && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3 shadow-2xs">
            <h4 className="flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-950">
              <ClipboardCheck size={17} className="text-indigo-600" />
              PM · 검토자 평가 확인
            </h4>
            {selected?.state === 'RESULT_SUBMITTED' && (
              <div className="divide-y divide-indigo-100 bg-white rounded-xl border border-indigo-100 overflow-hidden shadow-2xs">
                {goals.map((goal, index) => {
                  const currentResult = results.find(res => res.goal_id === goal.id);
                  const autoScore = achievement(goal, currentResult?.actual ?? null);
                  return (
                    <div
                      key={goal.id}
                      className="grid grid-cols-1 lg:grid-cols-[160px_90px_100px_minmax(0,1fr)] gap-2.5 items-center px-4 py-2.5"
                    >
                      <div className="truncate text-xs font-bold text-slate-800">{goal.title}</div>
                      <div className="text-xs text-slate-500 font-medium">
                        {autoScore === null ? '수동' : `${autoScore}점`}
                      </div>
                      <input
                        aria-label={`지표 ${index + 1} 평가점수`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={scores[goal.id]?.score ?? ''}
                        onChange={e =>
                          setScores(prev => ({
                            ...prev,
                            [goal.id]: {
                              ...prev[goal.id],
                              score: e.target.value === '' ? '' : Number(e.target.value),
                            },
                          }))
                        }
                        className={inputClass + ' text-right font-mono'}
                        placeholder="평가 점수"
                      />
                      <input
                        aria-label={`지표 ${index + 1} 평가근거`}
                        value={scores[goal.id]?.reason || ''}
                        onChange={e =>
                          setScores(prev => ({
                            ...prev,
                            [goal.id]: {
                              ...prev[goal.id],
                              reason: e.target.value,
                            },
                          }))
                        }
                        placeholder="수동·조정 점수 필수 근거"
                        className={inputClass}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <div>
              <label className={labelClass}>검토 종합 의견</label>
              <textarea
                aria-label="검토 의견"
                rows={2}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="검토 및 피드백 의견을 입력하세요"
                className={inputClass + ' resize-none'}
              />
            </div>
          </div>
        )}

        {/* 5. 최종 확정 결과 */}
        {selected?.state === 'EVALUATED' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
            <h4 className="text-xs sm:text-sm font-bold text-emerald-950 mb-2">
              확정 수행점수 <span className="font-mono text-emerald-700">{selected.score}</span> / 100 · 수행지표 환산{' '}
              <span className="font-mono text-emerald-700">{selected.performance_points}</span> / 35
            </h4>
            <ul className="divide-y divide-emerald-100 bg-white rounded-xl border border-emerald-100 overflow-hidden text-xs text-slate-700">
              {goals.map(goal => {
                const currentResult = results.find(res => res.goal_id === goal.id);
                return (
                  <li key={goal.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="font-semibold text-slate-800">
                      {goal.title}
                      <span className="ml-2 text-slate-400 font-normal">배점 {goal.weight}점</span>
                      {currentResult?.reason && (
                        <span className="ml-2 text-slate-500 font-normal">({currentResult.reason})</span>
                      )}
                    </span>
                    <strong className="text-emerald-700 font-mono text-sm">
                      {currentResult?.score ?? '—'}점
                    </strong>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>
    </section>
  );
}
