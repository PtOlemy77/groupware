import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Filter,
  CheckCircle2,
  XCircle,
  Building,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import {
  procurementAmount,
  procurementDate,
  procurementTerms,
  procurementSourceUrl,
} from '@/lib/procurement-display';
import {
  procurementFilter,
  procurementLocation,
} from '@/lib/procurement-navigation';
import { useModal } from '@/contexts/ModalContext';
import {
  Button,
  Modal,
  PageHeaderBar,
  TabGroup,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  TableEmpty,
  Select,
} from '@/components/common';
import {
  businessLabels,
  type BusinessType,
  type NoticeKind,
  type ProcurementAlert,
  type ProcurementRule,
  type ProcurementRuleInput,
  type ProcurementStatus,
  type ProcurementFilter,
} from '@/types/procurement';

const INITIAL_RULE_FORM: ProcurementRuleInput = {
  name: '',
  keywords: '',
  excluded_keywords: '',
  institutions: '',
  match_mode: 'AND',
  notice_kind: 'ALL',
  business_type: 'ALL',
  enabled: true,
};

const PAGE_SIZE = 100;

interface ProcurementViewProps {
  refreshKey: string;
}

/**
 * 조달청 나라장터 입찰공고 및 사전규격 모니터링 관리 화면
 */
export default function ProcurementView({ refreshKey }: ProcurementViewProps) {
  const { showAlert, showConfirm } = useModal();

  // 탭 및 기본 상태
  const [activeTab, setActiveTab] = useState<string>('alerts');
  const [systemStatus, setSystemStatus] = useState<ProcurementStatus | null>(null);
  const [rules, setRules] = useState<ProcurementRule[]>([]);
  const [alerts, setAlerts] = useState<ProcurementAlert[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);

  // 검색 및 필터 상태
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  const initialFilterState = procurementFilter(window.location.hash);
  const [selectedKind, setSelectedKind] = useState<NoticeKind>(initialFilterState.kind);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessType>(initialFilterState.business);
  const [isUnreadOnly, setIsUnreadOnly] = useState<boolean>(initialFilterState.unread);

  // UI 로딩 및 모달 상태
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<ProcurementRule | null | undefined>(undefined);
  const [ruleFormData, setRuleFormData] = useState<ProcurementRuleInput>(INITIAL_RULE_FORM);

  // 비동기 처리 및 마운트 참조
  const activeReadingIds = useRef<Set<number>>(new Set());
  const latestRequestId = useRef<number>(0);
  const isComponentMounted = useRef<boolean>(true);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      latestRequestId.current++;
    };
  }, []);

  // 검색어 디바운스 처리 (300ms)
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setDebouncedQuery(searchInput);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchInput]);

  // 공고 데이터 및 설정 로드
  const fetchProcurementData = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setIsLoading(true);

    try {
      const [statusRes, rulesRes, alertsRes] = await Promise.all([
        apiFetch('/api/procurement/status').then((r) => r.json()),
        apiFetch('/api/procurement/rules').then((r) => r.json()),
        apiFetch(
          `/api/procurement/alerts?page=${currentPage}&size=${PAGE_SIZE}&q=${encodeURIComponent(
            debouncedQuery
          )}&kind=${selectedKind}&business=${selectedBusiness}&unread=${isUnreadOnly}`
        ).then((r) => r.json()),
      ]);

      if (requestId !== latestRequestId.current || !isComponentMounted.current) {
        return;
      }

      setSystemStatus(statusRes);
      setRules(rulesRes);
      setAlerts(alertsRes.items);
      setTotalCount(alertsRes.total);
      setErrorMessage('');
    } catch (err) {
      if (requestId === latestRequestId.current && isComponentMounted.current) {
        setErrorMessage(
          err instanceof Error ? err.message : '공고 데이터를 불러오지 못했습니다.'
        );
      }
    } finally {
      if (requestId === latestRequestId.current && isComponentMounted.current) {
        setIsLoading(false);
      }
    }
  }, [currentPage, debouncedQuery, selectedKind, selectedBusiness, isUnreadOnly]);

  // 주기적 자동 새로고침 (60초)
  useEffect(() => {
    void fetchProcurementData();
    const refreshTimer = setInterval(fetchProcurementData, 60000);
    return () => {
      clearInterval(refreshTimer);
      latestRequestId.current++;
    };
  }, [fetchProcurementData, refreshKey]);

  // 데이터 갱신 이벤트 전파 및 재조회
  const notifyUpdatedAndReload = async () => {
    window.dispatchEvent(new Event('procurement-updated'));
    await fetchProcurementData();
  };

  const handleActionError = async (err: unknown) => {
    await showAlert(err instanceof Error ? err.message : '처리하지 못했습니다.', {
      type: 'error',
      autoClose: false,
    });
  };

  // 관심조건 저장/수정 핸들러
  const handleSaveRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      const url = `/api/procurement/rules${editingRule ? `/${editingRule.id}` : ''}`;
      const payload = {
        ...ruleFormData,
        ...(editingRule ? { version: editingRule.version } : {}),
      };

      await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setEditingRule(undefined);
      await notifyUpdatedAndReload();
      await showAlert('관심조건을 저장했습니다.', { type: 'success' });
    } catch (err) {
      await handleActionError(err);
    } finally {
      setIsSaving(false);
    }
  };

  // 관심조건 삭제 핸들러
  const handleDeleteRule = async (rule: ProcurementRule) => {
    const isConfirmed = await showConfirm(
      `'${rule.name}' 관심조건을 삭제할까요? 기존 공고 알림은 보존됩니다.`,
      {
        title: '관심조건 삭제',
        isDanger: true,
        confirmText: '삭제',
      }
    );
    if (!isConfirmed) return;

    try {
      await apiFetch(`/api/procurement/rules/${rule.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: rule.version }),
      });
      await notifyUpdatedAndReload();
    } catch (err) {
      await handleActionError(err);
    }
  };

  // 공고 알림 읽음 처리
  const handleMarkAsRead = async (item: ProcurementAlert) => {
    if (item.read_on || activeReadingIds.current.has(item.id)) {
      return;
    }

    activeReadingIds.current.add(item.id);
    try {
      await apiFetch(`/api/procurement/alerts/${item.id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: item.version }),
      });
      await notifyUpdatedAndReload();
    } catch (err) {
      await handleActionError(err);
    } finally {
      activeReadingIds.current.delete(item.id);
    }
  };

  // 필터 변경 및 브라우저 해시 동기화
  const handleFilterChange = (nextFilter: ProcurementFilter) => {
    setSelectedKind(nextFilter.kind);
    setSelectedBusiness(nextFilter.business);
    setIsUnreadOnly(nextFilter.unread);
    setCurrentPage(0);
    window.history.replaceState(null, '', `#${procurementLocation(nextFilter)}`);
  };

  // URL 해시 변경 및 외부 알림 클릭 이벤트 수신
  useEffect(() => {
    const handleLocationSync = () => {
      const hashRoute = window.location.hash.slice(1).split('?')[0];
      if (hashRoute !== 'procurement') return;

      const parsedFilter = procurementFilter(window.location.hash);
      setActiveTab('alerts');
      setSearchInput('');
      setDebouncedQuery('');
      setCurrentPage(0);
      setSelectedKind(parsedFilter.kind);
      setSelectedBusiness(parsedFilter.business);
      setIsUnreadOnly(parsedFilter.unread);
    };

    window.addEventListener('hashchange', handleLocationSync);
    window.addEventListener('procurement-filter-navigation', handleLocationSync);
    return () => {
      window.removeEventListener('hashchange', handleLocationSync);
      window.removeEventListener('procurement-filter-navigation', handleLocationSync);
    };
  }, []);

  // 수동 동기화 실행
  const handleManualSync = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch('/api/procurement/sync', { method: 'POST' });
      const data = await res.json();
      await showAlert(
        data.accepted
          ? '나라장터 조회를 시작했습니다. 완료 후 목록이 갱신됩니다.'
          : '이미 조회 중입니다. 잠시 후 새로고침해 주세요.'
      );
      await notifyUpdatedAndReload();
    } catch (err) {
      await handleActionError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateFormField = <K extends keyof ProcurementRuleInput>(
    field: K,
    value: ProcurementRuleInput[K]
  ) => {
    setRuleFormData((prev) => ({ ...prev, [field]: value }));
  };

  // 활성화된 규칙에서 추출한 키워드 및 기관 목록
  const activeKeywords = procurementTerms(
    rules.filter((r) => r.enabled).map((r) => r.keywords)
  );
  const activeInstitutions = procurementTerms(
    rules.filter((r) => r.enabled).map((r) => r.institutions)
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-4 min-w-0">
      {/* 1. 상단 탭 헤더 및 액션 바 */}
      <PageHeaderBar
        left={
          <TabGroup
            ariaLabel="입찰공고 메뉴"
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'alerts',
                label: '공고·알림',
                icon: <Bell className="w-4 h-4" />,
                count: systemStatus?.unread || 0,
              },
              {
                key: 'rules',
                label: '관심 키워드 설정',
                icon: <Settings2 className="w-4 h-4" />,
                count: rules.length,
              },
            ]}
          />
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void fetchProcurementData()}
              loading={isLoading}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              목록 새로고침
            </Button>

            {activeTab === 'rules' ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditingRule(null);
                  setRuleFormData({ ...INITIAL_RULE_FORM });
                }}
                icon={<Plus className="w-4 h-4" />}
              >
                관심조건 등록
              </Button>
            ) : (
              systemStatus?.can_sync && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualSync}
                  loading={isSaving}
                  disabled={!systemStatus.configured || !systemStatus.enabled || systemStatus.running}
                >
                  지금 공고 확인
                </Button>
              )
            )}
          </div>
        }
      />

      {/* 에러 메시지 배너 */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800 shadow-2xs"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. 공고·알림 탭 */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* 등록된 관심 키워드 및 기관 칩 영역 */}
          <section
            aria-label="등록된 관심 키워드"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3"
          >
            {/* 관심 키워드 태그 */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start">
              <div className="flex items-center gap-1.5 shrink-0 pt-0.5 text-xs font-bold text-slate-600">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                <span>관심 키워드</span>
              </div>
              <div className="flex flex-1 min-w-0 max-h-24 overflow-y-auto flex-wrap gap-1.5">
                {activeKeywords.map((keyword) => {
                  const isSelected = searchInput === keyword;
                  return (
                    <button
                      key={keyword}
                      type="button"
                      aria-label={`키워드 ${keyword}로 검색`}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSearchInput(isSelected ? '' : keyword);
                        setCurrentPage(0);
                      }}
                      className={`max-w-full break-words rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                          : 'border-indigo-100 bg-indigo-50/70 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100/70'
                      }`}
                    >
                      #{keyword}
                    </button>
                  );
                })}
                {activeKeywords.length === 0 && (
                  <span className="py-0.5 text-xs text-slate-400">
                    등록된 관심 키워드가 없습니다.
                  </span>
                )}
              </div>
            </div>

            {/* 관심 기관 태그 */}
            {activeInstitutions.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5 text-xs font-bold text-slate-600">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <span>관심 기관</span>
                </div>
                <div className="flex flex-1 min-w-0 max-h-20 overflow-y-auto flex-wrap gap-1.5">
                  {activeInstitutions.map((institution) => {
                    const isSelected = searchInput === institution;
                    return (
                      <button
                        key={institution}
                        type="button"
                        aria-label={`기관 ${institution}로 검색`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSearchInput(isSelected ? '' : institution);
                          setCurrentPage(0);
                        }}
                        className={`max-w-full break-words rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs ${
                          isSelected
                            ? 'border-slate-800 bg-slate-800 text-white shadow-xs'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        @{institution}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 공고 목록 및 검색 필터 바 */}
          <section aria-label="관심 공고 목록" className="space-y-3">
            {/* 필터 툴바 */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                {/* 검색 입력 */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    aria-label="공고명·기관 검색"
                    placeholder="공고명·기관 검색"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* 공고 종류 셀렉트 */}
                <Select
                  size="sm"
                  aria-label="공고 종류"
                  value={selectedKind}
                  onChange={(e) =>
                    handleFilterChange({
                      kind: e.target.value as NoticeKind,
                      business: selectedBusiness,
                      unread: isUnreadOnly,
                    })
                  }
                >
                  <option value="ALL">전체 공고</option>
                  <option value="BID">입찰공고</option>
                  <option value="SPEC">사전규격</option>
                </Select>

                {/* 업무 구분 셀렉트 */}
                <Select
                  size="sm"
                  aria-label="업무 구분"
                  value={selectedBusiness}
                  onChange={(e) =>
                    handleFilterChange({
                      kind: selectedKind,
                      business: e.target.value as BusinessType,
                      unread: isUnreadOnly,
                    })
                  }
                >
                  {Object.entries(businessLabels).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </Select>

                {/* 미읽음 전용 체크박스 */}
                <label className="h-9 inline-flex items-center gap-2 cursor-pointer select-none rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    aria-label="미읽음만"
                    checked={isUnreadOnly}
                    onChange={(e) =>
                      handleFilterChange({
                        kind: selectedKind,
                        business: selectedBusiness,
                        unread: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>미읽음만</span>
                </label>
              </div>

              {/* 총 건수 상태 표시 */}
              <p role="status" className="text-xs font-semibold text-slate-500 tabular-nums">
                {isLoading ? '공고 확인 중…' : `총 ${totalCount}건`}
              </p>
            </div>

            {/* 공고 테이블 카드 */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <div className="max-h-[calc(100dvh-22rem)] min-h-60 overflow-auto">
                <Table aria-label="관심 공고 목록" className="min-w-[1200px] table-fixed">
                  <colgroup>
                    <col className="w-24" />
                    <col className="min-w-[340px]" />
                    <col className="w-56" />
                    <col className="w-48" />
                    <col className="w-48" />
                    <col className="w-44" />
                  </colgroup>
                  <TableHead className="sticky top-0 z-10 backdrop-blur-xs">
                    <tr>
                      {['구분', '사업명', '기관', '등록일', '마감일', '사업금액'].map((label) => (
                        <TableHeaderCell
                          key={label}
                          align={label === '사업금액' ? 'right' : 'left'}
                          className={label === '구분' ? 'px-4' : 'px-6'}
                        >
                          {label}
                        </TableHeaderCell>
                      ))}
                    </tr>
                  </TableHead>
                  <TableBody>
                    {alerts.length === 0 && !isLoading && (
                      <TableEmpty colSpan={6} message="조건에 맞는 공고 알림이 없습니다." />
                    )}
                    {alerts.map((item) => {
                      const isBid = item.notice.kind === 'BID';
                      const isUnread = !item.read_on;
                      const sourceLink = procurementSourceUrl(item.notice.source_url);

                      return (
                        <TableRow
                          key={item.id}
                          className={isUnread ? 'bg-indigo-50/20 font-medium' : ''}
                        >
                          {/* 구분 */}
                          <TableCell className="px-4">
                            <span
                              className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold border ${
                                isBid
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {isBid ? '입찰공고' : '사전규격'}
                            </span>
                          </TableCell>

                          {/* 사업명 (원문 링크 포함) */}
                          <TableCell className="px-6">
                            {sourceLink ? (
                              <a
                                href={sourceLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${item.notice.title} 원문 보기`}
                                title={
                                  item.notice.source_url === 'https://www.g2b.go.kr/'
                                    ? `공고번호 ${item.notice.external_id} · 나라장터에서 검색`
                                    : `${item.notice.title} (새창 열기)`
                                }
                                onClick={() => void handleMarkAsRead(item)}
                                className="line-clamp-2 font-semibold text-slate-900 hover:text-indigo-600 hover:underline break-words inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-indigo-600"
                              >
                                <span>{item.notice.title}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 inline" />
                              </a>
                            ) : (
                              <span
                                title={item.notice.title}
                                className="line-clamp-2 font-semibold text-slate-900 break-words"
                              >
                                {item.notice.title}
                              </span>
                            )}
                          </TableCell>

                          {/* 기관 */}
                          <TableCell className="px-6 text-slate-600">
                            <span
                              className="block truncate"
                              title={item.notice.demand_agency || item.notice.agency}
                            >
                              {item.notice.demand_agency || item.notice.agency || '—'}
                            </span>
                          </TableCell>

                          {/* 등록일 */}
                          <TableCell className="px-6 whitespace-nowrap tabular-nums text-slate-500">
                            {procurementDate(item.notice.published_at)}
                          </TableCell>

                          {/* 마감일 */}
                          <TableCell className="px-6 whitespace-nowrap tabular-nums text-slate-600 font-medium">
                            {procurementDate(item.notice.deadline)}
                          </TableCell>

                          {/* 사업금액 */}
                          <TableCell align="right" className="px-6 whitespace-nowrap tabular-nums font-bold text-slate-800">
                            {procurementAmount(item.notice.budget)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 페이지네이션 바 */}
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                <span className="text-xs text-slate-500">
                  페이지당 {PAGE_SIZE}건 · 전체 {totalCount}건
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={currentPage === 0 || isLoading}
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  >
                    이전
                  </Button>

                  <span className="px-2 text-xs font-semibold tabular-nums text-slate-700">
                    {currentPage + 1} / {totalPages}
                  </span>

                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={(currentPage + 1) * PAGE_SIZE >= totalCount || isLoading}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 3. 관심 키워드 설정 탭 */}
      {activeTab === 'rules' && (
        <section aria-label="등록된 관심조건" className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              💡 키워드와 기관은 쉼표(,)나 줄바꿈으로 구분하여 입력합니다. 각 목록은 하나라도 일치하면 자동 알림이 발송되며, 제외 키워드가 포함된 공고는 우선적으로 제외됩니다.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setEditingRule(null);
                setRuleFormData({ ...INITIAL_RULE_FORM });
              }}
              icon={<Plus className="w-4 h-4" />}
              className="shrink-0"
            >
              관심조건 등록
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <Table aria-label="등록된 관심조건 관리 목록" className="min-w-[1080px] table-fixed">
                <colgroup>
                  <col className="w-44" />
                  <col />
                  <col />
                  <col className="w-40" />
                  <col className="w-36" />
                  <col className="w-28" />
                  <col className="w-24" />
                  <col className="w-28" />
                </colgroup>
                <TableHead>
                  <tr>
                    {['조건명', '관심 키워드', '관심기관', '제외 키워드', '공고·업무', '일치 방식', '사용', '관리'].map(
                      (label) => (
                        <TableHeaderCell key={label}>
                          {label}
                        </TableHeaderCell>
                      )
                    )}
                  </tr>
                </TableHead>
                <TableBody>
                  {rules.length === 0 && (
                    <TableEmpty
                      colSpan={8}
                      message="등록된 관심조건이 없습니다. 우측 상단의 '관심조건 등록' 버튼을 눌러 관심 키워드나 기관을 등록해 주세요."
                    />
                  )}
                  {rules.map((rule) => {
                    const parsedKeywords = procurementTerms([rule.keywords]).join(', ');
                    const parsedInstitutions = procurementTerms([rule.institutions]).join(', ');
                    const parsedExcluded = procurementTerms([rule.excluded_keywords]).join(', ');

                    return (
                      <TableRow key={rule.id}>
                        {/* 조건명 */}
                        <TableCell className="align-top break-words">
                          <h2 className="font-bold text-slate-900 leading-snug">{rule.name}</h2>
                        </TableCell>

                        {/* 관심 키워드 */}
                        <TableCell className="align-top break-words text-slate-700 font-medium">
                          {parsedKeywords || '—'}
                        </TableCell>

                        {/* 관심기관 */}
                        <TableCell className="align-top break-words text-slate-600">
                          {parsedInstitutions || '전체 기관'}
                        </TableCell>

                        {/* 제외 키워드 */}
                        <TableCell className="align-top break-words text-slate-400">
                          {parsedExcluded || '—'}
                        </TableCell>

                        {/* 공고·업무 구분 */}
                        <TableCell className="align-top text-slate-700">
                          <div className="font-semibold text-slate-900">
                            {rule.notice_kind === 'ALL'
                              ? '사전규격·입찰공고'
                              : rule.notice_kind === 'BID'
                              ? '입찰공고'
                              : '사전규격'}
                          </div>
                          <div className="text-slate-500 text-xs">
                            {businessLabels[rule.business_type]}
                          </div>
                        </TableCell>

                        {/* 일치 방식 */}
                        <TableCell className="align-top text-slate-600">
                          <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {rule.match_mode === 'AND' ? '모두 일치' : '하나라도 일치'}
                          </span>
                        </TableCell>

                        {/* 사용 여부 */}
                        <TableCell className="align-top">
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${
                              rule.enabled ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            {rule.enabled ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>사용</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                <span>중지</span>
                              </>
                            )}
                          </span>
                        </TableCell>

                        {/* 관리 버튼 */}
                        <TableCell className="align-top">
                          <div className="flex items-center gap-1">
                            <Button
                              size="xs"
                              variant="ghost"
                              aria-label={`${rule.name} 수정`}
                              onClick={() => {
                                setEditingRule(rule);
                                setRuleFormData({ ...rule });
                              }}
                            >
                              수정
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              aria-label={`${rule.name} 삭제`}
                              onClick={() => void handleDeleteRule(rule)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              삭제
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      )}

      {/* 4. 관심조건 등록/수정 모달 */}
      <Modal
        isOpen={editingRule !== undefined}
        onClose={() => !isSaving && setEditingRule(undefined)}
        title={editingRule ? '관심조건 수정' : '관심조건 등록'}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={isSaving}
              onClick={() => setEditingRule(undefined)}
            >
              취소
            </Button>
            <Button
              type="submit"
              form="procurement-rule-form"
              loading={isSaving}
            >
              저장
            </Button>
          </>
        }
      >
        <form id="procurement-rule-form" onSubmit={handleSaveRule} className="space-y-4">
          {/* 조건 이름 */}
          <div className="space-y-1.5">
            <label htmlFor="rule-name-input" className="block text-xs font-bold text-slate-700">
              조건 이름 <span className="text-rose-500">*</span>
            </label>
            <input
              id="rule-name-input"
              aria-label="조건 이름"
              required
              maxLength={100}
              value={ruleFormData.name}
              onChange={(e) => updateFormField('name', e.target.value)}
              placeholder="예: 공간정보 용역"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-2xs"
            />
          </div>

          {/* 키워드 & 기관 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="rule-keywords-input" className="block text-xs font-bold text-slate-700">
                관심 키워드
              </label>
              <textarea
                id="rule-keywords-input"
                aria-label="관심 키워드"
                rows={3}
                maxLength={3000}
                value={ruleFormData.keywords}
                onChange={(e) => updateFormField('keywords', e.target.value)}
                placeholder="공간정보, GIS, 측량"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-2xs resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rule-institutions-input" className="block text-xs font-bold text-slate-700">
                관심기관
              </label>
              <textarea
                id="rule-institutions-input"
                aria-label="관심기관"
                rows={3}
                maxLength={3000}
                value={ruleFormData.institutions}
                onChange={(e) => updateFormField('institutions', e.target.value)}
                placeholder="기관명 또는 기관코드, 쉼표로 구분"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-2xs resize-none"
              />
            </div>
          </div>

          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 leading-relaxed border border-slate-200/70">
            ℹ️ 키워드는 공고명(사전규격은 품명·사업명)에서 검색합니다. 기관은 공고·발주기관 또는 수요기관명에 포함되는지 확인하며, 제공되는 기관코드도 사용할 수 있습니다. 첨부파일 본문은 검색하지 않습니다.
          </p>

          {/* 제외 키워드 */}
          <div className="space-y-1.5">
            <label htmlFor="rule-excluded-input" className="block text-xs font-bold text-slate-700">
              제외 키워드
            </label>
            <textarea
              id="rule-excluded-input"
              aria-label="제외 키워드"
              rows={2}
              maxLength={3000}
              value={ruleFormData.excluded_keywords}
              onChange={(e) => updateFormField('excluded_keywords', e.target.value)}
              placeholder="예: 단순구매, 소모품"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition shadow-2xs resize-none"
            />
          </div>

          {/* 옵션 선택 그리드 (일치방식, 공고범위, 업무구분) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="rule-match-mode-select" className="block text-xs font-bold text-slate-700">
                일치 방식
              </label>
              <select
                id="rule-match-mode-select"
                aria-label="일치 방식"
                value={ruleFormData.match_mode}
                onChange={(e) => updateFormField('match_mode', e.target.value as 'AND' | 'OR')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
              >
                <option value="AND">기관과 키워드 모두</option>
                <option value="OR">기관 또는 키워드</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rule-notice-kind-select" className="block text-xs font-bold text-slate-700">
                공고 범위
              </label>
              <select
                id="rule-notice-kind-select"
                aria-label="공고 범위"
                value={ruleFormData.notice_kind}
                onChange={(e) => updateFormField('notice_kind', e.target.value as NoticeKind)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
              >
                <option value="ALL">사전규격·입찰공고</option>
                <option value="BID">입찰공고</option>
                <option value="SPEC">사전규격</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rule-business-type-select" className="block text-xs font-bold text-slate-700">
                업무 구분
              </label>
              <select
                id="rule-business-type-select"
                aria-label="업무 구분"
                value={ruleFormData.business_type}
                onChange={(e) => updateFormField('business_type', e.target.value as BusinessType)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
              >
                {Object.entries(businessLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 자동 알림 체크박스 */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={ruleFormData.enabled}
                onChange={(e) => updateFormField('enabled', e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span>자동 알림 사용</span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
