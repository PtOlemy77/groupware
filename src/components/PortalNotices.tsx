import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Pin, Plus, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';
import './portal-notices.css';

interface Notice {
  id: number;
  title: string;
  content?: string;
  published: boolean;
  pinned: boolean;
  version: number;
  created_on: string;
  updated_on: string;
}
interface NoticePage { items: Notice[]; total: number; page: number; pages: number }
interface NoticeDraft { id?: number; version?: number; title: string; content: string; published: boolean; pinned: boolean }
const emptyDraft = (): NoticeDraft => ({ title: '', content: '', published: false, pinned: false });
const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
async function readResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '공지사항을 불러오지 못했습니다.');
  return data;
}

export default function PortalNotices() {
  const { showAlert, showConfirm } = useModal();
  const [canManage, setCanManage] = useState(false);
  const [management, setManagement] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NoticePage>({ items: [], total: 0, page: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Notice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [draft, setDraft] = useState<NoticeDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const endpoint = management ? '/api/portal/admin/notices' : '/api/portal/notices';

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/portal/notices/access', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(readResponse).then(result => setCanManage(result.can_manage === true)).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`${endpoint}?q=${encodeURIComponent(query)}&page=${page}&size=5`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(readResponse).then(result => {
        if (controller.signal.aborted) return;
        if (page > 0 && result.items.length === 0) { setPage(Math.max(0, result.pages - 1)); return; }
        setData(result);
      }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '공지사항을 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, query, page, revision]);
  useEffect(() => {
    if (detailId === null) { setDetail(null); return; }
    const controller = new AbortController();
    setDetail(null); setDetailLoading(true); setDetailError('');
    fetch(`${endpoint}/${detailId}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(readResponse).then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch(reason => { if (!controller.signal.aborted) setDetailError(reason instanceof Error ? reason.message : '본문을 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [detailId, endpoint, revision]);
  useEffect(() => { if (detail) detailHeading.current?.focus(); }, [detail]);
  useEffect(() => { if (draft) titleInput.current?.focus(); }, [draft?.id, draft === null]);

  async function leaveEditor() {
    if (!draft) return true;
    return showConfirm('작성 중인 내용을 닫을까요? 저장하지 않은 내용은 사라집니다.', { title: '작성 취소', confirmText: '닫기' });
  }
  async function switchMode() {
    if (busy || !(await leaveEditor())) return;
    setManagement(!management); setPage(0); setDetailId(null); setDraft(null); setSaveError('');
  }
  function searchNotices(event: FormEvent) {
    event.preventDefault(); setQuery(search.trim()); setPage(0); setDetailId(null);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true); setSaveError('');
    try {
      await apiFetch(`/api/portal/admin/notices${draft.id ? `/${draft.id}` : ''}`, {
        method: draft.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, title: draft.title.trim(), content: draft.content.trim() }),
      });
      setDraft(null); setDetailId(null); setPage(0); setRevision(value => value + 1);
      void showAlert('공지사항을 저장했습니다.', { type: 'success' });
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  async function removeNotice() {
    if (!detail || busy) return;
    if (!(await showConfirm(`‘${detail.title}’ 공지사항을 삭제할까요?`, { title: '공지사항 삭제', confirmText: '삭제', isDanger: true }))) return;
    setBusy(true);
    try {
      await apiFetch(`/api/portal/admin/notices/${detail.id}?version=${detail.version}`, { method: 'DELETE' });
      setDetailId(null); setRevision(value => value + 1);
      void showAlert('공지사항을 삭제했습니다.', { type: 'success' });
    } catch (reason) { void showAlert(reason instanceof Error ? reason.message : '삭제하지 못했습니다.', { type: 'error', autoClose: false }); }
    finally { setBusy(false); }
  }
  return <section id="notices" className="portal-notices portal-container" aria-labelledby="notices-title">
    <div className="section-label"><span>04 — NOTICE</span><span>NEWS & UPDATES</span></div>
    <div className="notices-heading"><div><h2 id="notices-title">스패셜티 소식</h2><p>회사와 서비스의 새로운 소식을 전합니다.</p></div><div className="notice-actions">{canManage ? <button type="button" onClick={() => void switchMode()} disabled={busy}>{management ? '공개 목록 보기' : '공지 관리'} <ArrowRight size={15} /></button> : <a href="#groupware">관리자 로그인 <ArrowRight size={15} /></a>}</div></div>
    {management && <div className="notice-admin-bar"><span>관리자 모드 · 비공개 글은 관리자에게만 표시됩니다.</span><button type="button" disabled={busy || draft !== null} onClick={() => { setDraft(emptyDraft()); setDetailId(null); setSaveError(''); }}><Plus size={15} /> 공지 작성</button></div>}
    {draft ? <form className="notice-editor" onSubmit={event => void save(event)}>
      <h3>{draft.id ? '공지사항 수정' : '새 공지사항'}</h3>
      <label htmlFor="notice-title-input">제목 <span>최대 200자</span></label><input ref={titleInput} id="notice-title-input" maxLength={200} required disabled={busy} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
      <label htmlFor="notice-content-input">내용 <span>최대 20,000자 · 일반 텍스트</span></label><textarea id="notice-content-input" rows={12} maxLength={20000} required disabled={busy} value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} />
      <p className="notice-editor-help">공개할 회사 소식만 작성하세요. 개인정보나 내부 업무 정보는 포함하지 마세요.</p>
      <div className="notice-settings"><label><input type="checkbox" disabled={busy} checked={draft.published} onChange={event => setDraft({ ...draft, published: event.target.checked })} /> 포털에 게시</label><label><input type="checkbox" disabled={busy} checked={draft.pinned} onChange={event => setDraft({ ...draft, pinned: event.target.checked })} /> 목록 상단 고정</label></div>
      {saveError && <p className="notice-error" role="alert">{saveError}</p>}
      <div className="notice-editor-buttons"><button type="button" disabled={busy} onClick={async () => { if (await leaveEditor()) setDraft(null); }}>취소</button><button className="notice-solid" type="submit" disabled={busy || !draft.title.trim() || !draft.content.trim()}>{busy ? '저장 중…' : draft.published ? '저장하고 게시' : '비공개로 저장'}</button></div>
    </form> : detailId !== null ? <div className="notice-detail">
      <button type="button" className="notice-back" disabled={busy} onClick={() => setDetailId(null)}><ArrowLeft size={15} /> 목록으로</button>
      {detailLoading && <p role="status" className="notice-empty">본문을 불러오는 중입니다.</p>}
      {detailError && <p role="alert" className="notice-error">{detailError}</p>}
      {detail && <><div className="notice-detail-meta">{detail.pinned && <span><Pin size={12} /> 중요</span>}{management && <span>{detail.published ? '게시 중' : '비공개'}</span>}<time dateTime={detail.created_on}>{date(detail.created_on)}</time></div><h3 tabIndex={-1} ref={detailHeading}>{detail.title}</h3><div className="notice-body">{detail.content}</div>{management && <div className="notice-editor-buttons"><button type="button" disabled={busy} onClick={() => void removeNotice()}>삭제</button><button type="button" className="notice-solid" disabled={busy} onClick={() => { setDraft({ id: detail.id, version: detail.version, title: detail.title, content: detail.content || '', published: detail.published, pinned: detail.pinned }); setSaveError(''); }}>수정</button></div>}</>}
    </div> : <>
      <form className="notice-search" onSubmit={searchNotices}><span aria-live="polite">전체 <b>{data.total}</b>건{query && ` · “${query}” 검색 결과`}</span><div><label className="sr-only" htmlFor="notice-search-input">공지 제목 검색</label><input id="notice-search-input" placeholder="제목으로 검색" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /><button type="submit" aria-label="공지사항 검색"><Search size={18} /></button></div></form>
      {loading ? <p role="status" className="notice-empty">공지사항을 불러오는 중입니다.</p> : error ? <div className="notice-empty"><p role="alert">{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>다시 시도</button></div> : data.items.length === 0 ? <p className="notice-empty">{query ? '검색 결과가 없습니다.' : '등록된 공지사항이 없습니다.'}</p> : <ul className="notice-list">{data.items.map(item => <li key={item.id}><button type="button" onClick={() => setDetailId(item.id)}><span className={item.pinned ? 'notice-badge is-pinned' : 'notice-badge'}>{item.pinned ? <><Pin size={12} /> 중요</> : '공지'}</span><span className="notice-row-title">{item.title}{management && !item.published && <small>비공개</small>}</span><time dateTime={item.created_on}>{date(item.created_on)}</time><ArrowRight size={16} /></button></li>)}</ul>}
      {!loading && !error && data.pages > 1 && <nav className="notice-pagination" aria-label="공지사항 페이지"><button type="button" aria-label="이전 페이지" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span aria-live="polite">{page + 1} / {data.pages}</span><button type="button" aria-label="다음 페이지" disabled={page + 1 >= data.pages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></nav>}
    </>}
  </section>;
}
