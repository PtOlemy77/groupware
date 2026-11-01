'use client';

import React from 'react';
import { OutsourcingItem } from '@/types/groupware';
import { Plus, Trash2, Briefcase } from 'lucide-react';

interface Props {
  items: OutsourcingItem[];
  onChangeItems: (items: OutsourcingItem[]) => void;
  readOnly?: boolean;
}

export default function OutsourcingSheet({ items, onChangeItems, readOnly }: Props) {
  const totalAmount = items.reduce((sum, it) => sum + it.contractAmount, 0);

  const handleAddItem = () => {
    const newItem: OutsourcingItem = {
      id: `out_${Date.now()}`,
      vendorName: '협력업체(주)',
      grade: '중급',
      workScope: '공간정보 데이터 전처리 및 변환',
      mm: 3,
      unitPrice: 6500,
      contractAmount: 3 * 6500,
      note: '도급 계약',
    };
    onChangeItems([...items, newItem]);
  };

  const handleUpdate = (id: string, patch: Partial<OutsourcingItem>) => {
    const updated = items.map((it) => {
      if (it.id === id) {
        const next = { ...it, ...patch };
        if (patch.mm !== undefined || patch.unitPrice !== undefined) {
          next.contractAmount = next.mm * next.unitPrice;
        }
        return next;
      }
      return it;
    });
    onChangeItems(updated);
  };

  const handleDelete = (id: string) => {
    onChangeItems(items.filter((it) => it.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            ■ 외주용역비
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-500">외주용역비 합계:</span>
            <span className="ml-2 font-bold text-sm text-indigo-600">
              {totalAmount.toLocaleString()} 천원
            </span>
          </div>
          {!readOnly && (
            <button
              onClick={handleAddItem}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              <Plus className="w-3.5 h-3.5" /> 외주처 추가
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-3 py-2">외주 업체명</th>
              <th className="px-3 py-2 w-20">기술등급</th>
              <th className="px-3 py-2">위탁 업무 내용</th>
              <th className="px-3 py-2 text-right w-20">M/M</th>
              <th className="px-3 py-2 text-right w-28">단가 (천원)</th>
              <th className="px-3 py-2 text-right w-28">도급액 (천원)</th>
              <th className="px-3 py-2">비고</th>
              {!readOnly && <th className="px-2 py-2 w-12 text-center">삭제</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-semibold">
                  {readOnly ? (
                    <span>{it.vendorName}</span>
                  ) : (
                    <input
                      type="text"
                      value={it.vendorName}
                      onChange={(e) => handleUpdate(it.id, { vendorName: e.target.value })}
                      className="w-full p-1 border border-slate-200 rounded text-xs"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="px-1.5 py-0.5 rounded bg-slate-100">{it.grade}</span>
                  ) : (
                    <select
                      value={it.grade}
                      onChange={(e) => handleUpdate(it.id, { grade: e.target.value as any })}
                      className="w-full p-1 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option value="특급">특급</option>
                      <option value="고급">고급</option>
                      <option value="중급">중급</option>
                      <option value="초급">초급</option>
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span>{it.workScope}</span>
                  ) : (
                    <input
                      type="text"
                      value={it.workScope}
                      onChange={(e) => handleUpdate(it.id, { workScope: e.target.value })}
                      className="w-full p-1 border border-slate-200 rounded text-xs"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    <span>{it.mm}</span>
                  ) : (
                    <input
                      type="number"
                      step="0.5"
                      value={it.mm}
                      onChange={(e) => handleUpdate(it.id, { mm: Number(e.target.value) })}
                      className="w-full p-1 border border-slate-200 rounded text-xs text-right font-medium"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    <span>{it.unitPrice.toLocaleString()}</span>
                  ) : (
                    <input
                      type="number"
                      step="100"
                      value={it.unitPrice}
                      onChange={(e) => handleUpdate(it.id, { unitPrice: Number(e.target.value) })}
                      className="w-full p-1 border border-slate-200 rounded text-xs text-right font-medium"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">
                  {it.contractAmount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {readOnly ? (
                    <span>{it.note}</span>
                  ) : (
                    <input
                      type="text"
                      value={it.note}
                      onChange={(e) => handleUpdate(it.id, { note: e.target.value })}
                      className="w-full p-1 border border-slate-200 rounded text-xs"
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => handleDelete(it.id)} className="text-slate-400 hover:text-rose-600 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-slate-400">
                  등록된 외주용역비 내역이 없습니다. (100% 당사 자체 수행 프로젝트)
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
            <tr>
              <td colSpan={5} className="px-3 py-2.5 text-center text-slate-700">
                외주용역비 합계 (A3)
              </td>
              <td className="px-3 py-2.5 text-right text-indigo-700 font-extrabold">
                {totalAmount.toLocaleString()} 천원
              </td>
              <td colSpan={readOnly ? 1 : 2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

