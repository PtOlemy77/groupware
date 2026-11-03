'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';
import { EVALUATION_STATES, goalTemplates, planMonths, achievement } from '@/lib/evaluation-plans';
import type { Evaluation, AuthUser, Employee } from '@/types/groupware';
import type { PerformancePlan, PerformanceList, PerformanceGoal, PerformanceResult, EvaluationPlanState } from '@/types/evaluation-plans';
import LegacyEvaluationsView from './LegacyEvaluationsView';
import { Plus, LockKeyhole, RefreshCw, ClipboardCheck, Award, Clock3, ClipboardList, Trash2 } from 'lucide-react';
import { PageHeaderBar, TabGroup, Button, Modal, Card, Badge, StatCard, StatGrid, SearchInput } from '@/components/common';

interface Props { evaluations:Evaluation[]; currentUser:AuthUser; employees?:Employee[]; onRefresh:()=>Promise<void>; }
const input = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition disabled:bg-slate-50 disabled:text-slate-600';
const label = 'min-w-0 text-xs font-semibold text-slate-600';
const stateVariants: Record<EvaluationPlanState, 'neutral' | 'warning' | 'danger' | 'success' | 'info'> = {
  DRAFT: 'neutral', SUBMITTED: 'warning', REVISION_REQUIRED: 'danger', APPROVED: 'success',
  RESULT_REVISION_REQUIRED: 'danger', RESULT_SUBMITTED: 'info', EVALUATED: 'success',
};

export default function EvaluationsView(props:Props) {
  const [enabled,setEnabled]=useState<boolean|null>(null),[error,setError]=useState(''),[tab,setTab]=useState<'plans'|'legacy'>('plans');
  const config=useCallback(async()=>{try{const data=await(await apiFetch('/api/evaluation-plans/config')).json();setEnabled(data.enabled);setError('');}catch(e){setError(e instanceof Error?e.message:'설정을 읽지 못했습니다.');}},[]);
  useEffect(()=>{void config();},[config,props.currentUser.id]);
  if(error)return <div className="rounded-xl border border-rose-200 bg-white p-5"><p className="text-sm text-rose-700">{error}</p><Button variant="secondary" className="mt-3" onClick={()=>void config()}>다시 시도</Button></div>;
  if(enabled===null)return <p role="status" className="p-5 text-sm text-slate-500">인사평가를 불러오고 있습니다.</p>;
  if(!enabled)return <LegacyEvaluationsView {...props}/>;
  return <div className="min-w-0 space-y-4">
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
    {tab==='legacy'?<LegacyEvaluationsView {...props}/>:<PerformancePlans currentUser={props.currentUser} onRefresh={props.onRefresh}/>}
  </div>;
}

function PerformancePlans({currentUser,onRefresh}:Pick<Props,'currentUser'|'onRefresh'>) {
  const {showAlert,showConfirm}=useModal();
  const currentYear=new Date().getFullYear();
  const [year,setYear]=useState(currentYear),[page,setPage]=useState(0),[query,setQuery]=useState(''),[filter,setFilter]=useState('');
  const [data,setData]=useState<PerformanceList|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [open,setOpen]=useState(false),[selected,setSelected]=useState<PerformancePlan|null>(null),[saving,setSaving]=useState(false);
  const [kind,setKind]=useState<'PROJECT'|'POOL'>('PROJECT'),[assignmentId,setAssignmentId]=useState<number|''>(''),[reviewerId,setReviewerId]=useState<number|''>('');
  const [title,setTitle]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[goals,setGoals]=useState<PerformanceGoal[]>([]),[planned,setPlanned]=useState<Record<string,number>>({});
  const [actualMm,setActualMm]=useState<Record<string,number>>({}),[results,setResults]=useState<PerformanceResult[]>([]),[comment,setComment]=useState(''),[scores,setScores]=useState<Record<string,{score:number|'';reason:string}>>({});
  const request=useRef(0);
  const load=useCallback(async()=>{
    const ticket=++request.current;setLoading(true);
    try{const response=await apiFetch(`/api/evaluation-plans?year=${year}&page=${page}&size=50&q=${encodeURIComponent(query)}&state=${filter}`);const next=await response.json();if(ticket===request.current){setData(next);setError('');}}
    catch(e){if(ticket===request.current)setError(e instanceof Error?e.message:'목록을 읽지 못했습니다.');}
    finally{if(ticket===request.current)setLoading(false);}
  },[year,page,query,filter]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),150);return()=>{clearTimeout(timer);request.current++;};},[load]);
  const putSelected=(p:PerformancePlan)=>{
    setSelected(p);setKind(p.kind);setAssignmentId(p.assignment_id??'');setReviewerId(p.reviewer_id);setTitle(p.title);setStart(p.start_date);setEnd(p.end_date);setGoals(p.goals);setPlanned(p.planned_mm);
    setActualMm(Object.keys(p.actual_mm).length?p.actual_mm:{...p.planned_mm});
    const rs=p.goals.map(g=>p.results.find(r=>r.goal_id===g.id)||{goal_id:g.id,actual:null,evidence:''});setResults(rs);
    setScores(Object.fromEntries(p.goals.map(g=>{const r=rs.find(r=>r.goal_id===g.id);return [g.id,{score:r?.score??achievement(g,r?.actual??null)??'',reason:r?.reason||''}];})));setComment('');
  };
  const run=async(task:()=>Promise<unknown>)=>{setSaving(true);try{await task();}catch(e){await showAlert(e instanceof Error?e.message:'저장하지 못했습니다.',{type:'error'});}finally{setSaving(false);}};
  const write=async(url:string,body:unknown):Promise<PerformancePlan>=>{const response=await apiFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();window.dispatchEvent(new Event('data-change-saved'));return result;};
  const refresh=async()=>{await load();await onRefresh();};
  const choose=(nextKind:'PROJECT'|'POOL',id:number|'')=>{
    setKind(nextKind);setAssignmentId(id);setReviewerId('');setGoals(goalTemplates(nextKind));setPlanned({});setActualMm({});setResults([]);setScores({});setComment('');
    if(nextKind==='PROJECT') {const a=data?.assignments.find(a=>a.id===id);setStart(a?.start_date||`${year}-01-01`);setEnd(a?.end_date||`${year}-12-31`);setTitle(a?`${a.project_name} 수행목표`:'프로젝트 수행목표');if(a&&!a.requires_executive)setReviewerId(a.pm_id);}
    else {const month=year===currentYear?new Date().getMonth()+1:1;const prefix=`${year}-${String(month).padStart(2,'0')}`;setStart(prefix+'-01');setEnd(`${prefix}-${new Date(year,month,0).getDate()}`);setTitle(`${prefix} 인재풀 월별 수행목표`);}
  };
  const create=(nextKind?:'PROJECT'|'POOL',id?:number)=>{setSelected(null);choose(nextKind||((data?.assignments.length||0)>0?'PROJECT':'POOL'),id??data?.assignments[0]?.id??'');setOpen(true);};
  const detail=(p:PerformancePlan)=>void run(async()=>{putSelected(await(await apiFetch('/api/evaluation-plans/'+p.id)).json());setOpen(true);});
  const goalBody=()=>({title,start_date:start,end_date:end,goals,planned_mm:planned,reviewer_id:reviewerId||null});
  const saveGoals=async()=>{
    const body=selected?{version:selected.version,...goalBody()}:{kind,assignment_id:kind==='PROJECT'?assignmentId||null:null,...goalBody()};
    const p=await write(selected?`/api/evaluation-plans/${selected.id}/save_goals`:'/api/evaluation-plans',body);putSelected(p);await refresh();return p;
  };
  const act=async(action:string,body:object={},p=selected)=>{if(!p)return;const next=await write(`/api/evaluation-plans/${p.id}/${action}`,{version:p.version,...body});if(action==='delete_draft'){setOpen(false);setSelected(null);}else putSelected(next);await refresh();};
  const saveResults=async()=>{if(!selected)throw new Error('승인된 목표를 선택하세요.');const body=results.map(({goal_id,actual,evidence})=>({goal_id,actual,evidence}));const p=await write(`/api/evaluation-plans/${selected.id}/save_results`,{version:selected.version,results:body,actual_mm:actualMm});putSelected(p);await refresh();return p;};
  const own=!selected||selected.employee_id===currentUser.id;
  const editGoals=own&&(!selected||selected.can_edit_goals),editResults=!!selected?.can_edit_results;
  const locked=!!selected?.goals_hash;
  const a=data?.assignments.find(a=>a.id===assignmentId);
  const reviewerOptions=data?.reviewers.filter(r=>kind==='POOL'||!a?.requires_executive||r.executive)||[];
  const mmEditor = (values: Record<string, number>, setValues: (v: Record<string, number>) => void, disabled: boolean, prefix: string) => (
    <fieldset disabled={disabled || saving} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {planMonths(start, end).map(month => (
        <label key={month} className="space-y-1.5 text-xs font-semibold text-slate-600">
          <span>{month}</span>
          <div className="relative">
            <input aria-label={`${prefix} ${month}`} type="number" min="0" max="1" step="0.01"
              value={values[month] ?? ''} placeholder="0"
              onChange={e => setValues({ ...values, [month]: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })}
              className={input + ' pr-10 text-right tabular-nums'} />
            <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-normal text-slate-400">MM</span>
          </div>
        </label>
      ))}
    </fieldset>
  );
  const changeResult = (id: string, patch: Partial<PerformanceResult>) => setResults(previous => previous.map(r => r.goal_id === id ? { ...r, ...patch } : r));
  const reviewPending = !!selected?.can_review && (selected.state === 'SUBMITTED' || selected.state === 'RESULT_SUBMITTED');
  const totalWeight = goals.reduce((sum, goal) => sum + goal.weight, 0);
  const actions = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div>
        {selected && editGoals && (
          <Button variant="ghost" className="text-rose-600" disabled={saving} icon={<Trash2 size={16} />}
            onClick={() => void run(async () => {
              if (await showConfirm('작성 중인 수행목표를 삭제하시겠습니까?', { isDanger: true, confirmText: '삭제' })) await act('delete_draft');
            })}>초안 삭제</Button>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={saving} onClick={() => setOpen(false)}>닫기</Button>
        {editGoals && <>
          <Button variant="secondary" disabled={saving} onClick={() => void run(() => saveGoals())}>초안 저장</Button>
          <Button disabled={saving} onClick={() => void run(async () => { const p = await saveGoals(); await act('submit', {}, p); })}>목표 제출</Button>
        </>}
        {selected?.can_review && selected.state === 'SUBMITTED' && <>
          <Button variant="secondary" disabled={saving} onClick={() => void run(() => act('request_revision', { comment }))}>목표 보완 요청</Button>
          <Button disabled={saving} onClick={() => void run(async () => {
            if (await showConfirm('목표를 승인하면 목표·배점·계획 공수는 잠기고 실적만 입력할 수 있습니다. 승인하시겠습니까?', { confirmText: '승인' })) await act('approve', { comment });
          })}>목표 승인</Button>
        </>}
        {editResults && <>
          <Button variant="secondary" disabled={saving} onClick={() => void run(() => saveResults())}>결과 임시저장</Button>
          <Button disabled={saving} onClick={() => void run(async () => { const p = await saveResults(); await act('submit_results', {}, p); })}>결과 제출</Button>
        </>}
        {selected?.can_review && selected.state === 'RESULT_SUBMITTED' && <>
          <Button variant="secondary" disabled={saving} onClick={() => void run(() => act('request_result_revision', { comment }))}>실적 보완 요청</Button>
          <Button disabled={saving} onClick={() => void run(async () => {
            if (await showConfirm('수행평가 점수를 확정하시겠습니까? 확정 후 결과와 점수는 변경할 수 없습니다.', { confirmText: '확정' })) {
              await act('evaluate', { comment, scores: goals.map(g => ({ goal_id: g.id, score: scores[g.id]?.score, reason: scores[g.id]?.reason || '' })) });
            }
          })}>평가 확정</Button>
        </>}
      </div>
    </div>
  );

  return (
    <section className="min-w-0 space-y-4" aria-label="수행평가 관리">
      <StatGrid columns={3}>
        <StatCard title="내 확정 수행평가" value={data?.summary.score == null ? '—' : `${data.summary.score} / 100`}
          subtext={`${year}년 실제 공수 가중 평균`} icon={<ClipboardCheck size={17} />} variant="primary" />
        <StatCard title="수행지표 환산" value={data?.summary.performance_points == null ? '—' : `${data.summary.performance_points} / 35`}
          subtext="연간 종합평가의 다른 지표와 별도" icon={<Award size={17} />} />
        <StatCard title="확정 실적 공수" value={`${data?.summary.actual_mm ?? 0} MM`}
          subtext="평가가 확정된 수행 실적" icon={<Clock3 size={17} />} />
      </StatGrid>

      {data && (data.assignments.some(a => a.needs_plan) || data.pool_available) && (
        <Card padding="sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><ClipboardList size={17} className="text-indigo-500" />작성할 목표</div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {data.assignments.filter(a => a.needs_plan).map(a => (
                <Button key={a.id} variant="outline" size="sm" className="max-w-full text-left [&>span]:break-words [&>span]:min-w-0"
                  onClick={() => create('PROJECT', a.id)}>{a.project_name} · 목표 작성 필요</Button>
              ))}
              {data.pool_available && <Button variant="outline" size="sm" onClick={() => create('POOL')}>인재풀 월별 목표 작성</Button>}
            </div>
          </div>
        </Card>
      )}

      <PageHeaderBar
        left={<>
          <select aria-label="수행평가 연도" value={year} onChange={e => { setYear(Number(e.target.value)); setPage(0); }} className={input.replace('w-full ', '') + ' w-28'}>
            {Array.from({ length: currentYear - 2020 + 5 }, (_, i) => 2020 + i).reverse().map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select aria-label="수행평가 상태" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} className={input.replace('w-full ', '') + ' w-52'}>
            <option value="">전체 상태</option>
            {Object.entries(EVALUATION_STATES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </>}
        right={<>
          <SearchInput aria-label="수행평가 검색" value={query} placeholder="직원·프로젝트·목표 제목 검색"
            onChange={e => { setQuery(e.target.value); setPage(0); }} onClear={() => { setQuery(''); setPage(0); }} className="w-full sm:w-64" />
          <Button variant="secondary" aria-label="수행평가 새로고침" disabled={loading} icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />} onClick={() => void load()} />
          <Button disabled={!data || (!data.pool_available && !data.assignments.length)} icon={<Plus size={16} />} onClick={() => create()}>수행목표 작성</Button>
        </>}
      />
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      <Card padding="none" footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span role="status">{loading ? '불러오는 중' : `조회 ${data?.total ?? 0}건`}</span>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>이전</Button>
            <span className="tabular-nums">{page + 1} / {Math.max(1, Math.ceil((data?.total ?? 0) / 50))}</span>
            <Button variant="secondary" size="sm" disabled={(page + 1) * 50 >= (data?.total ?? 0) || loading} onClick={() => setPage(p => p + 1)}>다음</Button>
          </div>
        </div>
      }>
        <div className="overflow-x-auto">
          <table aria-label="수행평가 목록" aria-busy={loading} className="w-full min-w-[920px] text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500">
              <tr>{['대상자', '프로젝트 / 인재풀', '기간', '상태', '검토자', '실적 MM', '수행 점수', '확인'].map(t => <th key={t} className="whitespace-nowrap px-4 py-3.5">{t}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.plans.map(p => (
                <tr key={p.id} className="transition hover:bg-slate-50/80">
                  <td className="px-4 py-4"><strong className="text-slate-900">{p.employee_name}</strong><div className="mt-1 text-xs text-slate-400">{p.emp_no}</div></td>
                  <td className="max-w-xs break-words px-4 py-4"><div className="font-semibold text-slate-800">{p.title}</div><div className="mt-1 text-xs text-slate-500">{p.project_name}</div></td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs leading-relaxed">{p.start_date}<br />{p.end_date}</td>
                  <td className="px-4 py-4"><Badge variant={stateVariants[p.state]} className="whitespace-nowrap">{EVALUATION_STATES[p.state]}</Badge></td>
                  <td className="whitespace-nowrap px-4 py-4">{p.reviewer_name}</td>
                  <td className="px-4 py-4 tabular-nums">{p.actual_mm_total}</td>
                  <td className="px-4 py-4 font-bold tabular-nums text-indigo-600">{p.score ?? '—'}</td>
                  <td className="px-4 py-4"><Button variant="secondary" size="sm" onClick={() => detail(p)} aria-label={`${p.title} 상세`}>상세</Button></td>
                </tr>
              ))}
              {!loading && !data?.plans.length && <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-500"><ClipboardList size={28} className="mx-auto mb-3 text-slate-300" />조회 가능한 수행평가가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={selected ? '수행평가 상세' : '수행평가 작성'}
        description={selected ? `${selected.employee_name} · ${EVALUATION_STATES[selected.state]}` : '프로젝트 배정마다 작성하고, 인재풀은 월별로 작성합니다.'}
        icon={<ClipboardCheck size={20} />} size="2xl" closeOnBackdrop={false} closeOnEsc={false} footer={actions}>
        {locked && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-800">
            <LockKeyhole size={18} className="mt-0.5 shrink-0" />
            <div><strong className="font-semibold">목표 제출내역 잠금</strong><p className="mt-1 text-xs leading-relaxed">승인된 목표·배점·계획 공수는 변경할 수 없습니다. 실적과 실제 공수만 입력할 수 있습니다.</p></div>
          </div>
        )}
        {(selected?.review_comment || selected?.result_comment) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900">
            <div className="font-semibold">검토·보완 의견</div>
            {selected.review_comment && <p className="mt-1 whitespace-pre-wrap break-words">{selected.review_comment}</p>}
            {selected.result_comment && <p className="mt-1 whitespace-pre-wrap break-words">{selected.result_comment}</p>}
          </div>
        )}

        <Card padding="sm" header={<h3 className="text-sm font-bold text-slate-800">기본 정보</h3>}>
          <fieldset disabled={!editGoals || saving} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {!selected && <>
              <label className={label}>작성 구분
                <select aria-label="작성 구분" value={kind} className={input + ' mt-1.5'} onChange={e => choose(e.target.value as 'PROJECT' | 'POOL', data?.assignments[0]?.id ?? '')}>
                  <option value="PROJECT" disabled={!data?.assignments.length}>프로젝트 목표</option><option value="POOL" disabled={!data?.pool_available}>인재풀 월별 목표</option>
                </select>
              </label>
              {kind === 'PROJECT' && <label className={label + ' lg:col-span-3'}>프로젝트 배정
                <select aria-label="프로젝트 배정" value={assignmentId} className={input + ' mt-1.5'} onChange={e => choose('PROJECT', Number(e.target.value))}>
                  <option value="">배정 선택</option>{data?.assignments.map(a => <option key={a.id} value={a.id}>{a.project_name} · {a.start_date}{a.ended ? ' (종료)' : ''}</option>)}
                </select>
              </label>}
            </>}
            <label className={label + ' sm:col-span-2 lg:col-span-3'}>목표 제목
              <input aria-label="목표 제목" value={title} onChange={e => setTitle(e.target.value)} className={input + ' mt-1.5'} />
            </label>
            <label className={label}>검토자
              <select aria-label="목표 검토자" className={input + ' mt-1.5'} value={reviewerId}
                disabled={saving || !editGoals || (kind === 'PROJECT' && !a?.requires_executive)} onChange={e => setReviewerId(Number(e.target.value) || '')}>
                <option value="">검토자 선택</option>{selected && !reviewerOptions.some(r => r.id === selected.reviewer_id) && <option value={selected.reviewer_id}>{selected.reviewer_name}</option>}
                {reviewerOptions.map(r => <option key={r.id} value={r.id}>{r.name}{r.executive ? ' (임원)' : ' (PM)'}</option>)}
              </select>
            </label>
            <label className={label + ' lg:col-span-2'}>시작일<input aria-label="목표 시작일" type="date" value={start} onChange={e => setStart(e.target.value)} className={input + ' mt-1.5'} /></label>
            <label className={label + ' lg:col-span-2'}>종료일<input aria-label="목표 종료일" type="date" value={end} onChange={e => setEnd(e.target.value)} className={input + ' mt-1.5'} /></label>
          </fieldset>
          {editGoals && <p className="mt-3 text-xs leading-relaxed text-slate-500">담당 PM이 검토합니다. PM 본인 목표·PM 미지정 건은 임원, 인재풀은 지정 검토자가 확인합니다.</p>}
        </Card>

        <Card padding="none" header={<>
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-800">수행목표</h3><Badge variant={totalWeight > 100 ? 'danger' : 'info'}>배점 합계 {totalWeight}점</Badge></div>
          {editGoals && <Button variant="secondary" size="sm" icon={<Plus size={14} />} disabled={saving}
            onClick={() => setGoals(gs => [...gs, { id: crypto.randomUUID(), category: kind === 'POOL' ? 'APPROVED_WORK' : 'CUSTOM', title: '추가 수행지표', criterion: '', direction: 'HIGHER', target: 0, unit: '', weight: 0 }])}>지표 추가</Button>}
        </>}>
          {kind === 'POOL' && <p className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">기본지표 5개 각 10점. 승인 업무 지표를 추가해 총 100점 이내로 설정합니다.</p>}
          <fieldset disabled={!editGoals || saving}>
            <ol aria-label="수행목표 입력" className="divide-y divide-slate-100">
              {goals.map((g, index) => {
                const change = (patch: Partial<PerformanceGoal>) => setGoals(gs => gs.map(item => item.id === g.id ? { ...item, ...patch } : item));
                return (
                  <li key={g.id} className="space-y-3 p-4 sm:px-5">
                    <div className="flex flex-wrap items-end gap-3">
                      <span className="mb-2.5 text-xs font-bold tabular-nums text-indigo-500">{String(index + 1).padStart(2, '0')}</span>
                      <label className={label + ' min-w-0 flex-1'}>지표명<input aria-label={`지표 ${index + 1} 명칭`} value={g.title} onChange={e => change({ title: e.target.value })} className={input + ' mt-1.5'} /></label>
                      <label className={label + ' w-20 shrink-0'}>배점<input aria-label={`지표 ${index + 1} 배점`} type="number" min="0" max="100" step="0.01" value={g.weight} onChange={e => change({ weight: Number(e.target.value) || 0 })} className={input + ' mt-1.5 text-right'} /></label>
                      {editGoals && <Button variant="ghost" size="sm" className="mb-1 text-rose-500" disabled={saving} aria-label={`지표 ${index + 1} 삭제`} icon={<Trash2 size={15} />} onClick={() => setGoals(gs => gs.filter(item => item.id !== g.id))} />}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
                      <label className={label}>개인 목표·달성기준<textarea rows={2} aria-label={`지표 ${index + 1} 목표`} value={g.criterion} placeholder="측정 가능한 목표와 확인 방법을 작성하세요" onChange={e => change({ criterion: e.target.value })} className={input + ' mt-1.5 resize-y'} /></label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <label className={label + ' col-span-2 sm:col-span-1'}>달성 방식<select aria-label={`지표 ${index + 1} 달성방식`} value={g.direction} onChange={e => change({ direction: e.target.value as PerformanceGoal['direction'] })} className={input + ' mt-1.5'}><option value="HIGHER">높을수록 좋음</option><option value="LOWER">낮을수록 좋음</option><option value="MANUAL">정성·근거 평가</option></select></label>
                        <label className={label}>목표값<input aria-label={`지표 ${index + 1} 목표값`} type="number" min="0" step="any" disabled={g.direction === 'MANUAL' || !editGoals || saving} value={g.target} onChange={e => change({ target: Number(e.target.value) || 0 })} className={input + ' mt-1.5 text-right'} /></label>
                        <label className={label}>단위<input aria-label={`지표 ${index + 1} 단위`} value={g.unit} onChange={e => change({ unit: e.target.value })} className={input + ' mt-1.5'} /></label>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </fieldset>
        </Card>

        <Card padding="sm" header={<><h3 className="text-sm font-bold text-slate-800">계획 공수</h3><span className="text-xs text-slate-500">월 최대 1 MM</span></>}>
          {mmEditor(planned, setPlanned, !editGoals, '계획 공수')}
        </Card>

        {locked && <>
          <Card padding="none" header={<h3 className="text-sm font-bold text-slate-800">개인 실적 · 증빙</h3>}>
            <fieldset disabled={!editResults || saving} className="divide-y divide-slate-100">
              {goals.map((g, index) => {
                const r = results.find(r => r.goal_id === g.id);
                return <div key={g.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:px-5">
                  <div className="break-words text-sm font-semibold text-slate-800">{g.title}<div className="mt-1 text-xs font-normal text-slate-500">목표 {g.target} {g.unit}</div></div>
                  <div className="min-w-0 space-y-3">
                    {g.direction !== 'MANUAL' && <label className={label + ' block max-w-48'}>실적값<input aria-label={`지표 ${index + 1} 실적값`} type="number" min="0" step="any" value={r?.actual ?? ''} onChange={e => changeResult(g.id, { actual: e.target.value === '' ? null : Number(e.target.value) })} className={input + ' mt-1.5'} /></label>}
                    <label className={label + ' block'}>실적·증빙 설명<textarea aria-label={`지표 ${index + 1} 실적 증빙`} rows={2} value={r?.evidence || ''} onChange={e => changeResult(g.id, { evidence: e.target.value })} placeholder="실적 설명과 증빙 파일의 사내 보관위치를 기록하세요" className={input + ' mt-1.5 resize-y'} /></label>
                  </div>
                </div>;
              })}
            </fieldset>
          </Card>
          <Card padding="sm" header={<><h3 className="text-sm font-bold text-slate-800">실제 공수</h3><span className="text-xs text-slate-500">제출 건 합산 월 최대 1 MM</span></>}>
            {mmEditor(actualMm, setActualMm, !editResults, '실제 공수')}
          </Card>
        </>}

        {reviewPending && <Card padding="sm" header={<h3 className="flex items-center gap-2 text-sm font-bold text-indigo-800"><ClipboardCheck size={17} />PM·검토자 확인</h3>} className="border-indigo-200">
          {selected?.state === 'RESULT_SUBMITTED' && <div className="mb-4 divide-y divide-slate-100">
            {goals.map((g, index) => {
              const r = results.find(r => r.goal_id === g.id), auto = achievement(g, r?.actual ?? null);
              return <div key={g.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_100px_minmax(0,2fr)]">
                <div className="text-sm font-semibold text-slate-700">{g.title}<div className="mt-1 text-xs font-normal text-slate-500">달성률 {auto === null ? '수동 평가' : `${auto}점`}</div></div>
                <label className={label}>평가점수<input aria-label={`지표 ${index + 1} 평가점수`} type="number" min="0" max="100" step="0.01" value={scores[g.id]?.score ?? ''} onChange={e => setScores(s => ({ ...s, [g.id]: { ...s[g.id], score: e.target.value === '' ? '' : Number(e.target.value) } }))} className={input + ' mt-1.5'} /></label>
                <label className={label}>평가근거<input aria-label={`지표 ${index + 1} 평가근거`} value={scores[g.id]?.reason || ''} onChange={e => setScores(s => ({ ...s, [g.id]: { ...s[g.id], reason: e.target.value } }))} placeholder="수동·조정 점수는 근거 필수" className={input + ' mt-1.5'} /></label>
              </div>;
            })}
          </div>}
          <label className={label + ' block'}>검토 의견<textarea aria-label="검토 의견" rows={3} value={comment} onChange={e => setComment(e.target.value)} className={input + ' mt-1.5'} /></label>
        </Card>}

        {selected?.state === 'EVALUATED' && <Card padding="sm" className="border-emerald-200 bg-emerald-50/30" header={<h3 className="text-sm font-bold text-emerald-900">확정 수행점수 {selected.score} / 100 · 수행지표 환산 {selected.performance_points} / 35</h3>}>
          <ul className="space-y-2 text-sm text-slate-700">{goals.map(g => { const r = results.find(r => r.goal_id === g.id); return <li key={g.id} className="flex flex-wrap justify-between gap-2"><span>{g.title}<span className="ml-2 text-xs text-slate-500">배점 {g.weight}</span>{r?.reason && <span className="ml-2 text-xs text-slate-500">{r.reason}</span>}</span><strong className="text-emerald-700">{r?.score ?? '—'}점</strong></li>; })}</ul>
        </Card>}
      </Modal>
    </section>
  );
}
