'use client';

import React from 'react';
import { ProductCostItem } from '@/types/groupware';
import { Plus, Trash2, Server, Package } from 'lucide-react';

interface Props {
  items: ProductCostItem[];
  onChangeItems: (items: ProductCostItem[]) => void;
  readOnly?: boolean;
}

export default function ProductCostSheet({ items, onChangeItems, readOnly }: Props) {
  const totalAmount = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

  const handleAddItem = () => {
    const newItem: ProductCostItem = {
      id: `prod_${Date.now()}`,
      category: 'H/W 장비',
      itemName: '',
      spec: '',
      qty: 1,
      unitPrice: 0,
      amount: 0,
      note: '',
    };
    onChangeItems([...items, newItem]);
  };

  const handleUpdate = (id: string, patch: Partial<ProductCostItem>) => {
    const updated = items.map((it) => {
      if (it.id === id) {
        const next = { ...it, ...patch };
        next.amount = next.qty * next.unitPrice;
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
            <Server className="w-4 h-4 text-indigo-600" />
            ■ 상품원가
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-500">상품원가 합계:</span>
            <span className="ml-2 font-bold text-sm text-indigo-600">
              {totalAmount.toLocaleString()} 천원
            </span>
          </div>
          {!readOnly && (
            <button
              onClick={handleAddItem}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              <Plus className="w-3.5 h-3.5" /> 품목 추가
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 w-28">구분</th>
              <th className="px-3 py-2">상품명</th>
              <th className="px-3 py-2">규격 / 사양</th>
              <th className="px-3 py-2 text-right w-20">수량</th>
              <th className="px-3 py-2 text-right w-28">단가 (천원)</th>
              <th className="px-3 py-2 text-right w-28">금액 (천원)</th>
              <th className="px-3 py-2">비고</th>
              {!readOnly && <th className="px-2 py-2 w-12 text-center">삭제</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50/50">
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="font-medium text-slate-700">{it.category}</span>
                  ) : (
                    <select
                      value={it.category}
                      onChange={(e) => handleUpdate(it.id, { category: e.target.value as any })}
                      className="w-full p-1 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option value="H/W 장비">H/W 장비</option>
                      <option value="S/W 패키지">S/W 패키지</option>
                      <option value="클라우드/인프라">클라우드/인프라</option>
                      <option value="기타자재">기타자재</option>
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="font-semibold text-slate-900">{it.itemName}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="예: GIS 공간DB 고성능 서버"
                      value={it.itemName}
                      onChange={(e) => handleUpdate(it.id, { itemName: e.target.value })}
                      className="w-full p-1 border border-slate-200 rounded text-xs"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="text-slate-600">{it.spec}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="예: 64 Core / 256GB RAM"
                      value={it.spec}
                      onChange={(e) => handleUpdate(it.id, { spec: e.target.value })}
                      className="w-full p-1 border border-slate-200 rounded text-xs"
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {readOnly ? (
                    <span>{it.qty}</span>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={it.qty}
                      onChange={(e) => handleUpdate(it.id, { qty: Number(e.target.value) })}
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
                  {(it.qty * it.unitPrice).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className="text-slate-500">{it.note}</span>
                  ) : (
                    <input
                      type="text"
                      placeholder="비고"
                      value={it.note}
                      onChange={(e) => handleUpdate(it.id, { note: e.target.value })}
                      className="w-full p-1 border border-slate-200 rounded text-xs"
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleDelete(it.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-slate-400">
                  등록된 상품원가 품목이 없습니다. (하드웨어/소프트웨어 납품 없을 시 0원)
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
            <tr>
              <td colSpan={5} className="px-3 py-2.5 text-center text-slate-700">
                상품원가 합계 (A1)
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

