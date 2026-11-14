'use client';
import { unitPrice as configuredPrice } from '@/lib/api';

import React, { useState, useEffect } from 'react';
import {
  FullContractDocument,
  getProjectOurBudget,
  Project,
  BusinessDeal,
  Employee,
  ManpowerPlanItem,
  inferTechnicalGrade,
  formatCurrencyManwon,
} from '@/types/groupware';
import {
  Calculator,
  Shield,
  CheckCircle2,
  FileText,
  Briefcase,
  TrendingUp,
  Sparkles,
  Calendar,
  Building2,
  Coins,
  Users,
  Check,
} from 'lucide-react';

interface Props {
  doc: FullContractDocument;
  onChangeDoc: (patch: Partial<FullContractDocument>) => void;
  projects?: Project[];
  deals?: BusinessDeal[];
  employees?: Employee[];
  readOnly?: boolean;
}

const QUICK_CLIENTS = ['농촌진흥청', '한국국토정보공사', '전기안전공사'];

function inferRoleByEmployee(emp: Employee): string {
  if (emp.position === '사장' || emp.position === '이사') return '사업총괄 / 감리대응';
  if (emp.position === '부장') return '총괄 PM / 아키텍트';
  if (emp.department.includes('품질')) return '품질관리 / DB검수 PL';
  if (emp.department.includes('사업')) return '사업관리 / 제안PM';
  if (emp.position === '과장') return 'GIS 엔진 / 플랫폼 PL';
  if (emp.position === '대리') return '공간DB / WebGIS 개발';
  return 'GIS API / 데이터 가공';
}

function calcMonthsBetween(start: string, end: string): number {
  if (!start || !end) return 8;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 8;
  const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  return Math.max(1, Math.min(120, diff));
}

function formatPeriodText(start: string, end: string): string {
  if (!start || !end) return '';
  const m = calcMonthsBetween(start, end);
  const sFormatted = start.replace(/-/g, '.');
  const eFormatted = end.replace(/-/g, '.');
  return `${sFormatted} ~ ${eFormatted} (${m}개월)`;
}

export default function SummarySheet({
  doc,
  onChangeDoc,
  projects = [],
  deals = [],
  employees = [],
  readOnly,
}: Props) {
  const [startDate, setStartDate] = useState<string>(doc.startDate || new Date().toLocaleDateString('en-CA'));
  const [endDate, setEndDate] = useState<string>(doc.endDate || new Date().toLocaleDateString('en-CA'));
  const [syncNotice, setSyncNotice] = useState<string>('');

  useEffect(() => {
    if (doc.startDate) setStartDate(doc.startDate);
    if (doc.endDate) setEndDate(doc.endDate);
  }, [doc.startDate, doc.endDate]);

  // 금액 변경 헬퍼
  const handleSupplyAmountChange = (newSup: number) => {
    const sup = Math.max(0, newSup);
    const vat = Math.round(sup * 0.1);
    // 입금계획(선금/중도금/잔금)도 비율에 맞춰 자동 재계산
    const updatedCashflows = doc.cashflowMilestones.map((cf) => {
      const cfSupply = Math.round(sup * (cf.ratePercent / 100));
      const cfVat = Math.round(cfSupply * 0.1);
      return {
        ...cf,
        supplyAmount: cfSupply,
        vatAmount: cfVat,
        totalAmount: cfSupply + cfVat,
      };
    });

    onChangeDoc({
      supplyAmount: sup,
      vatAmount: vat,
      cashflowMilestones: updatedCashflows,
    });
  };

  // 기간 프리셋 적용 (3개월, 6개월, 8개월, 12개월)
  const applyDurationPreset = (months: number) => {
    const sStr = startDate || doc.startDate || new Date().toLocaleDateString('en-CA');
    const s = new Date(sStr);
    if (isNaN(s.getTime())) return;
    const e = new Date(s.getFullYear(), s.getMonth() + months, 0); // 해당 월 말일
    const eStr = e.toISOString().split('T')[0];
    setEndDate(eStr);
    const periodText = formatPeriodText(sStr, eStr);
    onChangeDoc({
      startDate: sStr,
      endDate: eStr,
      contractPeriod: periodText,
    });
  };

  // 프로젝트 선택 시 계약 기본정보 + 투입인력(members) 자동 연동
  const handleSelectProject = (prj: Project) => {
    const supAmount = getProjectOurBudget(prj) * 10; // 만원 -> 천원 변환
    const vatAmount = Math.round(supAmount * 0.1);
    const sDate = prj.start_date;
    const eDate = prj.end_date;
    setStartDate(sDate);
    setEndDate(eDate);
    const periodStr = formatPeriodText(sDate, eDate);
    const durationMonths = calcMonthsBetween(sDate, eDate);

    let inferredClient = prj.client_name || doc.clientName;
    if (!inferredClient) {
      if (prj.name.includes('농촌진흥청') || prj.name.includes('농진청')) {
        inferredClient = '농촌진흥청';
      } else if (
        prj.name.includes('한국국토정보공사') ||
        prj.name.includes('국토정보공사') ||
        prj.name.includes('LX')
      ) {
        inferredClient = '한국국토정보공사';
      } else if (prj.name.includes('전기안전공사')) {
        inferredClient = '전기안전공사';
      } else {
        const matchedDeal = deals.find((d) => prj.name.includes(d.client_name));
        if (matchedDeal) inferredClient = matchedDeal.client_name;
      }
    }

    // 프로젝트 참여 인원(prj.members)을 사내 직원 DB와 매칭하여 투입인력(manpowerPlans) 자동 생성
    const projectEmployees = [...new Set([prj.pm_id, ...(prj.member_ids || [])].filter(Boolean))].map(id => employees.find(e => e.id === id)).filter((e): e is Employee => !!e);

    // 프로젝트 실제 수행 개월 수에 맞춰 전체 기간 공수 배열 생성
    const activeMonths: number[] = Array.from({ length: durationMonths }, () => 1);
    const defaultMM = activeMonths.reduce((a, b) => a + b, 0);

    const newManpowerPlans: ManpowerPlanItem[] = projectEmployees.map((matchedEmp, idx) => {
      const mName = matchedEmp.name;
      const pos = matchedEmp ? matchedEmp.position : idx === 0 ? '부장' : '과장';
      const unitPrice = configuredPrice(pos, new Date(prj.start_date).getFullYear());
      const grade = inferTechnicalGrade(pos);
      const role = matchedEmp
        ? mName === prj.pm_name
          ? '총괄 PM'
          : inferRoleByEmployee(matchedEmp)
        : 'GIS 개발';

      return {
        id: `mp_prj_${prj.id}_${idx}`,
        type: '당사',
        grade,
        role,
        employeeId: matchedEmp?.id,
        name: mName,
        position: pos,
        months: [...activeMonths],
        totalMM: defaultMM,
        unitPrice,
        laborCost: defaultMM * unitPrice,
      };
    });

    // 입금계획도 공급가 기준으로 자동 재산출
    const updatedCashflows = doc.cashflowMilestones.map((cf) => {
      const cfSupply = Math.round(supAmount * (cf.ratePercent / 100));
      const cfVat = Math.round(cfSupply * 0.1);
      return {
        ...cf,
        supplyAmount: cfSupply,
        vatAmount: cfVat,
        totalAmount: cfSupply + cfVat,
      };
    });

    onChangeDoc({
      linkedProjectId: prj.id,
      linkedProjectCode: prj.code,
      ourShareRate: prj.share_rate ?? 100,
      title: prj.name,
      clientName: inferredClient,
      startDate: sDate,
      endDate: eDate,
      contractPeriod: periodStr,
      supplyAmount: supAmount,
      vatAmount,
      manpowerPlans: newManpowerPlans.length > 0 ? newManpowerPlans : doc.manpowerPlans,
      cashflowMilestones: updatedCashflows,
    });

    setSyncNotice(
      `프로젝트 [${prj.code}] 기본 정보 및 참여인력(${projectEmployees.length}명)이 투입인력 시트에 자동 반영되었습니다.`
    );
    setTimeout(() => setSyncNotice(''), 5000);
  };

  // 영업 수주 파이프라인(BusinessDeal) 선택 시 자동 연동
  const handleSelectDeal = (deal: BusinessDeal) => {
    const supAmount = deal.amount * 10; // 만원 -> 천원
    const vatAmount = Math.round(supAmount * 0.1);
    const updatedCashflows = doc.cashflowMilestones.map((cf) => {
      const cfSupply = Math.round(supAmount * (cf.ratePercent / 100));
      const cfVat = Math.round(cfSupply * 0.1);
      return {
        ...cf,
        supplyAmount: cfSupply,
        vatAmount: cfVat,
        totalAmount: cfSupply + cfVat,
      };
    });

    onChangeDoc({
      title: deal.title,
      clientName: deal.client_name,
      contractType: deal.deal_type || '용역구축',
      supplyAmount: supAmount,
      vatAmount,
      cashflowMilestones: updatedCashflows,
    });

    setSyncNotice(`수주 사업기회 [${deal.title}]의 발주처 및 계약금액이 자동 입력되었습니다.`);
    setTimeout(() => setSyncNotice(''), 5000);
  };

  return (
    <div className="space-y-6">
      {/* 2. 계약일반현황 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            ■ 계약일반현황
          </span>
          <span className="text-xs text-slate-500">금액 단위: 천원 (VAT 별도)</span>
        </div>

        <div className="p-5 space-y-5 text-xs">
          {/* Row 1: 계약명 & 고객사 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-1.5">
              <label className="block font-bold text-slate-700">
                계약명 (프로젝트 과제명)
              </label>
              {readOnly ? (
                <div className="p-2.5 rounded-lg bg-slate-50 font-bold text-slate-900 border border-slate-200">
                  {doc.title}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="계약명 또는 상단 프로젝트 불러오기 클릭"
                  value={doc.title}
                  onChange={(e) => onChangeDoc({ title: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              )}
            </div>

            <div className="lg:col-span-5 space-y-1.5">
              <label className="block font-bold text-slate-700 flex items-center justify-between">
                <span>고객사 (발주처)</span>
                {!readOnly && <span className="text-xs font-normal text-slate-400">클릭 시 자동입력</span>}
              </label>
              {readOnly ? (
                <div className="p-2.5 rounded-lg bg-slate-50 font-semibold text-slate-900 border border-slate-200">
                  {doc.clientName}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="발주처 입력 또는 아래 칩 선택"
                    value={doc.clientName}
                    onChange={(e) => onChangeDoc({ clientName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {QUICK_CLIENTS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onChangeDoc({ clientName: c })}
                        className={`px-2 py-0.5 rounded-md text-xs font-medium border transition ${
                          doc.clientName === c
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 2: 계약공급가액 & 계약기간 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3 border-t border-slate-100">
            {/* 공급가액 스마트 입력 */}
            <div className="lg:col-span-6 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-indigo-600" />
                  계약 공급가액 (천원, VAT 별도)
                </label>
                <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  = {formatCurrencyManwon(Math.round(doc.supplyAmount / 10))} (VAT포함:{' '}
                  {formatCurrencyManwon(Math.round((doc.supplyAmount + doc.vatAmount) / 10))})
                </span>
              </div>

              {readOnly ? (
                <div className="p-2.5 rounded-lg bg-slate-50 font-extrabold text-indigo-700 text-sm border border-slate-200">
                  {doc.supplyAmount.toLocaleString()} 천원
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="1000"
                      value={doc.supplyAmount}
                      onChange={(e) => handleSupplyAmountChange(Number(e.target.value))}
                      className="flex-1 px-3.5 py-2 text-sm font-extrabold text-indigo-700 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                    />
                    <span className="font-bold text-slate-600 shrink-0">천원</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-slate-400 mr-1">빠른 금액:</span>
                    {[
                      { label: '+1억', delta: 100000 },
                      { label: '+5천만', delta: 50000 },
                      { label: '+1천만', delta: 10000 },
                      { label: '-1천만', delta: -10000 },
                      { label: '4.5억(기본)', set: 450000 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() =>
                          handleSupplyAmountChange(
                            btn.set !== undefined ? btn.set : doc.supplyAmount + (btn.delta || 0)
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-semibold text-xs transition border border-slate-200"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 계약기간 달력 및 개월수 프리셋 */}
            <div className="lg:col-span-6 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  계약 수행 기간
                </label>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                  {doc.contractPeriod}
                </span>
              </div>

              {readOnly ? (
                <div className="p-2.5 rounded-lg bg-slate-50 font-semibold text-slate-900 border border-slate-200">
                  {doc.contractPeriod}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5">
                      <span className="text-xs text-slate-400 font-semibold">착수:</span>
                      <input
                        type="date"
                        value={startDate || doc.startDate || ''}
                        onChange={(e) => {
                          const s = e.target.value;
                          setStartDate(s);
                          onChangeDoc({
                            startDate: s,
                            contractPeriod: formatPeriodText(s, endDate || doc.endDate || s),
                          });
                        }}
                        className="flex-1 text-xs font-semibold text-slate-800 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5">
                       <span className="text-xs text-slate-400 font-semibold">완료:</span>
                      <input
                        type="date"
                        value={endDate || doc.endDate || ''}
                        onChange={(e) => {
                          const end = e.target.value;
                          setEndDate(end);
                          onChangeDoc({
                            endDate: end,
                            contractPeriod: formatPeriodText(startDate || doc.startDate || end, end),
                          });
                        }}
                        className="flex-1 text-xs font-semibold text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-slate-400 mr-1">기간 자동완성:</span>
                    {[3, 6, 8, 10, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => applyDurationPreset(m)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-semibold text-xs transition border border-slate-200"
                      >
                        {m}개월
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: 계약 세부 조건 (결제방식, 하자보증, 지체상금율, 지분율) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block font-bold text-slate-600 mb-1">대금지급조건</label>
              <select
                disabled={readOnly}
                value={doc.paymentTerms}
                onChange={(e) => onChangeDoc({ paymentTerms: e.target.value })}
                className="w-full p-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
              >
                <option value="현금">현금 (계좌이체)</option>
                <option value="나라장터 대금지급">조달청 나라장터 직불</option>
                <option value="어음">기업구매자금 / 어음</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">하자보증기간</label>
              <select
                disabled={readOnly}
                value={doc.warrantyPeriod}
                onChange={(e) => onChangeDoc({ warrantyPeriod: e.target.value })}
                className="w-full p-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
              >
                <option value="12개월">12개월 (1년 무상하자)</option>
                <option value="24개월">24개월 (2년)</option>
                <option value="6개월">6개월</option>
                <option value="해당없음">해당없음</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">지체상금율 (%)</label>
              <select
                disabled={readOnly}
                value={doc.delayPenaltyRate}
                onChange={(e) => onChangeDoc({ delayPenaltyRate: Number(e.target.value) })}
                className="w-full p-2 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
              >
                <option value={0.15}>0.15% (SW용역 표준)</option>
                <option value={0.075}>0.075% (물품 납품)</option>
                <option value={0.25}>0.25% (학술/연구)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">당사 지분율 (%)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={10}
                  max={100}
                  disabled={readOnly}
                  value={doc.ourShareRate}
                  onChange={(e) => onChangeDoc({ ourShareRate: Number(e.target.value) })}
                  className="w-full p-2 rounded-xl border border-slate-300 bg-white font-bold text-indigo-600 text-right"
                />
                <span className="font-bold text-slate-500">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 손익계획 (엑셀 계산식 완벽 연동) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
          <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-indigo-600" />
            ■ 종합 손익계획표
          </span>
          <span className="text-xs text-indigo-800 font-semibold">
            당사이익율:{' '}
            <span
              className={`text-sm font-extrabold ml-1 ${
                doc.profitRate >= 15 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {doc.profitRate} %
            </span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">구분</th>
                <th className="px-4 py-2.5">항목 (엑셀 계산식)</th>
                <th className="px-4 py-2.5 text-right">금액 (천원)</th>
                <th className="px-4 py-2.5 text-right">매출 대비 비중(%)</th>
                <th className="px-4 py-2.5">연동 세부 시트 및 산출 기준</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {/* A: 매출액 */}
              <tr className="bg-indigo-50/50 font-bold">
                <td className="px-4 py-2.5 text-indigo-900">A</td>
                <td className="px-4 py-2.5 text-indigo-900">매출액 (공급가액)</td>
                <td className="px-4 py-2.5 text-right text-indigo-900 text-sm">
                  {doc.supplyAmount.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right text-indigo-900">100.0 %</td>
                <td className="px-4 py-2.5 text-slate-500 font-normal">발주처 계약금액 (VAT 별도)</td>
              </tr>

              {/* B: 당사 매출원가 */}
              <tr className="bg-slate-50/30">
                <td className="px-4 py-2 text-slate-600 font-bold">B</td>
                <td className="px-4 py-2 font-bold text-slate-900">당사 매출원가 (C + D + E + F + AS)</td>
                <td className="px-4 py-2 text-right font-bold text-slate-900">
                  {doc.totalBudget.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-slate-600">
                  {doc.supplyAmount > 0 ? Math.round((doc.totalBudget / doc.supplyAmount) * 1000) / 10 : 0} %
                </td>
                <td className="px-4 py-2 text-slate-500">인건비 + 직접경비 + 외주비 + 상품원가</td>
              </tr>

              {/* C: 상품원가 */}
              <tr className="text-slate-600">
                <td className="px-4 py-1.5 pl-8 text-slate-400">C</td>
                <td className="px-4 py-1.5">└ 1. 상품원가 (H/W, S/W 라이선스)</td>
                <td className="px-4 py-1.5 text-right font-medium">{doc.productCostTotal.toLocaleString()}</td>
                <td className="px-4 py-1.5 text-right">
                  {doc.supplyAmount > 0 ? Math.round((doc.productCostTotal / doc.supplyAmount) * 1000) / 10 : 0} %
                </td>
                <td className="px-4 py-1.5 text-slate-400">시트 [1.상품원가] 집계 연동</td>
              </tr>

              {/* D: 외주비 */}
              <tr className="text-slate-600">
                <td className="px-4 py-1.5 pl-8 text-slate-400">D</td>
                <td className="px-4 py-1.5">└ 3. 외주용역비</td>
                <td className="px-4 py-1.5 text-right font-medium">{doc.outsourcingTotal.toLocaleString()}</td>
                <td className="px-4 py-1.5 text-right">
                  {doc.supplyAmount > 0 ? Math.round((doc.outsourcingTotal / doc.supplyAmount) * 1000) / 10 : 0} %
                </td>
                <td className="px-4 py-1.5 text-slate-400">시트 [3.외주비] 집계 연동</td>
              </tr>

              {/* E: 당사인건비 */}
              <tr className="text-slate-700 bg-slate-50/40">
                <td className="px-4 py-1.5 pl-8 font-semibold text-indigo-600">E</td>
                <td className="px-4 py-1.5 font-semibold text-slate-900">
                  └ 4. 당사 인건비 ({doc.manpowerPlans.reduce((s, m) => s + m.totalMM, 0).toFixed(1)} M/M)
                </td>
                <td className="px-4 py-1.5 text-right font-bold text-slate-900">
                  {doc.laborCostTotal.toLocaleString()}
                </td>
                <td className="px-4 py-1.5 text-right font-medium">
                  {doc.supplyAmount > 0 ? Math.round((doc.laborCostTotal / doc.supplyAmount) * 1000) / 10 : 0} %
                </td>
                <td className="px-4 py-1.5 text-indigo-600">
                  시트 [2.투입인력] 사내 직원({doc.manpowerPlans.length}명) 단가표 연동
                </td>
              </tr>

              {/* F: 직접경비 */}
              <tr className="text-slate-700">
                <td className="px-4 py-1.5 pl-8 text-slate-400">F</td>
                <td className="px-4 py-1.5">└ 5. 직접경비 (식대/회의비/출장비 등)</td>
                <td className="px-4 py-1.5 text-right font-medium">{doc.directExpenseTotal.toLocaleString()}</td>
                <td className="px-4 py-1.5 text-right">
                  {doc.supplyAmount > 0 ? Math.round((doc.directExpenseTotal / doc.supplyAmount) * 1000) / 10 : 0} %
                </td>
                <td className="px-4 py-1.5 text-slate-400">시트 [5.직접경비] 계정과목 집계</td>
              </tr>

              {/* G: 당사 매출이익 */}
              <tr className="font-semibold">
                <td className="px-4 py-2 text-slate-500">G</td>
                <td className="px-4 py-2">당사 매출이익 (A - B)</td>
                <td className="px-4 py-2 text-right font-bold text-slate-900">
                  {doc.salesProfit.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  {doc.supplyAmount > 0 ? Math.round((doc.salesProfit / doc.supplyAmount) * 1000) / 10 : 0} %
                </td>
                <td className="px-4 py-2 text-slate-500">매출액 - 총매출원가</td>
              </tr>

              {/* H: 총예산 */}
              <tr>
                <td className="px-4 py-2 text-slate-500">H</td>
                <td className="px-4 py-2">총예산 집행 승인 한도 (= B)</td>
                <td className="px-4 py-2 text-right font-bold text-slate-900">
                  {doc.totalBudget.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  {doc.supplyAmount > 0 ? Math.round((doc.totalBudget / doc.supplyAmount) * 1000) / 10 : 0} %
                </td>
                <td className="px-4 py-2 text-slate-500">프로젝트 집행 승인 대상 총액</td>
              </tr>

              {/* I: 예비비 */}
              <tr className="bg-amber-50/50 text-amber-900 font-semibold">
                <td className="px-4 py-2 text-amber-800">I</td>
                <td className="px-4 py-2">예비비 (총예산 × {doc.contingencyRate}%)</td>
                <td className="px-4 py-2 text-right font-bold text-amber-700">
                  {doc.contingencyCost.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right font-semibold">
                  {doc.supplyAmount > 0 ? Math.round((doc.contingencyCost / doc.supplyAmount) * 1000) / 10 : 0} %
                </td>
                <td className="px-4 py-2 text-amber-700">시트 [7.예비비] 리스크 노출도 평가 자동산출</td>
              </tr>

              {/* J: 프로젝트 순손익 */}
              <tr className="bg-emerald-50 text-emerald-950 font-bold border-t-2 border-emerald-300">
                <td className="px-4 py-3 text-emerald-800 text-sm">J</td>
                <td className="px-4 py-3 text-emerald-900 text-sm">프로젝트 순손익 (G - I)</td>
                <td className="px-4 py-3 text-right text-emerald-900 text-base">
                  {doc.projectNetProfit.toLocaleString()} 천원
                </td>
                <td className="px-4 py-3 text-right text-emerald-900 text-base">
                  {doc.profitRate} %
                </td>
                <td className="px-4 py-3 text-emerald-800 font-semibold">
                  당사이익율 = 프로젝트 손익 ÷ 매출액 × 100
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
