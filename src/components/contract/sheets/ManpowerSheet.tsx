'use client';
import { unitPrice as configuredPrice } from '@/lib/api';

import React, { useState, useRef, useEffect } from 'react';
import {
  ManpowerPlanItem,
  Employee,
  STANDARD_UNIT_PRICES,
  cleanDeptName,
} from '@/types/groupware';
import {
  Plus,
  Trash2,
  Users,
  Search,
  Check,
  RotateCcw,
  User,
  Wand2,
  X,
  ChevronDown,
} from 'lucide-react';

interface Props {
  items: ManpowerPlanItem[];
  onChangeItems: (items: ManpowerPlanItem[]) => void;
  employees?: Employee[];
  readOnly?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface ContractMonthMeta {
  index: number;
  label: string;
  yearMonth: string;
}

export function getContractMonthList(startDate?: string, endDate?: string): ContractMonthMeta[] {
  if (!startDate || !endDate) {
    return Array.from({ length: 8 }, (_, i) => ({
      index: i,
      label: `M${i + 1}`,
      yearMonth: `M${i + 1}`,
    }));
  }

  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) {
    return Array.from({ length: 8 }, (_, i) => ({
      index: i,
      label: `M${i + 1}`,
      yearMonth: `M${i + 1}`,
    }));
  }

  const startYear = s.getFullYear();
  const startMonth = s.getMonth();
  const endYear = e.getFullYear();
  const endMonth = e.getMonth();

  const totalMonths = Math.max(1, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);

  const list: ContractMonthMeta[] = [];
  for (let i = 0; i < totalMonths; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    const ym = `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    list.push({
      index: i,
      label: `M${i + 1}`,
      yearMonth: ym,
    });
  }
  return list;
}

const ROLE_PRESETS = [
  '총괄 PM / 아키텍트',
  'GIS 플랫폼 PL',
  '공간DB 설계/구축',
  'WebGIS 프론트엔드',
  '백엔드 API 개발',
  '품질관리 / DB검수',
  '3D 디지털트윈 모델링',
  '사업관리 / 제안PM',
];

// 한글 초성 리스트
const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

// 한글 문자열에서 초성 추출 함수
function getChosung(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      const chosungIndex = Math.floor(code / (21 * 28));
      result += CHOSUNG_LIST[chosungIndex];
    } else {
      result += text[i];
    }
  }
  return result;
}

// 이름 또는 초성 매칭 함수
function matchNameOrChosung(targetName: string, query: string): boolean {
  if (!query) return true;
  const cleanQ = query.trim().toLowerCase();
  const cleanTarget = targetName.toLowerCase();

  // 1. 일반 문자열 포함 검사
  if (cleanTarget.includes(cleanQ)) return true;

  // 2. 초성 검색 검사
  const targetChosung = getChosung(cleanTarget);
  const queryChosung = getChosung(cleanQ);

  return targetChosung.includes(cleanQ) || targetChosung.includes(queryChosung);
}

function recommendRoleForEmployee(emp: Employee): string {
  if (emp.position === '사장' || emp.position === '이사') return '사업총괄 / 감리대응';
  if (emp.position === '부장') return '총괄 PM / 아키텍트';
  if (emp.department.includes('품질')) return '품질관리 / DB검수';
  if (emp.department.includes('사업')) return '사업관리 / 제안PM';
  if (emp.department.includes('경영')) return '계약/사업지원';
  if (emp.position === '과장') return 'GIS 플랫폼 PL';
  if (emp.position === '대리') return '공간DB 설계/구축';
  return '백엔드 API 개발';
}

export default function ManpowerSheet({
  items,
  onChangeItems,
  employees = [],
  readOnly,
  startDate,
  endDate,
}: Props) {
  // 현재 이름 검색 드롭다운이 열려 있는 행의 id
  const [activeDropdownRowId, setActiveDropdownRowId] = useState<string | null>(null);
  const [rowSearchQueries, setRowSearchQueries] = useState<Record<string, string>>({});

  // 프로젝트/계약의 전체 기간에 따른 월 목록 동적 계산 (M1 ~ Mn)
  const monthList = React.useMemo(
    () => getContractMonthList(startDate, endDate),
    [startDate, endDate]
  );
  const totalMonths = monthList.length;

  const totalMM = items.reduce((sum, it) => sum + it.totalMM, 0);
  const totalLaborCost = items.reduce((sum, it) => sum + it.laborCost, 0);

  // 빈 행 추가 (전체 사업 개월 수에 맞춰 기본 1.0 편성)
  const handleAddBlankItem = () => {
    const defaultEmp = employees[0];
    const months = Array(totalMonths).fill(1);
    const mm = months.reduce((a, b) => a + b, 0);

    let pos = defaultEmp ? defaultEmp.position : '과장';
    const priceInfo = STANDARD_UNIT_PRICES.find((p) => p.position === pos);
    const unitPrice = configuredPrice(pos, new Date(startDate || Date.now()).getFullYear());
    const grade = (priceInfo ? priceInfo.grade : '고급') as '특급' | '고급' | '중급' | '초급';

    const newItem: ManpowerPlanItem = {
      id: `mp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: '당사',
      grade,
      role: defaultEmp ? recommendRoleForEmployee(defaultEmp) : 'GIS 플랫폼 PL',
      name: '',
      position: pos,
      months,
      totalMM: mm,
      unitPrice,
      laborCost: mm * unitPrice,
    };
    onChangeItems([...items, newItem]);
    setActiveDropdownRowId(newItem.id);
  };

  // 행 내에서 사내 직원 선택 시 (이름, 직급, 등급, 단가, 역할 자동 설정)
  const handleSelectEmployee = (rowId: string, emp: Employee) => {
    const priceInfo = STANDARD_UNIT_PRICES.find((p) => p.position === emp.position);
    const unitPrice = configuredPrice(emp.position, new Date(startDate || Date.now()).getFullYear());
    const grade = (priceInfo ? priceInfo.grade : '고급') as '특급' | '고급' | '중급' | '초급';

    const updated = items.map((it) => {
      if (it.id !== rowId) return it;
      return {
        ...it,
        employeeId: emp.id,
        name: emp.name,
        position: emp.position,
        grade,
        role: recommendRoleForEmployee(emp),
        unitPrice,
        laborCost: Math.round(it.totalMM * unitPrice),
      };
    });

    onChangeItems(updated);
    setActiveDropdownRowId(null);
    setRowSearchQueries((prev) => ({ ...prev, [rowId]: '' }));
  };

  // 월별 공수 변경
  const handleMonthChange = (id: string, mIdx: number, val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    const updated = items.map((it) => {
      if (it.id === id) {
        // 기존 배열 크기가 totalMonths보다 작을 경우 패딩
        const nextMonths = Array.from({ length: totalMonths }, (_, i) => it.months[i] ?? 0);
        nextMonths[mIdx] = clamped;
        const nextTotalMM = Math.round(nextMonths.reduce((a, b) => a + b, 0) * 100) / 100;
        return {
          ...it,
          months: nextMonths,
          totalMM: nextTotalMM,
          laborCost: Math.round(nextTotalMM * it.unitPrice),
        };
      }
      return it;
    });
    onChangeItems(updated);
  };

  // 월별 셀 원클릭 순환 토글 (1 -> 0.5 -> 0 -> 1)
  const handleCycleMonthCell = (id: string, mIdx: number) => {
    if (readOnly) return;
    const target = items.find((it) => it.id === id);
    if (!target) return;
    const cur = target.months[mIdx] ?? 0;
    const nextVal = cur === 1 ? 0.5 : cur === 0.5 ? 0 : 1;
    handleMonthChange(id, mIdx, nextVal);
  };

  // 행 삭제
  const handleDelete = (id: string) => {
    onChangeItems(items.filter((it) => it.id !== id));
  };

  // 개별 행 공수 프리셋 (all1, half, firstHalf, secondHalf, clear)
  const handleRowMonthPreset = (
    id: string,
    preset: 'all1' | 'half' | 'firstHalf' | 'secondHalf' | 'clear'
  ) => {
    const halfPoint = Math.ceil(totalMonths / 2);
    const updated = items.map((it) => {
      if (it.id !== id) return it;
      let nextMonths = Array(totalMonths).fill(0);
      if (preset === 'all1') {
        nextMonths = Array(totalMonths).fill(1);
      } else if (preset === 'half') {
        nextMonths = Array(totalMonths).fill(0.5);
      } else if (preset === 'firstHalf') {
        nextMonths = Array.from({ length: totalMonths }, (_, i) => (i < halfPoint ? 1 : 0));
      } else if (preset === 'secondHalf') {
        nextMonths = Array.from({ length: totalMonths }, (_, i) => (i >= halfPoint ? 1 : 0));
      } else if (preset === 'clear') {
        nextMonths = Array(totalMonths).fill(0);
      }

      const nextTotalMM = Math.round(nextMonths.reduce((a, b) => a + b, 0) * 100) / 100;
      return {
        ...it,
        months: nextMonths,
        totalMM: nextTotalMM,
        laborCost: Math.round(nextTotalMM * it.unitPrice),
      };
    });
    onChangeItems(updated);
  };

  // 전 인원 일괄 공수 채우기 (전체 기간 동적 반영)
  const handleBatchApplyMonths = (
    preset: 'full' | 'half' | 'firstHalf' | 'secondHalf' | 'custom',
    customMonthsCount?: number,
    customRate: number = 1
  ) => {
    if (readOnly) return;
    const halfPoint = Math.ceil(totalMonths / 2);

    const updated = items.map((it) => {
      let nextMonths: number[];
      if (preset === 'full') {
        nextMonths = Array(totalMonths).fill(1);
      } else if (preset === 'half') {
        nextMonths = Array(totalMonths).fill(0.5);
      } else if (preset === 'firstHalf') {
        nextMonths = Array.from({ length: totalMonths }, (_, i) => (i < halfPoint ? 1 : 0));
      } else if (preset === 'secondHalf') {
        nextMonths = Array.from({ length: totalMonths }, (_, i) => (i >= halfPoint ? 1 : 0));
      } else {
        const count = customMonthsCount ?? totalMonths;
        nextMonths = Array.from({ length: totalMonths }, (_, idx) =>
          idx < count ? customRate : 0
        );
      }

      const nextTotalMM = Math.round(nextMonths.reduce((a, b) => a + b, 0) * 100) / 100;
      return {
        ...it,
        months: nextMonths,
        totalMM: nextTotalMM,
        laborCost: Math.round(nextTotalMM * it.unitPrice),
      };
    });
    onChangeItems(updated);
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 인건비 요약 및 툴바 (상단 검색창 제거 후 테이블로 통합) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span>투입인력 및 인건비 산출</span>
              <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                {items.length}명 편성
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              아래 표에서 <strong>직원 성명 또는 초성(예: ㅂㅇㅁ, ㄱㅅㅊ)</strong>으로 검색하여 투입인력을 지정할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 사업 기간 표시 뱃지 */}
          {startDate && endDate && (
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-700">
              <span className="text-slate-400 font-normal">사업기간:</span>
              <strong className="font-mono text-indigo-700">
                {startDate.replace(/-/g, '.')} ~ {endDate.replace(/-/g, '.')}
              </strong>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                전체 {totalMonths}개월
              </span>
            </div>
          )}

          {/* 일괄 공수 조정 버튼 */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <span className="text-slate-500 font-semibold px-2 text-[11px]">일괄 공수:</span>
            <button
              type="button"
              onClick={() => handleBatchApplyMonths('full')}
              className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-600 hover:text-white text-slate-700 font-bold transition text-[11px] shadow-2xs"
            >
              전 기간 (1.0)
            </button>
            <button
              type="button"
              onClick={() => handleBatchApplyMonths('half')}
              className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-600 hover:text-white text-slate-700 font-bold transition text-[11px] shadow-2xs"
            >
              전 기간 (0.5)
            </button>
            {totalMonths >= 4 && (
              <>
                <button
                  type="button"
                  onClick={() => handleBatchApplyMonths('firstHalf')}
                  className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-600 hover:text-white text-slate-700 font-bold transition text-[11px] shadow-2xs"
                >
                  전반기
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchApplyMonths('secondHalf')}
                  className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-600 hover:text-white text-slate-700 font-bold transition text-[11px] shadow-2xs"
                >
                  후반기
                </button>
              </>
            )}
          </div>

          {/* 총 합계 정보 */}
          <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs">
            <div>
              <span className="text-slate-500">총 M/M:</span>{' '}
              <strong className="text-indigo-950 font-mono font-bold text-sm">
                {totalMM.toFixed(1)}
              </strong>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span className="text-slate-500">당사 인건비:</span>{' '}
              <strong className="text-indigo-700 font-mono font-bold text-sm">
                {totalLaborCost.toLocaleString()}천원
              </strong>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAddBlankItem}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> 직원 투입 행 추가
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeItems([])}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition"
                  title="전체 비우기"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. 메인 투입인력 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-visible shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-3 w-44 sticky left-0 bg-slate-50 z-10">성명 (초성 검색)</th>
                <th className="px-2.5 py-3 w-28">직급 / 등급 (자동)</th>
                <th className="px-2.5 py-3 w-40">담당 역할</th>
                {!readOnly && <th className="px-1.5 py-3 text-center w-28">공수 프리셋</th>}
                {monthList.map((m) => (
                  <th
                    key={m.index}
                    className="px-1 py-2 text-center min-w-[48px] border-l border-slate-200"
                  >
                    <div className="text-[10px] text-indigo-600 font-semibold leading-tight">
                      {m.yearMonth}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-slate-700">
                      {m.label}
                    </div>
                  </th>
                ))}
                <th className="px-2.5 py-3 text-right w-16 bg-indigo-50/40 border-l border-slate-200">
                  총 MM
                </th>
                <th className="px-2.5 py-3 text-right w-24">월단가(천원)</th>
                <th className="px-2.5 py-3 text-right w-28 bg-indigo-50/40">인건비(천원)</th>
                {!readOnly && <th className="px-2 py-3 w-10 text-center">삭제</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={monthList.length + 8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold">편성된 투입 인력이 없습니다.</p>
                    <button
                      type="button"
                      onClick={handleAddBlankItem}
                      className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> 직원 투입 행 추가하기
                    </button>
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const isDropdownOpen = activeDropdownRowId === it.id;
                  const query = rowSearchQueries[it.id] ?? '';

                  // 검색어(이름 or 초성)로 필터링된 사내 직원 목록
                  const matchedEmployees = employees.filter((emp) =>
                    matchNameOrChosung(emp.name, query)
                  );

                  // 직급 및 기술등급 뱃지 스타일
                  const gradeBadgeClass =
                    it.grade === '특급'
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : it.grade === '고급'
                      ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                      : it.grade === '중급'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-slate-100 text-slate-800 border-slate-200';

                  return (
                    <tr key={it.id} className="hover:bg-slate-50/60 transition">
                      {/* 성명: 인라인 초성/이름 검색 팝오버 드롭다운 */}
                      <td className="px-3 py-2.5 relative">
                        {readOnly ? (
                          <span className="font-bold text-slate-900 text-xs">{it.name}</span>
                        ) : (
                          <div className="relative">
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                value={isDropdownOpen ? query : it.name || ''}
                                placeholder="이름/초성(ㄱㅅㅊ)"
                                onFocus={() => {
                                  setActiveDropdownRowId(it.id);
                                  setRowSearchQueries((prev) => ({
                                    ...prev,
                                    [it.id]: it.name ? '' : '',
                                  }));
                                }}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRowSearchQueries((prev) => ({ ...prev, [it.id]: val }));
                                  if (!isDropdownOpen) setActiveDropdownRowId(it.id);
                                }}
                                className="w-full pl-2.5 pr-6 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveDropdownRowId(isDropdownOpen ? null : it.id)
                                }
                                className="absolute right-1.5 text-slate-400 hover:text-slate-600 p-0.5"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* 초성/이름 검색 자동완성 드롭다운 팝오버 */}
                            {isDropdownOpen && (
                              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 max-h-56 overflow-y-auto p-1 text-xs">
                                <div className="px-2 py-1 text-[10px] text-slate-400 font-semibold border-b border-slate-100 flex items-center justify-between">
                                  <span>사내 직원 초성 검색 ({matchedEmployees.length}명)</span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveDropdownRowId(null)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>

                                {matchedEmployees.length === 0 ? (
                                  <div className="p-3 text-center text-slate-400 text-xs">
                                    일치하는 직원이 없습니다.
                                  </div>
                                ) : (
                                  matchedEmployees.map((emp) => {
                                    const isCurrent = it.name === emp.name;
                                    return (
                                      <div
                                        key={emp.id}
                                        onClick={() => handleSelectEmployee(it.id, emp)}
                                        className={`px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between transition ${
                                          isCurrent
                                            ? 'bg-indigo-600 text-white font-bold'
                                            : 'hover:bg-indigo-50 text-slate-800'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <User className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                                          <span className="font-bold text-xs">{emp.name}</span>
                                          <span className={`text-[11px] ${isCurrent ? 'text-indigo-200' : 'text-slate-500'}`}>
                                            {emp.position}
                                          </span>
                                        </div>
                                        <span className={`text-[10px] ${isCurrent ? 'text-indigo-100' : 'text-slate-400'}`}>
                                          {cleanDeptName(emp.department)}
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 직급 / 기술등급 (사용자 요청: 직원정보에서 자동 반영되므로 콤보박스 제거 후 깔끔한 텍스트/뱃지 표시) */}
                      <td className="px-2.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900 text-xs">{it.position}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${gradeBadgeClass}`}>
                            {it.grade}
                          </span>
                        </div>
                      </td>

                      {/* 담당 역할 */}
                      <td className="px-2.5 py-2.5">
                        {readOnly ? (
                          <span className="text-slate-700 text-xs">{it.role}</span>
                        ) : (
                          <div className="relative">
                            <input
                              type="text"
                              list={`role-presets-${it.id}`}
                              value={it.role}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = items.map((m) =>
                                  m.id === it.id ? { ...m, role: val } : m
                                );
                                onChangeItems(updated);
                              }}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                            />
                            <datalist id={`role-presets-${it.id}`}>
                              {ROLE_PRESETS.map((r) => (
                                <option key={r} value={r} />
                              ))}
                            </datalist>
                          </div>
                        )}
                      </td>

                      {/* 빠른 공수 프리셋 */}
                      {!readOnly && (
                        <td className="px-1.5 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleRowMonthPreset(it.id, 'all1')}
                              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-[10px] font-bold text-slate-600 transition"
                              title={`전 기간 1.0 투입 (${totalMonths}MM)`}
                            >
                              전체
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRowMonthPreset(it.id, 'half')}
                              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-[10px] font-bold text-slate-600 transition"
                              title={`전 기간 0.5 반투입 (${(totalMonths * 0.5).toFixed(1)}MM)`}
                            >
                              0.5
                            </button>
                            {totalMonths >= 4 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRowMonthPreset(it.id, 'firstHalf')}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-[10px] font-bold text-slate-600 transition"
                                  title="전반기 투입"
                                >
                                  전반
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRowMonthPreset(it.id, 'secondHalf')}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white text-[10px] font-bold text-slate-600 transition"
                                  title="후반기 투입"
                                >
                                  후반
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}

                      {/* M1 ~ Mn 전체 사업 기간 월별 공수 셀 (클릭 시 1.0 -> 0.5 -> 0 순환 토글) */}
                      {monthList.map((m) => {
                        const mVal = it.months[m.index] ?? 0;
                        const cellBg =
                          mVal >= 1
                            ? 'bg-indigo-600 text-white font-black'
                            : mVal > 0
                            ? 'bg-indigo-100 text-indigo-900 font-bold'
                            : 'bg-slate-50 text-slate-300';

                        return (
                          <td
                            key={m.index}
                            className="px-0.5 py-2.5 text-center border-l border-slate-100"
                          >
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => handleCycleMonthCell(it.id, m.index)}
                              className={`w-9 h-7 rounded-lg text-xs font-mono transition flex items-center justify-center mx-auto shadow-2xs ${cellBg} ${
                                !readOnly ? 'hover:scale-105 active:scale-95' : ''
                              }`}
                              title={`${m.yearMonth} (${m.label}) 공수: ${mVal} (클릭하여 1.0/0.5/0 순환)`}
                            >
                              {mVal > 0 ? mVal : '-'}
                            </button>
                          </td>
                        );
                      })}

                      {/* 총 MM */}
                      <td className="px-2.5 py-2.5 text-right font-mono font-bold text-indigo-950 bg-indigo-50/40 text-xs">
                        {it.totalMM.toFixed(1)}
                      </td>

                      {/* 월 기준단가 */}
                      <td className="px-2.5 py-2.5 text-right font-mono text-slate-700 text-xs">
                        {it.unitPrice.toLocaleString()}
                      </td>

                      {/* 인건비 */}
                      <td className="px-2.5 py-2.5 text-right font-mono font-bold text-indigo-700 bg-indigo-50/40 text-xs">
                        {it.laborCost.toLocaleString()}
                      </td>

                      {/* 삭제 버튼 */}
                      {!readOnly && (
                        <td className="px-2 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDelete(it.id)}
                            className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="행 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
