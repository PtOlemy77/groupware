'use client';
import { useState } from 'react';
import {
  Approval,
  AuthUser,
  Employee,
  Project,
  BusinessDeal,
  isPmOrAbove,
} from '@/types/groupware';
import { apiFetch } from '@/lib/api';
import { buildDefaultFullContractDoc } from './contract/ContractDashboard';
import ContractWorkstationModal from './contract/ContractWorkstationModal';
export default function ContractApprovalView({
  currentUser,
  approvals,
  employees,
  projects,
  deals,
  onRefresh,
}: {
  currentUser: AuthUser;
  approvals: Approval[];
  employees: Employee[];
  projects: Project[];
  deals: BusinessDeal[];
  onRefresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Approval | null>(null),
    [create, setCreate] = useState(false),
    [busy, setBusy] = useState(false);
  const rows = approvals.filter((a) => a.category.includes('계약품의'));
  async function transition(a: Approval, action: string) {
    const comment =
      action === 'reject' ? prompt('반려 사유를 입력하세요.') : '';
    if (comment === null) return;
    try {
      setBusy(true);
      await apiFetch('/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'approvals',
          action,
          id: a.id,
          version: a.version,
          data: { reviewer_comment: comment },
        }),
      });
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="font-bold text-xl">계약품의 · 결재</h1>
        {isPmOrAbove(currentUser.role) && (
          <button
            className="bg-indigo-600 text-white rounded px-4 py-2"
            onClick={() => setCreate(true)}
          >
            계약 초안 작성
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600">
        초안을 저장한 뒤 지정 결재자에게 상신하세요. 승인된 계약은 개정본을
        만들어 수정합니다.
      </p>
      {!rows.length && (
        <p className="bg-white border rounded p-8 text-slate-500">
          등록된 계약품의서가 없습니다.
        </p>
      )}
      {rows.map((a) => (
        <article
          key={a.id}
          className="bg-white rounded-xl border p-4 space-y-3"
        >
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">{a.doc_no}</p>
              <h2 className="font-bold">{a.title}</h2>
              <p className="text-sm">
                {a.requester} · {a.status} · 공급가 {a.amount.toLocaleString()}
                천원
              </p>
            </div>
            <button
              onClick={async () =>
                setSelected(
                  await (
                    await apiFetch(`/api/groupware/approvals/${a.id}`)
                  ).json(),
                )
              }
              className="text-indigo-700"
            >
              열기
            </button>
          </div>
          <div className="flex gap-3 text-sm">
            {['작성중', '반려'].includes(a.status) && (
              <button disabled={busy} onClick={() => transition(a, 'submit')}>
                결재 상신
              </button>
            )}
            {a.status === '결재대기' && a.approver_id === currentUser.id && (
              <>
                <button
                  disabled={busy}
                  onClick={() => transition(a, 'approve')}
                >
                  최종 승인
                </button>
                <button disabled={busy} onClick={() => transition(a, 'reject')}>
                  반려
                </button>
              </>
            )}
            {a.status === '승인완료' && (
              <button disabled={busy} onClick={() => transition(a, 'revise')}>
                개정본 만들기
              </button>
            )}
          </div>
          {a.reviewer_comment && (
            <p className="text-sm text-slate-600">
              결재 의견: {a.reviewer_comment}
            </p>
          )}
        </article>
      ))}
      {(selected || create) && (
        <ContractWorkstationModal
          initialDoc={buildDefaultFullContractDoc(
            selected || undefined,
            currentUser,
          )}
          approvalRecord={selected || undefined}
          currentUser={currentUser}
          employees={employees}
          projects={projects}
          deals={deals}
          isNew={create}
          onClose={() => {
            setSelected(null);
            setCreate(false);
          }}
          onSaved={onRefresh}
        />
      )}
    </section>
  );
}
