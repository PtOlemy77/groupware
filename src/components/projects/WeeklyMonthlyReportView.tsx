'use client';
import { useMemo, useState } from 'react';
import {
  Approval,
  AuthUser,
  Project,
  Employee,
  isExecutiveOrAbove,
} from '@/types/groupware';
import { apiFetch } from '@/lib/api';
type Item = {
  projectId: number;
  projectCode: string;
  projectName: string;
  pmName: string;
  progress: number;
  thisPeriodWork: string;
  nextPeriodPlan: string;
  issueAndSupport: string;
  pmSubmitted: boolean;
  updatedAt?: string;
};
type Report = {
  reportType: string;
  periodKey: string;
  overallStage: string;
  directorSummary: string;
  ceoFeedback: string;
  items: Item[];
};
interface Props {
  employees?: Employee[];
  projects: Project[];
  approvals: Approval[];
  currentUser: AuthUser;
  initialSelectedProjectId?: number | null;
  onRefresh: () => Promise<void>;
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export default function WeeklyMonthlyReportView({
  employees = [],
  projects,
  approvals,
  currentUser,
  initialSelectedProjectId,
  onRefresh,
}: Props) {
  const [type, setType] = useState('주간보고'),
    [day, setDay] = useState(iso(new Date()));
  const executive = isExecutiveOrAbove(currentUser.role);
  const editableProjects = projects.filter(
    (p) => executive || p.pm_id === currentUser.id,
  );
  const [selectedId, setSelectedId] = useState(
    initialSelectedProjectId || editableProjects[0]?.id || 0,
  );
  const date = new Date(`${day}T12:00:00`);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const periodKey =
    type === '월간보고'
      ? `${day.slice(0, 7)}-M`
      : `${iso(monday).slice(0, 7)}-W${Math.ceil(monday.getDate() / 7)}`;
  const record = approvals.find(
    (a) => a.category === type && a.project_name === periodKey,
  );
  const initial = useMemo<Report>(() => {
    let saved: Partial<Report> = {};
    if (record?.items_json) {
      try {
        saved = JSON.parse(record.items_json);
      } catch {
        /* Preserve record; show empty editable state, never auto-save it. */
      }
    }
    return {
      reportType: type,
      periodKey,
      overallStage: saved.overallStage || 'PM작성중',
      directorSummary: saved.directorSummary || '',
      ceoFeedback: saved.ceoFeedback || '',
      items: editableProjects.map(
        (p) =>
          saved.items?.find((i) => i.projectId === p.id) || {
            projectId: p.id,
            projectCode: p.code,
            projectName: p.name,
            pmName: p.pm_name,
            progress: p.progress,
            thisPeriodWork: '',
            nextPeriodPlan: '',
            issueAndSupport: '',
            pmSubmitted: false,
          },
      ),
    };
  }, [record, periodKey, type, projects]);
  // A keyed editor prevents one period's draft from being written into another period.
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">주간·월간 보고</h1>
      <div className="flex flex-wrap gap-3">
        <label>
          보고 구분
          <select
            className="ml-2 border rounded p-2"
            value={type}
            onChange={(e) => {
              if (
                document.querySelector('[data-unsaved="true"]') &&
                !confirm('미저장 내용을 버리고 기간을 변경할까요?')
              )
                return;
              setType(e.target.value);
            }}
          >
            <option>주간보고</option>
            <option>월간보고</option>
          </select>
        </label>
        <label>
          기준일
          <input
            className="ml-2 border rounded p-2"
            type="date"
            required
            value={day}
            onChange={(e) => {
              if (!e.target.value) return;
              if (
                document.querySelector('[data-unsaved="true"]') &&
                !confirm('미저장 내용을 버리고 기간을 변경할까요?')
              )
                return;
              setDay(e.target.value);
            }}
          />
        </label>
        <label>
          프로젝트
          <select
            className="ml-2 border rounded p-2"
            value={selectedId}
            onChange={(e) => setSelectedId(Number(e.target.value))}
          >
            {editableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-slate-600">
        보고 기간:{' '}
        {type === '주간보고' ? `${iso(monday)} 주간` : day.slice(0, 7)} · 미작성
        실적과 의견은 빈 상태로 유지됩니다.
      </p>
      <ReportEditor
        key={`${type}:${periodKey}:${record?.version ?? 'new'}`}
        initial={initial}
        record={record}
        selectedId={selectedId}
        currentUser={currentUser}
        employees={employees}
        onRefresh={onRefresh}
      />
    </section>
  );
}
function ReportEditor({
  initial,
  record,
  selectedId,
  currentUser,
  employees,
  onRefresh,
}: {
  employees: Employee[];
  initial: Report;
  record?: Approval;
  selectedId: number;
  currentUser: AuthUser;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [approver, setApprover] = useState(
    record?.approver_id?.toString() || '',
  );
  const executive = isExecutiveOrAbove(currentUser.role),
    locked = ['사장님보고완료', '사장님확인완료'].includes(
      initial.overallStage,
    );
  const selected =
    draft.items.find((i) => i.projectId === selectedId) || draft.items[0];
  const patch = (change: Partial<Item>) => {
    if (!selected) return;
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.projectId === selected.projectId ? { ...i, ...change } : i,
      ),
    }));
  };
  async function save(stage = draft.overallStage) {
    try {
      setBusy(true);
      const updated = { ...draft, overallStage: stage };
      await apiFetch('/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'approvals',
          action: record ? 'update' : 'create',
          id: record?.id,
          version: record?.version,
          data: {
            category: updated.reportType,
            title: `[${updated.reportType}] ${updated.periodKey}`,
            project_name: updated.periodKey,
            amount: 0,
            approver_id: Number(approver) || null,
            items_json: JSON.stringify(updated),
          },
        }),
      });
      setNotice('보고서를 저장했습니다.');
      await onRefresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div data-editor className="space-y-4 bg-white border rounded-xl p-4">
      <p>상태: {draft.overallStage}</p>
      {notice && <p role="status">{notice}</p>}
      {!selected && <p>작성할 담당 프로젝트가 없습니다.</p>}
      {selected && (
        <>
          <h2 className="font-bold">{selected.projectName}</h2>
          <label className="block">
            진행률 (%)
            <input
              className="ml-2 border rounded p-2"
              type="number"
              min={0}
              max={100}
              disabled={locked}
              value={selected.progress}
              onChange={(e) => patch({ progress: Number(e.target.value) })}
            />
          </label>
          {(
            [
              ['thisPeriodWork', '이번 기간 실적'],
              ['nextPeriodPlan', '다음 기간 계획'],
              ['issueAndSupport', '이슈·지원 요청'],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="block">
              {label}
              <textarea
                className="block w-full border rounded p-2 mt-1"
                rows={4}
                disabled={locked}
                value={selected[field]}
                onChange={(e) => patch({ [field]: e.target.value })}
              />
            </label>
          ))}
          <label className="flex gap-2">
            <input
              type="checkbox"
              disabled={locked}
              checked={selected.pmSubmitted}
              onChange={(e) => patch({ pmSubmitted: e.target.checked })}
            />
            PM 작성 완료
          </label>
        </>
      )}
      <label className="block">
        취합 의견
        <textarea
          disabled={!executive || locked}
          className="block w-full border rounded p-2"
          value={draft.directorSummary}
          onChange={(e) =>
            setDraft({ ...draft, directorSummary: e.target.value })
          }
        />
      </label>
      <label className="block">
        최종 확인 의견
        <textarea
          disabled={!executive || initial.overallStage === '사장님확인완료'}
          className="block w-full border rounded p-2"
          value={draft.ceoFeedback}
          onChange={(e) => setDraft({ ...draft, ceoFeedback: e.target.value })}
        />
      </label>
      {executive && (
        <label className="block">
          최종 확인자
          <select
            disabled={locked}
            className="ml-2 border rounded p-2"
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
          >
            <option value="">확인자 선택</option>
            {employees
              .filter(
                (e) => isExecutiveOrAbove(e.role) && e.id !== currentUser.id,
              )
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} {e.position}
                </option>
              ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        {!locked && (
          <button
            disabled={busy}
            className="rounded bg-indigo-600 text-white px-4 py-2"
            onClick={() => save()}
          >
            저장
          </button>
        )}
        {executive && !locked && (
          <button disabled={busy} onClick={() => save('사장님보고완료')}>
            최종 확인 요청
          </button>
        )}
        {initial.overallStage === '사장님보고완료' &&
          record?.approver_id === currentUser.id && (
            <button disabled={busy} onClick={() => save('사장님확인완료')}>
              최종 확인 완료
            </button>
          )}
      </div>
    </div>
  );
}
