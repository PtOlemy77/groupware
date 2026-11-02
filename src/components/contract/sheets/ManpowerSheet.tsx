'use client';
import { unitPrice as configuredPrice } from '@/lib/api';

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  RefreshCw,
  User,
  Wand2,
  X,
  ChevronDown,
  Sparkles,
  Calendar,
  Layers,
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
  year: number;
  month: number;
}

export function getContractMonthList(startDate?: string, endDate?: string): ContractMonthMeta[] {
  const curYear = new Date().getFullYear();
  if (!startDate || !endDate) {
    return Array.from({ length: 8 }, (_, i) => ({
      index: i,
      label: `M${i + 1}`,
      yearMonth: `M${i + 1}`,
      year: curYear,
      month: i + 1,
    }));
  }

  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) {
    return Array.from({ length: 8 }, (_, i) => ({
      index: i,
      label: `M${i + 1}`,
      yearMonth: `M${i + 1}`,
      year: curYear,
      month: i + 1,
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
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const ym = `${String(yr).slice(2)}.${String(mo).padStart(2, '0')}`;
    list.push({
      index: i,
      label: `M${i + 1}`,
      yearMonth: ym,
      year: yr,
      month: mo,
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
  return targetChosung.includes(cleanQ);
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
  const monthList = useMemo(
    () => getContractMonthList(startDate, endDate),
    [startDate, endDate]
  );
  const totalMonths = monthList.length;

  // 고유 연도 목록 추출 (다년/연차 사업 지원)
  const uniqueYears = useMemo(() => {
    const set = new Set<number>();
    monthList.forEach((m) => {
      if (m.year) set.add(m.year);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [monthList]);

  // 연차별 탭 필터 ('all' 또는 연도 숫자)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  // 현재 화면에 표시할 월 목록
  const visibleMonths = useMemo(() => {
    if (selectedYear === 'all') return monthList;
    return monthList.filter((m) => m.year === selectedYear);
  }, [monthList, selectedYear]);

  // 직접 숫자 타이핑 편집 중인 셀 { rowId, mIdx }
  const [editingCell, setEditingCell] = useState<{ rowId: string; mIdx: number } | null>(null);
  const [cellInputValue, setCellInputValue] = useState<string>('');

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
    const clamped = Math.round(Math.max(0, Math.min(1, val)) * 100) / 100;
    const updated = items.map((it) => {
      if (it.id === id) {
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

  // 월별 셀 원클릭 순환 토글 (0 -> 1 -> 0.5 -> 0)
  const handleCycleMonthCell = (id: string, mIdx: number) => {
    if (readOnly) return;
    const target = items.find((it) => it.id === id);
    if (!target) return;
    const cur = target.months[mIdx] ?? 0;
    const nextVal = cur === 1 ? 0.5 : cur === 0.5 ? 0 : 1;
    handleMonthChange(id, mIdx, nextVal);
  };

  // 현재 화면(선택 연도 또는 전체) 기준 전원 공수 일괄 채우기
  const handleBatchFillAll = (value: number) => {
    if (readOnly) return;
    const targetIndices = visibleMonths.map((m) => m.index);
    const updated = items.map((it) => {
      const nextMonths = Array.from({ length: totalMonths }, (_, i) => it.months[i] ?? 0);
      targetIndices.forEach((idx) => {
        nextMonths[idx] = value;
      });
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

  // 특정 직원 행의 현재 화면(선택 연도 또는 전체) 공수 일괄 채우기
  const handleBatchFillRow = (id: string, value: number) => {
    if (readOnly) return;
    const targetIndices = visibleMonths.map((m) => m.index);
    const updated = items.map((it) => {
      if (it.id !== id) return it;
      const nextMonths = Array.from({ length: totalMonths }, (_, i) => it.months[i] ?? 0);
      targetIndices.forEach((idx) => {
        nextMonths[idx] = value;
      });
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

  // 행 삭제
  const handleDelete = (id: string) => {
    onChangeItems(items.filter((it) => it.id !== id));
  };

  // 단가 직접 변경
  const handleUnitPriceChange = (id: string, newPrice: number) => {
    const price = Math.max(0, newPrice);
    const updated = items.map((it) => {
      if (it.id === id) {
        return {
          ...it,
          unitPrice: price,
          laborCost: Math.round(it.totalMM * price),
        };
      }
      return it;
    });
    onChangeItems(updated);
  };

  // 전체 편성 인력의 노임단가를 사내 최신 기준단가로 일괄 재적용
  const handleRefreshAllUnitPrices = () => {
    const targetYear = new Date(startDate || Date.now()).getFullYear();
    const updated = items.map((it) => {
      const price = configuredPrice(it.position, targetYear);
      return {
        ...it,
        unitPrice: price,
        laborCost: Math.round(it.totalMM * price),
      };
    });
    onChangeItems(updated);
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 인건비 요약 및 툴바 */}
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
              공수 셀 <strong>클릭(1.0 ↔ 0.5 ↔ 0)</strong>, <strong>우클릭(0.5)</strong>, <strong>마우스휠(±0.1)</strong>, <strong>더블클릭(직접입력)</strong>이 가능합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 총 합계 정보 */}
          <div className="flex items-center gap-2.5 bg-indigo-50/70 border border-indigo-200 px-3.5 py-1.5 rounded-xl text-xs">
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
            <div className="flex items-center gap-1.5 flex-wrap">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleRefreshAllUnitPrices}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 shadow-2xs transition"
                  title="모든 편성 인력의 단가를 사내 표준 노임단가로 일괄 재적용"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> 노임단가 일괄 최신화
                </button>
              )}
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

      {/* 2. 메인 투입인력 테이블 카드 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-visible shadow-2xs">
        {/* 다년/연차 사업 지원: 연도별 탭 & 일괄 1.0 채우기 헤더 바 */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 rounded-t-2xl">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>사업 기간 보기:</span>
            </span>

            {/* 전체 기간 탭 */}
            <button
              type="button"
              onClick={() => setSelectedYear('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                selectedYear === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>전체 기간</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedYear === 'all'
                    ? 'bg-indigo-700 text-indigo-100'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {totalMonths}개월
              </span>
            </button>

            {/* 연도별 탭 (1차년도, 2차년도 등) */}
            {uniqueYears.map((yr, idx) => {
              const countInYear = monthList.filter((m) => m.year === yr).length;
              const isSelected = selectedYear === yr;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>
                    {uniqueYears.length > 1 ? `${idx + 1}차년도 (${yr}년)` : `${yr}년`}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? 'bg-indigo-700 text-indigo-100'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {countInYear}개월
                  </span>
                </button>
              );
            })}
          </div>

          {/* 일괄 채우기 퀵 액션 (전체 1.0 채우기 기능) */}
          {!readOnly && items.length > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">
                [{selectedYear === 'all' ? '전체 기간' : `${selectedYear}년`}] 공수 일괄:
              </span>
              <button
                type="button"
                onClick={() => handleBatchFillAll(1.0)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 font-bold transition shadow-2xs cursor-pointer"
                title={`${selectedYear === 'all' ? '전체 기간' : `${selectedYear}년도`}의 모든 직원 공수를 1.0으로 일괄 설정`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>전원 1.0 채우기</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchFillAll(0.5)}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-800 hover:text-white border border-indigo-200 font-bold transition cursor-pointer"
                title={`${selectedYear === 'all' ? '전체 기간' : `${selectedYear}년도`}의 모든 직원 공수를 0.5로 설정`}
              >
                <span>전원 0.5</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchFillAll(0)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 font-medium transition cursor-pointer"
                title={`${selectedYear === 'all' ? '전체 기간' : `${selectedYear}년도`}의 모든 직원 공수를 0으로 비우기`}
              >
                <span>비우기(0)</span>
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-3 py-3 w-44 sticky left-0 bg-slate-50 z-10">성명 (초성 검색)</th>
                <th className="px-2.5 py-3 w-28">직급 / 등급</th>
                <th className="px-2.5 py-3 w-44">담당 역할 / 행 채우기</th>
                {visibleMonths.map((m) => (
                  <th
                    key={m.index}
                    className="px-1 py-2 text-center min-w-[46px] border-l border-slate-200 bg-slate-50/80"
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
                  <td colSpan={visibleMonths.length + 7} className="py-12 text-center text-slate-400">
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
                                    [it.id]: '',
                                  }));
                                }}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRowSearchQueries((prev) => ({
                                    ...prev,
                                    [it.id]: val,
                                  }));
                                  if (!isDropdownOpen) setActiveDropdownRowId(it.id);
                                }}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white placeholder:text-slate-400 placeholder:font-normal"
                              />
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
                            </div>

                            {/* 초성/이름 실시간 검색 드롭다운 레이어 */}
                            {isDropdownOpen && (
                              <div
                                className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-56 overflow-y-auto"
                                onMouseDown={(e) => e.preventDefault()}
                              >
                                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-100 flex items-center justify-between">
                                  <span>사내 임직원 검색 결과 ({matchedEmployees.length}명)</span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveDropdownRowId(null)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                {matchedEmployees.length === 0 ? (
                                  <div className="px-3 py-3 text-center text-slate-400 text-xs">
                                    일치하는 직원이 없습니다.
                                  </div>
                                ) : (
                                  matchedEmployees.map((emp) => {
                                    const isCurrent = emp.id === it.employeeId;
                                    return (
                                      <div
                                        key={emp.id}
                                        onClick={() => handleSelectEmployee(it.id, emp)}
                                        className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition text-xs ${
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

                      {/* 직급 / 기술등급 */}
                      <td className="px-2.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900 text-xs">{it.position}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${gradeBadgeClass}`}>
                            {it.grade}
                          </span>
                        </div>
                      </td>

                      {/* 담당 역할 & 행별 원클릭 채우기 */}
                      <td className="px-2.5 py-2.5">
                        {readOnly ? (
                          <span className="text-slate-700 text-xs">{it.role}</span>
                        ) : (
                          <div>
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
                                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                              />
                              <datalist id={`role-presets-${it.id}`}>
                                {ROLE_PRESETS.map((r) => (
                                  <option key={r} value={r} />
                                ))}
                              </datalist>
                            </div>

                            {/* 행별 퀵 채우기 미니 버튼 그룹 */}
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] text-slate-400 font-medium">채우기:</span>
                              <button
                                type="button"
                                onClick={() => handleBatchFillRow(it.id, 1.0)}
                                className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 transition border border-emerald-200 cursor-pointer"
                                title={`이 직원의 ${selectedYear === 'all' ? '전체 기간' : `${selectedYear}년`} 모든 월을 1.0으로 채우기`}
                              >
                                1.0
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBatchFillRow(it.id, 0.5)}
                                className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 transition border border-indigo-200 cursor-pointer"
                                title={`이 직원의 ${selectedYear === 'all' ? '전체 기간' : `${selectedYear}년`} 모든 월을 0.5로 설정`}
                              >
                                0.5
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBatchFillRow(it.id, 0)}
                                className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-50 hover:bg-rose-600 hover:text-white text-slate-500 transition border border-slate-200 cursor-pointer"
                                title={`이 직원의 ${selectedYear === 'all' ? '전체 기간' : `${selectedYear}년`} 모든 월을 0으로 비우기`}
                              >
                                0
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 보이는 월별 공수 셀 (클릭 시 1.0 -> 0.5 -> 0, 우클릭 0.5, 휠 증감, 더블클릭 직접입력) */}
                      {visibleMonths.map((m) => {
                        const mVal = it.months[m.index] ?? 0;
                        const isEditingThisCell =
                          editingCell?.rowId === it.id && editingCell?.mIdx === m.index;

                        if (isEditingThisCell && !readOnly) {
                          return (
                            <td
                              key={m.index}
                              className="px-0.5 py-2.5 text-center border-l border-slate-100"
                            >
                              <input
                                autoFocus
                                type="number"
                                min={0}
                                max={1}
                                step={0.1}
                                value={cellInputValue}
                                onChange={(e) => setCellInputValue(e.target.value)}
                                onBlur={() => {
                                  const num = parseFloat(cellInputValue);
                                  if (!isNaN(num)) {
                                    handleMonthChange(it.id, m.index, num);
                                  }
                                  setEditingCell(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const num = parseFloat(cellInputValue);
                                    if (!isNaN(num)) {
                                      handleMonthChange(it.id, m.index, num);
                                    }
                                    setEditingCell(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                className="w-10 h-7 rounded text-center text-xs font-mono font-bold bg-white border-2 border-indigo-600 text-indigo-900 focus:outline-none shadow-sm"
                              />
                            </td>
                          );
                        }

                        const cellBg =
                          mVal >= 1
                            ? 'bg-indigo-600 text-white font-black shadow-2xs'
                            : mVal > 0
                            ? 'bg-indigo-100 text-indigo-900 font-bold border border-indigo-200'
                            : 'bg-slate-50 text-slate-300 hover:bg-slate-100 border border-transparent';

                        return (
                          <td
                            key={m.index}
                            className="px-0.5 py-2.5 text-center border-l border-slate-100"
                          >
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => handleCycleMonthCell(it.id, m.index)}
                              onContextMenu={(e) => {
                                if (readOnly) return;
                                e.preventDefault();
                                handleMonthChange(it.id, m.index, 0.5);
                              }}
                              onDoubleClick={(e) => {
                                if (readOnly) return;
                                e.preventDefault();
                                setEditingCell({ rowId: it.id, mIdx: m.index });
                                setCellInputValue(String(mVal));
                              }}
                              onWheel={(e) => {
                                if (readOnly) return;
                                e.preventDefault();
                                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                                const next = Math.round(Math.max(0, Math.min(1, mVal + delta)) * 10) / 10;
                                handleMonthChange(it.id, m.index, next);
                              }}
                              className={`w-9 h-7 rounded-lg text-xs font-mono transition flex items-center justify-center mx-auto select-none ${cellBg} ${
                                !readOnly ? 'hover:scale-105 active:scale-95 cursor-pointer' : ''
                              }`}
                              title={`${m.yearMonth} (${m.label}) 공수: ${mVal}\n• 클릭: 1.0 ↔ 0.5 ↔ 0\n• 우클릭: 0.5 즉시적용\n• 더블클릭: 직접 숫자입력\n• 휠스크롤: ±0.1 조절`}
                            >
                              {mVal > 0 ? (Number.isInteger(mVal) ? mVal.toFixed(0) : mVal.toFixed(1)) : '-'}
                            </button>
                          </td>
                        );
                      })}

                      {/* 총 MM */}
                      <td className="px-2.5 py-2.5 text-right font-mono font-bold text-indigo-950 bg-indigo-50/40 text-xs">
                        {it.totalMM.toFixed(1)}
                      </td>

                      {/* 월 기준단가 (수정 가능 input) */}
                      <td className="px-2.5 py-2.5 text-right font-mono text-slate-700 text-xs">
                        {readOnly ? (
                          <span>{it.unitPrice.toLocaleString()}</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min={0}
                              step={100}
                              value={it.unitPrice || ''}
                              onChange={(e) => handleUnitPriceChange(it.id, Number(e.target.value))}
                              className="w-20 px-1.5 py-1 text-right text-xs font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded-md focus:border-indigo-500 focus:outline-none"
                              placeholder="단가"
                            />
                            <span className="text-[10px] text-slate-400">천원</span>
                          </div>
                        )}
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
