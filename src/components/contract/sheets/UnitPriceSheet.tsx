'use client';

import React from 'react';
import { STANDARD_UNIT_PRICES } from '@/types/groupware';
import { Award, Info } from 'lucide-react';

export default function UnitPriceSheet() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-indigo-600" />
            ■ 기준 노임단가표
          </h3>
        </div>

        <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" /> 사내 단가 확정 규정
        </span>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-2.5">직급명</th>
              <th className="px-4 py-2.5">기술 등급</th>
              <th className="px-4 py-2.5 text-right w-36">2026년 기준단가 (천원/MM)</th>
              <th className="px-4 py-2.5 text-right w-36">2027년 기준단가 (천원/MM)</th>
              <th className="px-4 py-2.5">담당 주요 업무 및 적용 범위</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {STANDARD_UNIT_PRICES.map((p) => (
              <tr key={p.position} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-bold text-slate-900">{p.position}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {p.grade}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-indigo-600 text-sm">
                  {p.price2026.toLocaleString()} 천원
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">
                  {p.price2027.toLocaleString()} 천원
                </td>
                <td className="px-4 py-3 text-slate-600">{p.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
        <div className="font-semibold text-slate-800">※ 노임단가 산정 및 적용 안내:</div>
        <div>1. 당사 인건비(투입인력 시트) 산출 시 해당 직급의 2026년 단가가 기본 자동 적용됩니다.</div>
        <div>2. 고객사의 SW 기술자 등급별 계약 단가와 차이가 발생하는 경우, 당사 인건비 실원가 기준으로 손익계획을 수립합니다.</div>
      </div>
    </div>
  );
}

