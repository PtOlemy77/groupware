'use client';

import React from 'react';
import { RiskEvaluationItem } from '@/types/groupware';
import { ShieldAlert, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

interface Props {
  items: RiskEvaluationItem[];
  onChangeItems: (items: RiskEvaluationItem[]) => void;
  totalBudget: number;
  contingencyRate: number;
  onChangeRate: (rate: number) => void;
  readOnly?: boolean;
}

export default function RiskContingencySheet({
  items,
  onChangeItems,
  totalBudget,
  contingencyRate,
  onChangeRate,
  readOnly,
}: Props) {
  // Calculate total risk exposure score
  const totalExposureScore = items.reduce((sum, it) => sum + it.calculatedExposure, 0);

  // Suggested contingency rate rule (구축 2% ~ 9%)
  let suggestedRate = 2.0;
  let riskLevel = '낮음 (안정적 구축)';
  if (totalExposureScore > 30) {
    suggestedRate = 5.0;
    riskLevel = '보통 (예비비 5% 권장)';
  }
  if (totalExposureScore > 45) {
    suggestedRate = 9.0;
    riskLevel = '높음 (고난도 리스크 과제, 예비비 9% 권장)';
  }

  const handleLevelChange = (id: string, newLevel: '상' | '중' | '하') => {
    const updated = items.map((it) => {
      if (it.id === id) {
        const score = newLevel === '상' ? 5 : newLevel === '중' ? 3 : 1;
        const calculatedExposure = score * it.exposureWeight;
        return { ...it, selectedLevel: newLevel, score, calculatedExposure };
      }
      return it;
    });
    onChangeItems(updated);

    // Auto-update contingency rate based on new score
    const newTotal = updated.reduce((sum, it) => sum + it.calculatedExposure, 0);
    const newRate = newTotal > 45 ? 9.0 : newTotal > 30 ? 5.0 : 2.0;
    onChangeRate(newRate);
  };

  const calculatedContingencyCost = Math.round(totalBudget * (contingencyRate / 100) * 10) / 10;

  return (
    <div className="space-y-6">
      {/* Top Risk KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">리스크 노출도 총점</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 flex items-baseline gap-2">
            {totalExposureScore} <span className="text-xs font-normal text-slate-400">/ 최대 60점</span>
          </div>
          <div className="text-xs text-indigo-600 font-medium mt-1">
            위험 평가 등급: {riskLevel}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <div className="text-xs font-semibold text-amber-800">적용 예비비율 (%)</div>
          <div className="text-2xl font-bold text-amber-600 mt-1 flex items-baseline gap-2">
            {contingencyRate} %
          </div>
          <div className="text-xs text-slate-500 mt-1">
            권장 예비비율: {suggestedRate}% (수동 조정 가능)
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <div className="text-xs font-semibold text-emerald-800">책정 예비비 금액</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {calculatedContingencyCost.toLocaleString()} 천원
          </div>
          <div className="text-xs text-slate-500 mt-1">
            총예산({totalBudget.toLocaleString()}천원) × {contingencyRate}%
          </div>
        </div>
      </div>

      {/* Risk Evaluation Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              ■ 예비비 (리스크 평가)
            </h3>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">예비비율 직접지정:</span>
              <input
                type="number"
                min="0"
                max="15"
                step="0.5"
                value={contingencyRate}
                onChange={(e) => onChangeRate(Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-bold text-amber-600 text-center"
              />
              <span className="text-xs text-slate-500">%</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 w-28">평가 영역</th>
                <th className="px-3 py-2">평가 항목 및 질문</th>
                <th className="px-3 py-2 text-center w-36">발생 위험도 선택</th>
                <th className="px-3 py-2 text-center w-20">평가 점수</th>
                <th className="px-3 py-2 text-center w-20">가중치</th>
                <th className="px-3 py-2 text-right w-28">리스크 노출도</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 font-bold text-slate-700">{it.category}</td>
                  <td className="px-3 py-2.5 text-slate-900">{it.question}</td>
                  <td className="px-3 py-2 text-center">
                    {readOnly ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          it.selectedLevel === '상'
                            ? 'bg-rose-100 text-rose-700'
                            : it.selectedLevel === '중'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {it.selectedLevel} ({it.score}점)
                      </span>
                    ) : (
                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-[11px]">
                        {(['하', '중', '상'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => handleLevelChange(it.id, lvl)}
                            className={`px-2.5 py-0.5 rounded font-bold transition ${
                              it.selectedLevel === lvl
                                ? lvl === '상'
                                  ? 'bg-rose-500 text-white shadow-2xs'
                                  : lvl === '중'
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : 'bg-emerald-500 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-slate-800">{it.score}</td>
                  <td className="px-3 py-2 text-center text-slate-500">× {it.exposureWeight}</td>
                  <td className="px-3 py-2 text-right font-extrabold text-indigo-600">
                    {it.calculatedExposure} 점
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-center text-slate-700">
                  리스크 노출도 총점 합계 (A7)
                </td>
                <td className="px-3 py-2.5 text-right text-indigo-700 font-extrabold text-sm">
                  {totalExposureScore} 점
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

