'use client';
import { useState } from 'react';
import { readMaster } from '@/lib/api';
export default function UnitPriceSheet() {
  const [year, setYear] = useState(new Date().getFullYear());
  const prices = JSON.parse(readMaster('unit_prices') || '{}')[year] || [];
  return (
    <section className="space-y-4">
      <label>
        적용 연도
        <input
          type="number"
          min={2000}
          max={2099}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="ml-2 border rounded p-2"
        />
      </label>
      <p className="text-sm text-slate-600">
        기준정보에 저장된 노임단가입니다. 기존 계약은 저장 당시 단가를
        유지합니다.
      </p>
      {!prices.length && (
        <p>해당 연도의 기준정보가 없습니다. 기준정보 관리에서 등록하세요.</p>
      )}
      <table className="w-full">
        <thead>
          <tr>
            <th>직급</th>
            <th>등급</th>
            <th>월 단가 (천원)</th>
          </tr>
        </thead>
        <tbody>
          {prices.map((p: any) => (
            <tr key={p.id}>
              <td>{p.position}</td>
              <td>{p.grade}</td>
              <td>{Number(p.monthlyPrice).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
