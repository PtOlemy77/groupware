'use client';

import React, { useMemo } from 'react';
import { DirectExpenseItem } from '@/types/groupware';
import { DollarSign, Sparkles, RotateCcw } from 'lucide-react';

interface Props {
  items: DirectExpenseItem[];
  onChangeItems: (items: DirectExpenseItem[]) => void;
  totalMM?: number;
  headcount?: number;
  readOnly?: boolean;
}

// 표준 W-Q-S-12-6 엑셀 서식 직접경비 표준 계정과목 목록 (8대 표준 항목 고정)
export const STANDARD_EXPENSE_ACCOUNTS = [
  {
    account: '복리/특근식대' as const,
    defaultBasis: '투입인력 특근식대 (야근/휴일)',
    defaultUnitPrice: 10, // 10천원 (1만원)
    defaultNote: '특근식대 1식 기준',
  },
  {
    account: '복리/회의비' as const,
    defaultBasis: '착수/중간/완료보고 및 정기 공정회의',
    defaultUnitPrice: 70, // 70천원 (7만원)
    defaultNote: '회의비 및 다과비',
  },
  {
    account: '국내출장비' as const,
    defaultBasis: '발주처 기술협의 및 현장 출장여비',
    defaultUnitPrice: 400, // 400천원 (40만원)
    defaultNote: '교통비/숙박비/일비 1회 기준',
  },
  {
    account: '시내교통비' as const,
    defaultBasis: '현장 실사 및 업무 지원 시내교통비',
    defaultUnitPrice: 400, // 400천원
    defaultNote: '월정액 기준',
  },
  {
    account: '인쇄도서비' as const,
    defaultBasis: '보고서 및 산출물 인쇄 제본',
    defaultUnitPrice: 2100, // 2,100천원
    defaultNote: '착수/중간/최종보고서 1식',
  },
  {
    account: '소모품비' as const,
    defaultBasis: '개발용 전산소모품 및 사무용품',
    defaultUnitPrice: 500, // 500천원
    defaultNote: '토너/용지/기타 소모품',
  },
  {
    account: '감가상각비' as const,
    defaultBasis: '개발/테스트 서버 및 업무용 PC 감가상각',
    defaultUnitPrice: 1500, // 1,500천원
    defaultNote: '프로젝트 귀속분',
  },
  {
    account: '지급수수료' as const,
    defaultBasis: 'GS인증 및 공인기관 시험성적서 수수료',
    defaultUnitPrice: 0,
    defaultNote: '공공기관 인증/수수료',
  },
];

export default function DirectExpenseSheet({
  items,
  onChangeItems,
  totalMM = 42,
  headcount = 5,
  readOnly,
}: Props) {
  // 8대 표준 항목 전체 행을 항상 고정으로 구성하고, 기존 items와 매핑
  const rows = useMemo(() => {
    return STANDARD_EXPENSE_ACCOUNTS.map((std, index) => {
      const existing = items.find((it) => it.account === std.account);
      if (existing) {
        const qty = existing.qty ?? 0;
        const unitPrice = existing.unitPrice ?? 0;
        const amount = existing.amount ?? Math.round(qty * unitPrice);
        return {
          id: existing.id || `exp_std_${index}`,
          account: std.account,
          qty,
          unitPrice,
          amount,
          basis: existing.basis !== undefined ? existing.basis : std.defaultBasis,
          note: existing.note !== undefined ? existing.note : std.defaultNote,
        };
      }
      return {
        id: `exp_std_${index}`,
        account: std.account,
        qty: 0,
        unitPrice: std.defaultUnitPrice,
        amount: 0,
        basis: std.defaultBasis,
        note: std.defaultNote,
      };
    });
  }, [items]);

  const totalAmount = rows.reduce((sum, it) => sum + (it.amount || 0), 0);

  // 개별 행 값 변경 핸들러
  const handleRowChange = (
    account: string,
    field: 'qty' | 'unitPrice' | 'basis' | 'note',
    value: number | string
  ) => {
    const updated = rows.map((r) => {
      if (r.account !== account) return r;
      const next = { ...r, [field]: value };
      if (field === 'qty' || field === 'unitPrice') {
        const q = field === 'qty' ? Number(value) || 0 : next.qty;
        const u = field === 'unitPrice' ? Number(value) || 0 : next.unitPrice;
        next.qty = q;
        next.unitPrice = u;
        next.amount = Math.round(q * u);
      }
      return next;
    });
    onChangeItems(updated);
  };

  // 투입인력 M/M 기준 표준 직접경비 자동 산출 (엑셀 표준 산식)
  const handleAutoCalculateByManpower = () => {
    const mm = Math.max(1, Math.round(totalMM));
    const hc = Math.max(1, headcount);

    const updated = rows.map((r) => {
      switch (r.account) {
        case '복리/특근식대': {
          const qty = mm * 10;
          const unitPrice = 10;
          return {
            ...r,
            qty,
            unitPrice,
            amount: qty * unitPrice,
            basis: `총 ${mm} MM × 월 10일 기준`,
            note: '야근 및 휴일 특근식대 (1식 1만원)',
          };
        }
        case '복리/회의비': {
          const qty = hc * 4;
          const unitPrice = 70;
          return {
            ...r,
            qty,
            unitPrice,
            amount: qty * unitPrice,
            basis: `투입 ${hc}명 × 회의 4회 기준`,
            note: '착수/중간/완료 및 정기공정회의',
          };
        }
        case '국내출장비': {
          const qty = Math.max(2, Math.round(mm * 0.3));
          const unitPrice = 400;
          return {
            ...r,
            qty,
            unitPrice,
            amount: qty * unitPrice,
            basis: `${qty}회 발주처 출장여비`,
            note: '교통비/숙박비/일비 1식',
          };
        }
        case '시내교통비': {
          const qty = Math.max(1, Math.round(mm / hc));
          const unitPrice = 400;
          return {
            ...r,
            qty,
            unitPrice,
            amount: qty * unitPrice,
            basis: `수행기간 ${qty}개월`,
            note: '시내출장 및 차량유지비',
          };
        }
        case '인쇄도서비': {
          const qty = 1;
          const unitPrice = 2100;
          return {
            ...r,
            qty,
            unitPrice,
            amount: 2100,
            basis: '보고서 1식 (착수/중간/최종)',
            note: '칼라 보고서 및 매뉴얼 인쇄',
          };
        }
        case '소모품비': {
          const qty = 1;
          const unitPrice = 500;
          return {
            ...r,
            qty,
            unitPrice,
            amount: 500,
            basis: '전산 소모품 1식',
            note: '토너 및 사무용품',
          };
        }
        case '감가상각비': {
          const qty = 1;
          const unitPrice = 1500;
          return {
            ...r,
            qty,
            unitPrice,
            amount: 1500,
            basis: '개발/테스트 장비 귀속분 1식',
            note: '사내 장비 감가상각',
          };
        }
        case '지급수수료': {
          return {
            ...r,
            qty: 0,
            unitPrice: 0,
            amount: 0,
            basis: '해당 없음',
            note: '-',
          };
        }
        default:
          return r;
      }
    });
    onChangeItems(updated);
  };

  // 전체 금액 초기화 (0으로 리셋)
  const handleResetToZero = () => {
    if (!confirm('직접경비 전체 수량을 0으로 초기화하시겠습니까?')) return;
    const updated = rows.map((r) => ({
      ...r,
      qty: 0,
      amount: 0,
    }));
    onChangeItems(updated);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
      {/* 헤더 및 집계 정보 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            ■ 직접경비 산출내역표 (W-Q-S-12-6 표준 서식)
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            표준 엑셀 서식에 따라 전체 계정과목이 고정 표시되며, 수량과 단가·근거 값만 직접 수정합니다.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right bg-indigo-50/70 border border-indigo-200/60 px-3.5 py-1.5 rounded-xl">
            <span className="text-[11px] text-indigo-900 font-semibold">직접경비 총액:</span>
            <span className="ml-2 font-extrabold text-base text-indigo-700">
              {totalAmount.toLocaleString()} <span className="text-xs font-bold text-indigo-600">천원</span>
            </span>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAutoCalculateByManpower}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-2xs"
                title={`투입 M/M(${totalMM} MM) 및 인원(${headcount}명) 기준 표준 산출`}
              >
                <Sparkles className="w-3.5 h-3.5" /> 투입인력 기준 자동산출
              </button>
              <button
                type="button"
                onClick={handleResetToZero}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition border border-slate-200"
                title="수량 전체 초기화"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 초기화
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 엑셀 서식 스타일의 고정 테이블 */}
      <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-2xs">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
            <tr>
              <th className="px-3 py-2.5 w-12 text-center border-r border-slate-200">No.</th>
              <th className="px-4 py-2.5 w-44 border-r border-slate-200">계정과목 (표준)</th>
              <th className="px-3 py-2.5 text-right w-24 border-r border-slate-200">수량</th>
              <th className="px-3 py-2.5 text-right w-32 border-r border-slate-200">단가 (천원)</th>
              <th className="px-3 py-2.5 text-right w-36 bg-indigo-50/70 border-r border-slate-200 text-indigo-950 font-extrabold">
                금액 (천원)
              </th>
              <th className="px-4 py-2.5 border-r border-slate-200">산출 근거 (규격/단위/기간)</th>
              <th className="px-4 py-2.5 w-48">비고</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800 bg-white">
            {rows.map((row, idx) => {
              const hasAmount = row.amount > 0;
              return (
                <tr
                  key={row.account}
                  className={`hover:bg-indigo-50/20 transition ${
                    hasAmount ? 'bg-white font-medium' : 'bg-slate-50/40 text-slate-400'
                  }`}
                >
                  {/* 번호 */}
                  <td className="px-3 py-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200">
                    {idx + 1}
                  </td>

                  {/* 계정과목 (콤보박스 없이 고정 텍스트 뱃지) */}
                  <td className="px-4 py-2 font-bold text-slate-900 border-r border-slate-200">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                        hasAmount
                          ? 'bg-slate-100 text-slate-800 border border-slate-200'
                          : 'bg-slate-100/60 text-slate-500'
                      }`}
                    >
                      {row.account}
                    </span>
                  </td>

                  {/* 수량 */}
                  <td className="px-2 py-1.5 text-right border-r border-slate-200">
                    {readOnly ? (
                      <span className="font-semibold px-2">{row.qty}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.qty === 0 ? '' : row.qty}
                        onChange={(e) =>
                          handleRowChange(row.account, 'qty', e.target.value)
                        }
                        placeholder="0"
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-xs text-right font-bold text-slate-800 focus:border-indigo-500 focus:bg-white bg-slate-50/50"
                      />
                    )}
                  </td>

                  {/* 단가 (천원) */}
                  <td className="px-2 py-1.5 text-right border-r border-slate-200">
                    {readOnly ? (
                      <span className="font-semibold px-2">
                        {row.unitPrice.toLocaleString()}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={row.unitPrice === 0 ? '' : row.unitPrice}
                        onChange={(e) =>
                          handleRowChange(row.account, 'unitPrice', e.target.value)
                        }
                        placeholder="0"
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-xs text-right font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white bg-slate-50/50"
                      />
                    )}
                  </td>

                  {/* 금액 (자동계산: 수량 * 단가) */}
                  <td className="px-3 py-2 text-right bg-indigo-50/50 border-r border-slate-200">
                    <span
                      className={`font-black text-xs ${
                        hasAmount ? 'text-indigo-700' : 'text-slate-300'
                      }`}
                    >
                      {row.amount.toLocaleString()}
                    </span>
                  </td>

                  {/* 산출 근거 */}
                  <td className="px-2 py-1.5 border-r border-slate-200">
                    {readOnly ? (
                      <span className="text-slate-600 px-2">{row.basis}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.basis || ''}
                        onChange={(e) =>
                          handleRowChange(row.account, 'basis', e.target.value)
                        }
                        placeholder="산출 근거 입력"
                        className="w-full p-1.5 border border-slate-200 rounded-lg text-xs focus:border-indigo-500 bg-white"
                      />
                    )}
                  </td>

                  {/* 비고 */}
                  <td className="px-2 py-1.5 text-slate-500">
                    {readOnly ? (
                      <span className="px-2">{row.note}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.note || ''}
                        onChange={(e) =>
                          handleRowChange(row.account, 'note', e.target.value)
                        }
                        placeholder="비고 입력"
                        className="w-full p-1.5 border border-slate-200 rounded-lg text-xs focus:border-indigo-500 bg-white"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* 엑셀 서식 하단 총계 */}
          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
            <tr>
              <td
                colSpan={4}
                className="px-4 py-3 text-center text-slate-800 font-extrabold text-xs"
              >
                합 계 (직접경비 총액)
              </td>
              <td className="px-3 py-3 text-right text-indigo-700 font-black text-sm bg-indigo-100/70 border-r border-slate-300">
                {totalAmount.toLocaleString()}{' '}
                <span className="text-[11px] font-bold text-indigo-600">천원</span>
              </td>
              <td
                colSpan={2}
                className="px-4 py-3 text-[11px] text-slate-500 font-normal"
              >
                ※ 수량 × 단가 자동 계산 (종합 손익계산서 및 예산집행 계획과 실시간 연동)
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
