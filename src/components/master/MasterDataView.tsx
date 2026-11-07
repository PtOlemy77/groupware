'use client';
import { readMaster, saveMaster, apiFetch } from '@/lib/api';
import { useModal } from '@/contexts/ModalContext';

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import {
  AuthUser,
  CommonCode,
  STANDARD_UNIT_PRICES,
  formatCurrencyManwon,
} from '@/types/groupware';
import {
  Database,
  Calendar,
  Save,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Layers,
  Sparkles,
  RefreshCw,
  Tag,
  DollarSign,
  Search,
  Filter,
} from 'lucide-react';
import {
  Button,
  TabGroup,
  PageHeaderBar,
  Modal,
  SearchInput,
} from '@/components/common';

function AutoSizeTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    const resize = () => {
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
    };
    resize();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return;
      width = field.clientWidth;
      resize();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={ref} />;
}

interface Props {
  currentUser: AuthUser;
  commonCodes: CommonCode[];
  onRefresh: () => Promise<void>;
}

// 연도별 SW 노임단가 항목 모델
export interface YearlyUnitPriceItem {
  id: string;
  position: string;
  grade: '특급' | '고급' | '중급' | '초급';
  dailyPrice: number; // 원/일 (예: 755,980원)
  monthlyPrice: number; // 천원/월 (월 20.9일 기준 또는 공표 월단가, 예: 15,800천원)
}

// 연도별 사업 목표매출 모델
export interface YearlyTargetRevenueItem {
  year: number;
  targetAmount: number; // 만원 단위 (예: 250,000만원 = 25.0억원)
  note?: string;
}

// 연도별 기본 사업 목표매출
export const DEFAULT_TARGET_REVENUES: Record<number, YearlyTargetRevenueItem> = {};

export const STORAGE_KEY_TARGET_REVENUES = 'spatialt_master_target_revenues';

// 연도별 기본 노임단가 데이터셋 (2025, 2026, 2027, 2028)
const DEFAULT_YEARLY_PRICES: Record<number, YearlyUnitPriceItem[]> = {
  [new Date().getFullYear()]: ['이사','부장','차장','과장','대리','담당'].map((position, i) => ({ id: `price-${i}`, position, grade: (i < 2 ? '특급' : i < 4 ? '고급' : i === 4 ? '중급' : '초급') as YearlyUnitPriceItem['grade'], dailyPrice: 0, monthlyPrice: 0 }))
};

const STORAGE_KEY_UNIT_PRICES = 'spatialt_master_unit_prices';

export default function MasterDataView({
  currentUser,
  commonCodes = [],
  onRefresh,
}: Props) {
  const { showAlert, showConfirm } = useModal();
  // 서브탭: 'target_revenue' (연도별 사업 목표매출) | 'unit_prices' (노임단가 관리) | 'common_codes' (공통코드 관리)
  const [subTab, setSubTab] = useState<'target_revenue' | 'unit_prices' | 'common_codes'>('target_revenue');

  // 1. 목표매출 상태
  const [targetRevenues, setTargetRevenues] = useState<Record<number, YearlyTargetRevenueItem>>(() => {
    try {
      const saved = readMaster(STORAGE_KEY_TARGET_REVENUES);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_TARGET_REVENUES;
  });
  const [savingRevenues, setSavingRevenues] = useState(false);
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');
  const [newAmountInput, setNewAmountInput] = useState('');
  const [newNoteInput, setNewNoteInput] = useState('');

  // 2. 노임단가 상태
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yearlyPrices, setYearlyPrices] = useState<Record<number, YearlyUnitPriceItem[]>>(() => {
    try {
      const saved = readMaster(STORAGE_KEY_UNIT_PRICES);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_YEARLY_PRICES;
  });

  const [savingPrices, setSavingPrices] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // DB에서 commonCodes가 로드되거나 갱신될 때 실시간 동기화
  useEffect(() => {
    // 1. 목표매출 동기화
    const targetRow = commonCodes.find(
      (c) => c.group_code === 'MASTER_TARGETS' && c.code === 'DATA'
    );
    const targetSaved = targetRow?.extra_value || readMaster(STORAGE_KEY_TARGET_REVENUES);
    if (targetSaved) {
      try {
        const parsed = typeof targetSaved === 'string' ? JSON.parse(targetSaved) : targetSaved;
        if (parsed && typeof parsed === 'object') {
          setTargetRevenues(parsed);
        }
      } catch (e) {}
    }

    // 2. 노임단가 동기화
    const priceRow = commonCodes.find(
      (c) => c.group_code === 'MASTER_PRICES' && c.code === 'DATA'
    );
    const priceSaved = priceRow?.extra_value || readMaster(STORAGE_KEY_UNIT_PRICES);
    if (priceSaved) {
      try {
        const parsed = typeof priceSaved === 'string' ? JSON.parse(priceSaved) : priceSaved;
        if (parsed && typeof parsed === 'object') {
          setYearlyPrices(parsed);
        }
      } catch (e) {}
    }
  }, [commonCodes]);

  // 현재 연도의 단가 목록
  const currentPrices = useMemo(() => {
    return yearlyPrices[selectedYear] || DEFAULT_YEARLY_PRICES[new Date().getFullYear()] || [];
  }, [yearlyPrices, selectedYear]);

  // 특정 연도의 단가 변경 (월단가 또는 일단가)
  const handlePriceChange = (id: string, field: 'monthlyPrice' | 'dailyPrice', val: any) => {
    setYearlyPrices((prev) => {
      const list = prev[selectedYear] ? [...prev[selectedYear]] : [...DEFAULT_YEARLY_PRICES[new Date().getFullYear()]];
      const updated = list.map((it) => {
        if (it.id === id) {
          if (field === 'monthlyPrice') {
            const m = Number(val) || 0;
            // 월 20.9일 기준 1일 단가 자동 계산 (천원 -> 원 변환 후 나눔)
            const d = Math.round((m * 1000) / 20.9);
            return { ...it, monthlyPrice: m, dailyPrice: d };
          }
          if (field === 'dailyPrice') {
            const d = Number(val) || 0;
            const m = Math.round((d * 20.9) / 1000);
            return { ...it, dailyPrice: d, monthlyPrice: m };
          }
        }
        return it;
      });
      return { ...prev, [selectedYear]: updated };
    });
  };

  // 단가 저장
  const handleSavePrices = async () => {
    try {
      setSavingPrices(true);
      await saveMaster(STORAGE_KEY_UNIT_PRICES, yearlyPrices);
      await onRefresh?.();
      setSaveMessage(`${selectedYear}년도 SW 기술자 노임단가 기준정보가 저장되었습니다.`);
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (e) {
      console.error(e);
      await showAlert('노임단가 저장에 실패했습니다.', { type: 'error' });
    } finally {
      setSavingPrices(false);
    }
  };

  // 목표매출 항목 변경
  const handleTargetRevenueChange = (year: number, field: 'targetAmount' | 'note', val: any) => {
    setTargetRevenues((prev) => {
      const current = prev[year] || { year, targetAmount: 0, note: '' };
      return {
        ...prev,
        [year]: {
          ...current,
          [field]: field === 'targetAmount' ? Number(val) || 0 : val,
        },
      };
    });
  };

  // 목표매출 저장
  const handleSaveTargetRevenues = async () => {
    try {
      setSavingRevenues(true);
      await saveMaster(STORAGE_KEY_TARGET_REVENUES, targetRevenues);
      await onRefresh?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('target-revenues-updated'));
        window.dispatchEvent(new Event('master-data-updated'));
      }
      setSaveMessage('연도별 사업 목표매출이 성공적으로 저장되었습니다. (대시보드 실시간 반영)');
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (e) {
      console.error(e);
      await showAlert('목표매출 저장에 실패했습니다.', { type: 'error' });
    } finally {
      setSavingRevenues(false);
    }
  };

  // 신규 연도 목표매출 추가
  const handleAddYearRevenue = (e: React.FormEvent) => {
    e.preventDefault();
    const yr = Number(newYearInput);
    const amt = Number(newAmountInput) || 0;
    if (!yr || yr < 2020 || yr > 2040) {
      showAlert('유효한 연도를 입력해주세요 (예: 2029)', { type: 'warning' });
      return;
    }
    setTargetRevenues((prev) => ({
      ...prev,
      [yr]: {
        year: yr,
        targetAmount: amt,
        note: newNoteInput || `${yr}년도 전사 사업목표`,
      },
    }));
    setShowAddYearModal(false);
    setNewYearInput('');
    setNewAmountInput('');
    setNewNoteInput('');
  };

  // 연도 목표매출 삭제
  const handleDeleteYearRevenue = async (year: number) => {
    const ok = await showConfirm(`${year}년도 사업 목표매출 데이터를 삭제하시겠습니까?`, {
      isDanger: true,
      confirmText: '삭제',
    });
    if (!ok) return;
    setTargetRevenues((prev) => {
      const next = { ...prev };
      delete next[year];
      return next;
    });
  };

  // 신규 연도 추가
  const handleAddYear = () => {
    const years = Object.keys(yearlyPrices).map(Number).sort((a, b) => b - a);
    const nextYear = (years[0] || new Date().getFullYear()) + 1;
    const baseList = yearlyPrices[years[0]] || DEFAULT_YEARLY_PRICES[new Date().getFullYear()];
    // 전년도 대비 약 4.5% 인상된 기본값 생성
    const newList: YearlyUnitPriceItem[] = baseList.map((it) => {
      const newM = Math.round(it.monthlyPrice * 1.045);
      const newD = Math.round((newM * 1000) / 20.9);
      return {
        ...it,
        id: `${nextYear}-${it.position}`,
        monthlyPrice: newM,
        dailyPrice: newD,
      };
    });

    setYearlyPrices((prev) => ({
      ...prev,
      [nextYear]: newList,
    }));
    setSelectedYear(nextYear);
    setSaveMessage(`${nextYear}년도 노임단가 기준이 신규 생성되었습니다. (전년 대비 4.5% 인상 적용)`);
    setTimeout(() => setSaveMessage(''), 4000);
  };

  // 2. 공통 코드 상태
  const [codeGroupFilter, setCodeGroupFilter] = useState<string>('전체');
  const [codeSearch, setCodeSearch] = useState<string>('');
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
  const [editingCode, setEditingCode] = useState<CommonCode | null>(null);
  const [codeForm, setCodeForm] = useState<Partial<CommonCode>>({});

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    commonCodes.forEach((c) => set.add(c.group_code));
    return Array.from(set);
  }, [commonCodes]);

  const filteredCodes = useMemo(() => {
    return commonCodes.filter((c) => {
      const matchGroup = codeGroupFilter === '전체' || c.group_code === codeGroupFilter;
      const q = codeSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.group_code.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.code_name.toLowerCase().includes(q) ||
        c.group_name.toLowerCase().includes(q) ||
        (c.extra_value && c.extra_value.toLowerCase().includes(q));
      return matchGroup && matchSearch;
    });
  }, [commonCodes, codeGroupFilter, codeSearch]);

  const handleOpenCodeModal = (codeItem?: CommonCode) => {
    if (codeItem) {
      setEditingCode(codeItem);
      setCodeForm(codeItem);
    } else {
      setEditingCode(null);
      setCodeForm({
        group_code: codeGroupFilter !== '전체' ? codeGroupFilter : 'DEPARTMENT',
        group_name: codeGroupFilter !== '전체' ? codeGroupFilter : '부서',
        code: '',
        code_name: '',
        sort_order: 10,
        is_active: true,
        extra_value: '',
      });
    }
    setCodeModalOpen(true);
  };

  const handleSaveCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'common_codes',
        action: editingCode ? 'update' : 'create',
        id: editingCode?.id,
        data: codeForm,
      }),
    });
    setCodeModalOpen(false);
    await onRefresh();
  };

  const handleDeleteCode = async (id: number) => {
    const ok = await showConfirm('정말 이 공통코드를 삭제하시겠습니까?', {
      isDanger: true,
      confirmText: '삭제',
    });
    if (!ok) return;
    await apiFetch('/api/groupware', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'common_codes',
        action: 'delete',
        id,
      }),
    });
    await onRefresh();
    await showAlert('공통코드가 삭제되었습니다.', { type: 'success' });
  };

  return (
    <div data-editor data-testid="master-data-view" className="min-w-0 space-y-4">
      {/* 1. 공통 상단 서브탭 전환 바 */}
      <PageHeaderBar
        left={
          <TabGroup
            items={[
              {
                key: 'target_revenue',
                label: '연도별 사업 목표매출',
                icon: <TrendingUp className="w-4 h-4" />,
              },
              {
                key: 'unit_prices',
                label: '연도별 SW 노임단가',
                icon: <DollarSign className="w-4 h-4" />,
              },
              {
                key: 'common_codes',
                label: `공통 코드 관리`,
                count: commonCodes.length,
                icon: <Database className="w-4 h-4" />,
              },
            ]}
            activeKey={subTab}
            onChange={(key) => setSubTab(key as any)}
            variant="segmented"
            size="md"
          />
        }
      />

      {saveMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* 2. 서브탭 1: 연도별 사업 목표매출 관리 (target_revenue) */}
      {subTab === 'target_revenue' && (
        <div className="min-w-0 space-y-4">
          <div className="min-w-0 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5 flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <span>연도별 전사 사업 목표매출 설정</span>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  연도별 전사 수주/매출 목표치를 <strong>만원 단위</strong>로 등록·수정합니다. 여기서 설정된 금액은 <strong>통합 대시보드</strong>의 연간 목표 매출액 및 수주 달성률에 즉시 반영됩니다.
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowAddYearModal(true)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>기준연도 추가</span>
                </button>
                <button
                  onClick={handleSaveTargetRevenues}
                  disabled={savingRevenues}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingRevenues ? '저장중...' : '목표매출 저장'}</span>
                </button>
              </div>
            </div>

            {/* 목표매출 테이블 */}
            <div role="region" aria-label="목표매출 표 가로 스크롤" tabIndex={0} className="max-w-full overflow-x-auto">
              <table aria-label="연도별 목표매출" className="w-full min-w-[1040px] table-fixed text-left text-sm text-slate-700">
                <colgroup><col className="w-32"/><col className="w-56"/><col className="w-36"/><col className="w-[136px]"/><col/><col className="w-[72px]"/></colgroup>
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-28">기준 연도</th>
                    <th className="py-3 px-4 w-60">연간 목표매출액 (만원 단위 입력)</th>
                    <th className="py-3 px-4 w-36">환산 금액 (억원)</th>
                    <th className="py-3 px-4 w-32">전년 대비 목표</th>
                    <th className="py-3 px-4">중점 추진 전략 및 비고</th>
                    <th className="py-3 px-4 text-center w-16">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.keys(targetRevenues)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((yr, idx, arr) => {
                      const item = targetRevenues[yr];
                      const prevYear = arr[idx - 1];
                      const prevAmount = prevYear ? targetRevenues[prevYear]?.targetAmount || 0 : 0;
                      const growthRate =
                        prevAmount > 0
                          ? Number((((item.targetAmount - prevAmount) / prevAmount) * 100).toFixed(1))
                          : null;

                      const isCurrentYear = yr === new Date().getFullYear();

                      return (
                        <tr
                          key={yr}
                          className={`hover:bg-slate-50/80 transition ${
                            isCurrentYear ? 'bg-indigo-50/30 font-medium' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-extrabold text-slate-900 text-sm">
                                {yr}년
                              </span>
                              {isCurrentYear && (
                                <span className="whitespace-nowrap px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                  당해연도
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <input
                                type="number"
                                step="1000"
                                value={item.targetAmount}
                                onChange={(e) =>
                                  handleTargetRevenueChange(yr, 'targetAmount', e.target.value)
                                }
                                aria-label={`${yr}년도 목표매출액`}
                                className="w-40 shrink-0 text-right font-extrabold text-sm font-mono text-indigo-700 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                              />
                              <span className="shrink-0 whitespace-nowrap text-xs text-slate-500 font-medium">만원</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800 text-sm">
                            <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {(item.targetAmount / 10000).toFixed(1)} 억원
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {growthRate !== null ? (
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  growthRate >= 0
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                                }`}
                              >
                                {growthRate >= 0 ? `▲ +${growthRate}%` : `▼ ${growthRate}%`}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <AutoSizeTextarea
                              rows={2}
                              aria-label={`${yr}년도 목표매출 비고`}
                              value={item.note || ''}
                              placeholder="전략 방향 및 비고 메모..."
                              onChange={(e) =>
                                handleTargetRevenueChange(yr, 'note', e.target.value)
                              }
                              className="w-full min-w-0 resize-y text-sm leading-relaxed text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:border-indigo-500 bg-white"
                            />
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleDeleteYearRevenue(yr)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title={`${yr}년도 목표 삭제`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs leading-relaxed text-slate-500 mt-4 rounded-xl">
              <span>* 입력 단위는 <strong>만원</strong>이며, 예: 250,000만원 = 25.0억원으로 자동 계산됩니다.</span>
              <button
                onClick={handleSaveTargetRevenues}
                className="shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-2xs"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 서브탭 2: 연도별 SW 노임단가 관리 */}
      {subTab === 'unit_prices' && (
        <div className="min-w-0 space-y-4">
          {/* 상단 툴바: 연도 선택 탭 & 액션 버튼 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-indigo-600" />
                적용 기준연도:
              </span>
              {Object.keys(yearlyPrices)
                .map(Number)
                .sort()
                .map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYear(yr)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                      selectedYear === yr
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {yr}년도 기준
                  </button>
                ))}

              <button
                onClick={handleAddYear}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                title="차기 연도 단가 기준 신규 생성"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>차기 연도 추가</span>
              </button>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button
                onClick={handleSavePrices}
                disabled={savingPrices}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
              >
                <Save className="w-4 h-4" />
                <span>{selectedYear}년도 단가표 저장</span>
              </button>
            </div>
          </div>

          {/* 한국소프트웨어산업협회 기준 안내 카드 */}
          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                한국소프트웨어산업협회(KOSA) SW기술자 평균임금 연동 안내
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                본 단가표는 소프트웨어 진흥법 제46조에 따라 매년 공표되는 SW기술자 일평균 임금 및 월 기준단가(월 20.9일 기준)입니다.
                계약품의서의 <strong>투입인력 인건비</strong> 계산 시 해당 연도의 직급별 월단가가 자동으로 적용되며, 본 메뉴에서 필요에 따라 단가를 조정하거나 신규 연도 단가를 선반영할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 노임단가 테이블 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 flex min-w-0 flex-wrap items-center gap-2">
                <span>{selectedYear}년도 직급별 SW기술자 노임단가 기준표</span>
                <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  (단위: 천원 / 월)
                </span>
              </h3>
              <span className="text-xs text-slate-400">
                수정 시 실시간으로 1일 단가(월 20.9일 기준)가 자동 계산됩니다.
              </span>
            </div>

            <div role="region" aria-label="노임단가 표 가로 스크롤" tabIndex={0} className="max-w-full overflow-x-auto">
              <table aria-label="연도별 노임단가" className="w-full min-w-[720px] table-fixed text-left text-sm text-slate-700">
                <colgroup><col className="w-40"/><col className="w-40"/><col className="w-60"/><col className="w-40"/></colgroup>
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">사내 직급</th>
                    <th className="py-3 px-4">기술 등급</th>
                    <th className="py-3 px-4 text-right">월 기준 노임단가 (천원)</th>
                    <th className="py-3 px-4 text-right">일 노임단가 (원/일)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentPrices.map((item) => {
                    const gradeBadge =
                      item.grade === '특급'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : item.grade === '고급'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : item.grade === '중급'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : 'bg-slate-100 text-slate-800 border-slate-200';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                          {item.position}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${gradeBadge}`}>
                            {item.grade}기술자
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              step="50"
                              value={item.monthlyPrice}
                              onChange={(e) =>
                                handlePriceChange(item.id, 'monthlyPrice', e.target.value)
                              }
                              aria-label={`${selectedYear}년도 ${item.position} 월 노임단가`}
                              className="w-36 text-right font-extrabold text-sm font-mono text-indigo-700 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="shrink-0 whitespace-nowrap text-xs text-slate-500 font-medium">천원</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 text-xs">
                          {item.dailyPrice.toLocaleString()}원
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs leading-relaxed text-slate-500">
              <span>* 월 기준 근무일수는 조달청 및 엔지니어링 표준 기준인 20.9일로 적용됩니다.</span>
              <button
                onClick={handleSavePrices}
                className="shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-2xs"
              >
                변경사항 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 서브탭 2: 사내 공통 코드 관리 (common_codes) */}
      {subTab === 'common_codes' && (
        <div className="min-w-0 space-y-4">
          {/* 그룹 필터 & 검색바 */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="코드, 코드명, 그룹명 검색..."
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  className="w-full min-w-0 pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* 코드 그룹 필터 */}
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setCodeGroupFilter('전체')}
                  className={`max-w-full break-all px-2.5 py-1.5 text-left leading-relaxed rounded-md font-semibold transition ${
                    codeGroupFilter === '전체'
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  전체 그룹
                </button>
                {availableGroups.map((grp) => (
                  <button
                    key={grp}
                    onClick={() => setCodeGroupFilter(grp)}
                    className={`max-w-full break-all px-2.5 py-1.5 text-left leading-relaxed rounded-md font-semibold transition ${
                      codeGroupFilter === grp
                        ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {grp}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenCodeModal()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" /> 신규 코드 추가
            </button>
          </div>

          {/* 공통 코드 테이블 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div role="region" aria-label="공통코드 표 가로 스크롤" tabIndex={0} className="max-w-full overflow-x-auto">
              <table aria-label="공통코드 목록" className="w-full min-w-[1040px] table-fixed text-left text-sm text-slate-700">
                <colgroup><col className="w-[140px]"/><col className="w-32"/><col className="w-32"/><col className="w-52"/><col className="w-20"/><col className="w-[88px]"/><col/><col className="w-24"/></colgroup>
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">그룹 코드</th>
                    <th className="py-3 px-4">그룹명</th>
                    <th className="py-3 px-4">코드 값</th>
                    <th className="py-3 px-4">코드 명칭 (화면 표시)</th>
                    <th className="py-3 px-4 text-center">정렬 순서</th>
                    <th className="py-3 px-4 text-center">사용 여부</th>
                    <th className="py-3 px-4">부가 정보 / 설명</th>
                    <th className="sticky right-0 bg-slate-50 py-3 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 [&_td]:align-top">
                  {filteredCodes.map((c) => (
                    <React.Fragment key={c.id}>
                    <tr className="hover:bg-slate-50/80 transition">
                      <td className="break-all py-3 px-4 font-mono font-semibold leading-relaxed text-slate-900">
                        {c.group_code}
                      </td>
                      <td className="break-words py-3 px-4 font-semibold leading-relaxed text-slate-700">
                        {c.group_name}
                      </td>
                      <td className="break-all py-3 px-4 font-mono font-semibold leading-relaxed text-indigo-600">
                        {c.code}
                      </td>
                      <td className="break-words py-3 px-4 font-semibold leading-relaxed text-slate-900">
                        {c.code_name}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600">
                        {c.sort_order}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            c.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {c.is_active ? '사용' : '미사용'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {c.extra_value && c.extra_value.length > 160 ? <button type="button" aria-expanded={expandedDescriptions.has(c.id)} aria-controls={`code-description-${c.id}`} onClick={() => setExpandedDescriptions(previous => { const next = new Set(previous); next.has(c.id) ? next.delete(c.id) : next.add(c.id); return next; })} className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">부가 정보 {expandedDescriptions.has(c.id) ? '접기' : '펼치기'}</button> : <span className="whitespace-pre-wrap break-words text-sm leading-relaxed">{c.extra_value || '-'}</span>}
                      </td>
                      <td className="sticky right-0 bg-white py-3 px-4 text-right shadow-[-3px_0_6px_-4px_#94a3b8]">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenCodeModal(c)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100"
                            title="수정"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCode(c.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCodes.filter(c => c.extra_value && c.extra_value.length > 160 && expandedDescriptions.has(c.id)).map(c => <div key={c.id} className="min-w-0 border-t border-slate-200 bg-slate-50 p-4"><h4 className="mb-2 break-words text-sm font-semibold text-slate-800">{c.code_name}</h4><div id={`code-description-${c.id}`} className="whitespace-pre-wrap break-all text-sm leading-relaxed text-slate-600">{c.extra_value}</div></div>)}
          </div>
        </div>
      )}

      {/* 4. 코드 등록/수정 모달 (공통 Modal) */}
      <Modal
        isOpen={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        title={editingCode ? '공통 코드 수정' : '신규 공통 코드 등록'}
        description="시스템 전반에서 사용하는 부서, 직급, 상태 등의 공통 코드를 관리합니다."
        icon={<Database className="w-5 h-5 text-indigo-600" />}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setCodeModalOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form="code-form"
            >
              저장
            </Button>
          </>
        }
      >
        <form id="code-form" onSubmit={handleSaveCode} className="space-y-4 text-sm">
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">그룹 코드</label>
              <input
                type="text"
                required
                placeholder="예: DEPARTMENT"
                value={codeForm.group_code || ''}
                onChange={(e) =>
                  setCodeForm({ ...codeForm, group_code: e.target.value })
                }
                className="w-full min-w-0 p-2.5 rounded-xl border border-slate-300 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">그룹 명칭</label>
              <AutoSizeTextarea
                rows={2}
                required
                placeholder="예: 부서"
                value={codeForm.group_name || ''}
                onChange={(e) =>
                  setCodeForm({ ...codeForm, group_name: e.target.value })
                }
                className="w-full min-w-0 p-2.5 rounded-xl border border-slate-300 font-semibold"
              />
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">코드 값</label>
              <input
                type="text"
                required
                placeholder="예: DEPT_BIZ"
                value={codeForm.code || ''}
                onChange={(e) =>
                  setCodeForm({ ...codeForm, code: e.target.value })
                }
                className="w-full min-w-0 p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-indigo-700"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">코드 명칭 (표시명)</label>
              <AutoSizeTextarea
                rows={2}
                required
                placeholder="예: 사업본부"
                value={codeForm.code_name || ''}
                onChange={(e) =>
                  setCodeForm({ ...codeForm, code_name: e.target.value })
                }
                className="w-full min-w-0 p-2.5 rounded-xl border border-slate-300 font-bold"
              />
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">정렬 순서</label>
              <input
                type="number"
                value={codeForm.sort_order || 0}
                onChange={(e) =>
                  setCodeForm({ ...codeForm, sort_order: Number(e.target.value) })
                }
                className="w-full min-w-0 p-2.5 rounded-xl border border-slate-300 font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">사용 여부</label>
              <select
                value={codeForm.is_active ? 'true' : 'false'}
                onChange={(e) =>
                  setCodeForm({ ...codeForm, is_active: e.target.value === 'true' })
                }
                className="w-full min-w-0 p-2.5 rounded-xl border border-slate-300 font-bold bg-white"
              >
                <option value="true">사용</option>
                <option value="false">미사용</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">부가 정보 / 설명</label>
            <AutoSizeTextarea
              rows={3}
              placeholder="예: 프로젝트 전담 부서"
              value={codeForm.extra_value || ''}
              onChange={(e) =>
                setCodeForm({ ...codeForm, extra_value: e.target.value })
              }
              className="w-full min-w-0 p-2.5 rounded-xl border border-slate-300"
            />
          </div>
        </form>
      </Modal>

      {/* 5. 신규 연도 사업목표 추가 모달 (공통 Modal) */}
      <Modal
        isOpen={showAddYearModal}
        onClose={() => setShowAddYearModal(false)}
        title="신규 연도 사업 목표매출 추가"
        description="전사 사업 계획에 맞춘 신규 연도의 매출 목표액을 설정합니다."
        icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowAddYearModal(false)}
            >
              취소
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form="add-year-form"
            >
              연도 추가
            </Button>
          </>
        }
      >
        <form id="add-year-form" onSubmit={handleAddYearRevenue} className="space-y-4 text-sm">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              기준 연도 (YYYY) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              placeholder="예: 2029"
              value={newYearInput}
              onChange={(e) => setNewYearInput(e.target.value)}
              className="w-full min-w-0 p-2.5 rounded-xl border border-slate-300 font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              연간 목표매출액 (만원 단위) <span className="text-rose-500">*</span>
            </label>
            <div className="flex min-w-0 flex-col items-stretch border border-slate-300 rounded-xl bg-white sm:flex-row">
              <input
                type="number"
                step="1000"
                required
                placeholder="예: 400000 (40억원)"
                value={newAmountInput}
                onChange={(e) => setNewAmountInput(e.target.value)}
                className="min-w-0 w-full flex-1 p-2.5 outline-none font-bold text-indigo-700 text-sm"
              />
              <span className="shrink-0 whitespace-nowrap px-3 py-2.5 bg-slate-100 text-slate-500 font-bold select-none border-l border-slate-200">
                만원 {newAmountInput ? `(${(Number(newAmountInput) / 10000).toFixed(1)}억원)` : ''}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">중점 추진 전략 및 비고</label>
            <input
              type="text"
              placeholder="예: AI 기반 공간정보 플랫폼 민간 시장 진출"
              value={newNoteInput}
              onChange={(e) => setNewNoteInput(e.target.value)}
              className="w-full min-w-0 p-2.5 rounded-xl border border-slate-300"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

