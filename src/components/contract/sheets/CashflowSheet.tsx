'use client';

import React from 'react';
import { CashflowMilestoneItem } from '@/types/groupware';
import { Plus, Trash2, Calendar, Sparkles } from 'lucide-react';

interface Props {
  items: CashflowMilestoneItem[];
  onChangeItems: (items: CashflowMilestoneItem[]) => void;
  supplyAmount: number;
  readOnly?: boolean;
}

export default function CashflowSheet({
  items,
  onChangeItems,
  supplyAmount,
  readOnly,
}: Props) {
  const totalSupply = items.reduce((sum, it) => sum + it.supplyAmount, 0);
  const totalVat = items.reduce((sum, it) => sum + it.vatAmount, 0);
  const totalSum = totalSupply + totalVat;

  const applySplitPreset = (rates: number[], names: string[], milestones: string[]) => {
    const newItems: CashflowMilestoneItem[] = rates.map((r, idx) => {
      const sup = Math.round(supplyAmount * (r / 100));
      const vat = Math.round(sup * 0.1);
      return {
        id: `cf_preset_${Date.now()}_${idx}`,
        turnName: names[idx],
        milestone: milestones[idx],
        plannedDate:
          idx === 0
            ? '2026.04.15'
            : idx === rates.length - 1
            ? '2026.11.30'
            : '2026.08.31',
        ratePercent: r,
        supplyAmount: sup,
        vatAmount: vat,
        totalAmount: sup + vat,
        status: idx === 0 ? '입금완료' : '입금예정',
      };
    });
    onChangeItems(newItems);
  };

  const handleUpdate = (id: string, patch: Partial<CashflowMilestoneItem>) => {
    const updated = items.map((it) => {
      if (it.id === id) {
        const next = { ...it, ...patch };
        if (patch.ratePercent !== undefined) {
          next.supplyAmount = Math.round(supplyAmount * (patch.ratePercent / 100));
          next.vatAmount = Math.round(next.supplyAmount * 0.1);
          next.totalAmount = next.supplyAmount + next.vatAmount;
        } else if (patch.supplyAmount !== undefined) {
          next.vatAmount = Math.round(patch.supplyAmount * 0.1);
          next.totalAmount = patch.supplyAmount + next.vatAmount;
          next.ratePercent =
            supplyAmount > 0
              ? Math.round((patch.supplyAmount / supplyAmount) * 1000) / 10
              : 0;
        }
        return next;
      }
      return it;
    });
    onChangeItems(updated);
  };

  const handleAddMilestone = () => {
    const newItem: CashflowMilestoneItem = {
      id: `cf_${Date.now()}`,
      turnName: `${items.length + 1}차 중도금`,
      milestone: '마일스톤 협의',
      plannedDate: '2026.09.30',
      ratePercent: 20,
      supplyAmount: Math.round(supplyAmount * 0.2),
      vatAmount: Math.round(supplyAmount * 0.02),
      totalAmount: Math.round(supplyAmount * 0.22),
      status: '입금예정',
    };
    onChangeItems([...items, newItem]);
  };

  const handleDelete = (id: string) => {
    onChangeItems(items.filter((it) => it.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            ■ 계약입금 계획 (캐시플로우)
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-500">총 청구예정액:</span>
            <span className="ml-2 font-bold text-sm text-indigo-600">
              {totalSum.toLocaleString()} 천원 (VAT포함)
            </span>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddMilestone}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              <Plus className="w-3.5 h-3.5" /> 차수 추가
            </button>
          )}
        </div>
      </div>

      {/* 원클릭 입금 비율 프리셋 바 */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs font-bold text-indigo-700 flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5" /> 원클릭 입금비율 자동배분:
          </span>
          <button
            type="button"
            onClick={() =>
              applySplitPreset(
                [30, 40, 30],
                ['선금 (30%)', '1차 중도금 (40%)', '잔금 (30%)'],
                ['계약체결 및 착수보고', '중간보고회 및 기능검수', '최종 완료보고 및 납품검수']
              )
            }
            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-bold border border-indigo-200 transition"
          >
            표준 30% : 40% : 30% (선금·중도금·잔금)
          </button>
          <button
            type="button"
            onClick={() =>
              applySplitPreset(
                [50, 50],
                ['선금 (50%)', '잔금 (50%)'],
                ['계약체결 및 착수금 청구', '최종 검수 완료 후 지급']
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-semibold border border-slate-200 transition"
          >
            공공조달 50% : 50% (선금·잔금)
          </button>
          <button
            type="button"
            onClick={() =>
              applySplitPreset(
                [70, 30],
                ['선금 특례 (70%)', '잔금 (30%)'],
                ['조달청 선금 지급 특례 신청', '최종 준공 검수 후 지급']
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-semibold border border-slate-200 transition"
          >
            공공선금특례 70% : 30%
          </button>
          <button
            type="button"
            onClick={() =>
              applySplitPreset(
                [100],
                ['준공금 일시불 (100%)'],
                ['사업 최종 완료 및 검수 후 일괄 청구']
              )
            }
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-semibold border border-slate-200 transition"
          >
            준공 후 100% 일시불
          </button>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 w-32">회차 구분</th>
              <th className="px-3 py-2">수금 마일스톤 조건</th>
              <th className="px-3 py-2 w-32">지급 예정일</th>
              <th className="px-3 py-2 text-right w-20">비율 (%)</th>
              <th className="px-3 py-2 text-right w-28">공급가액(천원)</th>
              <th className="px-3 py-2 text-right w-24">부가세(천원)</th>
              <th className="px-3 py-2 text-right w-28 bg-indigo-50/50">합계(천원)</th>
              <th className="px-3 py-2 text-center w-28">상태</th>
              {!readOnly && <th className="px-2 py-2 w-12 text-center">삭제</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-bold text-slate-900">
                  {readOnly ? (
                    <span>{it.turnName}</span>
                  ) : (
                    <input
                      type="text"
                      value={it.turnName}
                      onChange={(e) => handleUpdate(it.id, { turnName: e.target.value })}
                      className="w-full p-1 border border-slate-200 rounded text-xs font-bold"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="text-slate-700">{it.milestone}</span>
                  ) : (
                    <input
                      type="text"
                      value={it.milestone}
                      onChange={(e) => handleUpdate(it.id, { milestone: e.target.value })}
                      className="w-full p-1 border border-slate-200 rounded text-xs"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="text-slate-600">{it.plannedDate}</span>
                  ) : (
                    <input
                      type="text"
                      value={it.plannedDate}
                      onChange={(e) => handleUpdate(it.id, { plannedDate: e.target.value })}
                      className="w-full p-1 border border-slate-200 rounded text-xs text-center"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    <span className="font-semibold text-slate-800">{it.ratePercent}%</span>
                  ) : (
                    <input
                      type="number"
                      step="5"
                      value={it.ratePercent}
                      onChange={(e) => handleUpdate(it.id, { ratePercent: Number(e.target.value) })}
                      className="w-full p-1 border border-slate-200 rounded text-xs text-right font-bold text-indigo-600"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {it.supplyAmount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {it.vatAmount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-bold text-slate-900 bg-indigo-50/40">
                  {it.totalAmount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-center">
                  {readOnly ? (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        it.status === '입금완료'
                          ? 'bg-emerald-100 text-emerald-700'
                          : it.status === '청구완료'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {it.status}
                    </span>
                  ) : (
                    <select
                      value={it.status}
                      onChange={(e) => handleUpdate(it.id, { status: e.target.value as any })}
                      className="p-1 border border-slate-200 rounded text-xs bg-white font-medium"
                    >
                      <option value="입금예정">입금예정</option>
                      <option value="청구완료">청구완료</option>
                      <option value="입금완료">입금완료</option>
                    </select>
                  )}
                </td>
                {!readOnly && (
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(it.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
            <tr>
              <td colSpan={3} className="px-3 py-2.5 text-center text-slate-700">
                수금 계획 합계
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-indigo-700">
                {items.reduce((s, it) => s + it.ratePercent, 0).toFixed(1)}%
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                {totalSupply.toLocaleString()} 천원
              </td>
              <td className="px-3 py-2.5 text-right text-slate-500">
                {totalVat.toLocaleString()} 천원
              </td>
              <td className="px-3 py-2.5 text-right text-indigo-700 font-extrabold bg-indigo-100/50">
                {totalSum.toLocaleString()} 천원
              </td>
              <td colSpan={readOnly ? 1 : 2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
