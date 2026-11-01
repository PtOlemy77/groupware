'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Project,
  Approval,
  AuthUser,
  Employee,
  isPmOrAbove,
  isExecutiveOrAbove,
  normalizeUserRole,
} from '@/types/groupware';
import { normalizeProjectStatus } from '@/components/dashboard/DashboardView';
import {
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  Edit3,
  Save,
  Crown,
  Briefcase,
  AlertCircle,
  Sparkles,
  Check,
  ChevronRight,
  Layers,
  UserCheck,
} from 'lucide-react';

interface Props {
  projects: Project[];
  approvals: Approval[];
  currentUser: AuthUser;
  employees?: Employee[];
  initialSelectedProjectId?: number | null;
  onRefresh: () => Promise<void>;
}

export type ReportType = '주간보고' | '월간보고';

export interface ProjectReportItem {
  projectId: number;
  projectCode: string;
  projectName: string;
  pmName: string;
  projectStage: string;
  progress: number;
  healthStatus: '정상' | '주의' | '지연';
  thisPeriodWork: string; // 금주 수행실적 (또는 당월 수행실적)
  nextPeriodPlan: string; // 차주 수행계획 (또는 차월 수행계획)
  issueAndSupport: string; // 주요 이슈 및 이사/경영진 지원요청
  directorNote: string; // 이사(사업본부장) 보완 코멘트
  pmSubmitted: boolean;
  updatedAt: string;
}

export interface ConsolidatedReportPayload {
  reportType: ReportType;
  periodKey: string; // 예: '2026-10-W5', '2026-10-M'
  periodLabel: string; // 예: '2026년 10월 5주차 (10.26 ~ 10.30)'
  overallStage: 'PM작성중' | '이사취합보완중' | '사장님보고완료' | '사장님확인완료';
  directorName: string;
  directorSummary: string; // 이사가 취합·보완하여 사장님께 올리는 총괄 요약
  ceoFeedback: string; // 사장님 확인 코멘트
  submittedToCeoAt?: string;
  confirmedByCeoAt?: string;
  items: ProjectReportItem[];
}

const WEEKLY_PERIODS = [
  { key: '2026-10-W5', label: '2026년 10월 5주차 (10.26 ~ 10.30)' },
  { key: '2026-10-W4', label: '2026년 10월 4주차 (10.19 ~ 10.23)' },
  { key: '2026-11-W1', label: '2026년 11월 1주차 (11.02 ~ 11.06)' },
];

const MONTHLY_PERIODS = [
  { key: '2026-10-M', label: '2026년 10월 월간보고' },
  { key: '2026-09-M', label: '2026년 9월 월간보고' },
  { key: '2026-11-M', label: '2026년 11월 월간보고' },
];

// 프로젝트별 기본 초기 금주/차주 내용 생성기
function buildDefaultItemForProject(prj: Project, reportType: ReportType): ProjectReportItem {
  const isWeekly = reportType === '주간보고';
  const stage = normalizeProjectStatus(prj.status);

  if (prj.name.includes('LX주요 업무시스템')) {
    return {
      projectId: prj.id,
      projectCode: prj.code,
      projectName: prj.name,
      pmName: prj.pm_name || '김성철',
      projectStage: stage,
      progress: prj.progress || 82,
      healthStatus: '정상',
      thisPeriodWork: isWeekly
        ? '• 지적측량·국토정보 연계 API 응답속도 튜닝 완료\n• 10월 정기 보안패치 및 DB 백업 무결성 점검 완료'
        : '• 10월 정기 유지관리 SLA 100% 달성 (장애 0건)\n• 하반기 공간정보 레이어 갱신 및 웹취약점 조치 완료',
      nextPeriodPlan: isWeekly
        ? '• 11월분 공간정보 통계 배치 스케줄러 사전 점검\n• 현업 부서 기능개선 요청사항(SR) 4건 반영 배포'
        : '• 11월 대용량 공간DB 인덱스 리빌딩 및 연말 산출물 초안 점검\n• 차년도 유지관리 연장 계약 사전 협의',
      issueAndSupport: '특이사항 없음 (안정적 운영 중)',
      directorNote: '연말 성과보고회 대비 운영 성과지표(SLA) 정리 병행 요망',
      pmSubmitted: true,
      updatedAt: '2026-10-30 14:20',
    };
  }

  if (prj.name.includes('스마트 충북')) {
    return {
      projectId: prj.id,
      projectCode: prj.code,
      projectName: prj.name,
      pmName: prj.pm_name || '박용묵',
      projectStage: stage,
      progress: prj.progress || 75,
      healthStatus: '정상',
      thisPeriodWork: isWeekly
        ? '• 충북도청 공간정보 플랫폼 항공영상 타일 캐시 고도화\n• 시·군 담당자 권한관리 모듈 개선 반영'
        : '• 충북 11개 시·군 공간데이터 정합성 일괄 정비 완료\n• 3분기 정기점검 보고서 제출 및 검수 승인',
      nextPeriodPlan: isWeekly
        ? '• 충북도청 정보화담당관실 월례 운영보고 진행\n• 모바일 현장조사 지도 레이어 속도 개선'
        : '• 동절기 제설·재난안전 주제도 레이어 신규 탑재\n• 하반기 만족도 조사 실시',
      issueAndSupport: '시·군 연계 서버 방화벽 정책 변경 협조 공문 발송 완료',
      directorNote: '충북도청 내년 신규 고도화 예산 편성 동향 파악 완료',
      pmSubmitted: true,
      updatedAt: '2026-10-30 15:10',
    };
  }

  if (prj.name.includes('디지털트윈 기반 지적공간정보')) {
    return {
      projectId: prj.id,
      projectCode: prj.code,
      projectName: prj.name,
      pmName: prj.pm_name || '우광일',
      projectStage: stage,
      progress: prj.progress || 60,
      healthStatus: '정상',
      thisPeriodWork: isWeekly
        ? '• 3차원 입체지적 공간객체(3D Tiles) 경량화 변환 모듈 구현 완료\n• WebGL 기반 디지털트윈 가시화 뷰어 중간 시연 완료'
        : '• 디지털트윈 공간분석 엔진 프로토타입 구축 및 중간보고회 완료\n• 지적-건축물 통합 공간DB 스키마 확정',
      nextPeriodPlan: isWeekly
        ? '• 드론 정사영상 및 지하시설물 3D 중첩 정밀도 테스트\n• 공간분석 시뮬레이션(일조권·가시권) UI 연동'
        : '• 시범지역 대용량 3D 데이터 적재 및 성능 부하테스트\n• 감리 대비 단계별 산출물 현행화',
      issueAndSupport: '기술연구소 3D 렌더링 셰이더 최적화 기술지원 협업 중',
      directorNote: '중간보고 시 발주처(LX) 호평, 11월 감리 일정에 맞춰 품질검수팀 사전 점검 배정',
      pmSubmitted: true,
      updatedAt: '2026-10-30 16:05',
    };
  }

  if (prj.name.includes('행정안전부 차세대 주소기반')) {
    return {
      projectId: prj.id,
      projectCode: prj.code,
      projectName: prj.name,
      pmName: prj.pm_name || '박용묵',
      projectStage: stage,
      progress: prj.progress || 30,
      healthStatus: '주의',
      thisPeriodWork: isWeekly
        ? '• 제안요청서(RFP) 요구사항 상세 분석 및 기술제안서 핵심 아키텍처 작성\n• 계약품의서 사전 원가 및 투입인력(4명) 편성 검토'
        : '• 행안부 사물주소·입체주소 데이터 모델링 사전 PoC 검증\n• 컨소시엄 지분율 및 역할 분담 합의',
      nextPeriodPlan: isWeekly
        ? '• 제안서 정량/정성 평가 항목별 증빙자료 마감\n• 발표자료(PPT) 스토리보드 리뷰 및 모의 발표'
        : '• 입찰 제안서 최종 제출 및 기술평가 발표 수행\n• 우선협상 선정 후 기술협상 착수',
      issueAndSupport: '제안서 디자인 및 인쇄 일정(11월 초) 경영지원팀 협조 요청',
      directorNote: '수주 핵심 전략과제이므로 대표이사님 모의발표 참관 일정 조율 완료',
      pmSubmitted: true,
      updatedAt: '2026-10-30 16:40',
    };
  }

  return {
    projectId: prj.id,
    projectCode: prj.code,
    projectName: prj.name,
    pmName: prj.pm_name || '담당PM',
    projectStage: stage,
    progress: prj.progress || 10,
    healthStatus: '정상',
    thisPeriodWork: isWeekly
      ? `• ${prj.name} 주간 공정 점검 및 요구사항 정의 진행`
      : `• ${prj.name} 당월 계획 공정 수행 및 산출물 작성`,
    nextPeriodPlan: isWeekly
      ? `• 차주 핵심 모듈 설계 및 발주처 정기 공정 회의`
      : `• 차월 주요 마일스톤 이행 및 품질 점검`,
    issueAndSupport: '특이사항 없음',
    directorNote: '',
    pmSubmitted: false,
    updatedAt: '2026-10-30 10:00',
  };
}

export default function WeeklyMonthlyReportView({
  projects,
  approvals,
  currentUser,
  employees = [],
  initialSelectedProjectId,
  onRefresh,
}: Props) {
  const [reportType, setReportType] = useState<ReportType>('주간보고');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('2026-10-W5');

  const userRole = normalizeUserRole(currentUser.role, currentUser.position);
  const canWritePmReport = isPmOrAbove(currentUser.role, currentUser.position);
  const canConsolidateAsDirector = isExecutiveOrAbove(currentUser.role, currentUser.position);
  const isCeo =
    currentUser.position === '사장' ||
    currentUser.position === '대표이사' ||
    currentUser.name === '권우석';

  // 로그인한 사용자가 담당하는 프로젝트 찾기 (우선 매핑)
  const myDefaultProject = useMemo(() => {
    const trimmedName = currentUser.name?.trim();
    return (
      projects.find((p) => p.pm_name?.trim() === trimmedName) ||
      projects.find((p) => p.members?.includes(trimmedName)) ||
      projects[0]
    );
  }, [projects, currentUser.name]);

  // 뷰 모드: 메뉴 진입 시 즉시 작성할 수 있도록 PM 및 이사는 'pm_edit'를 기본으로 활성화
  // (대표이사 사장님은 전체 종합 보고서 승인용 'consolidated'로 진입)
  const [viewMode, setViewMode] = useState<'consolidated' | 'pm_edit'>(
    initialSelectedProjectId ? 'pm_edit' : isCeo ? 'consolidated' : 'pm_edit'
  );
  const [selectedProjectId, setSelectedProjectId] = useState<number>(
    initialSelectedProjectId || myDefaultProject?.id || (projects[0]?.id ?? 0)
  );
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const periods = reportType === '주간보고' ? WEEKLY_PERIODS : MONTHLY_PERIODS;
  const currentPeriodObj =
    periods.find((p) => p.key === selectedPeriodKey) || periods[0];

  // 보고유형 변경 시 기본 주차/월 키 전환
  const handleSwitchReportType = (type: ReportType) => {
    setReportType(type);
    setSelectedPeriodKey(type === '주간보고' ? WEEKLY_PERIODS[0].key : MONTHLY_PERIODS[0].key);
  };

  // DB(approvals)에서 현재 선택된 (reportType + periodKey) 보고서 레코드 찾기
  const matchedApproval = useMemo(() => {
    const expectedDocNo = `RPT-${selectedPeriodKey}`;
    return approvals.find(
      (a) =>
        a.doc_no === expectedDocNo ||
        (a.category === reportType && a.project_name === selectedPeriodKey)
    );
  }, [approvals, reportType, selectedPeriodKey]);

  // 현재 보고서 상태 구성 (DB 레코드가 있으면 파싱하고, 새로 추가된 프로젝트도 자동 병합)
  const currentReport = useMemo<ConsolidatedReportPayload>(() => {
    let parsed: Partial<ConsolidatedReportPayload> = {};
    if (matchedApproval && matchedApproval.items_json && matchedApproval.items_json.trim().startsWith('{')) {
      try {
        parsed = JSON.parse(matchedApproval.items_json);
      } catch {
        parsed = {};
      }
    }

    const savedItemsMap = new Map<number, ProjectReportItem>();
    if (Array.isArray(parsed.items)) {
      parsed.items.forEach((it) => {
        savedItemsMap.set(it.projectId, it);
      });
    }

    const mergedItems: ProjectReportItem[] = projects.map((prj) => {
      const saved =
        savedItemsMap.get(prj.id) ||
        (parsed.items || []).find((it) => it.projectName === prj.name);
      if (saved) {
        return {
          ...saved,
          projectId: prj.id,
          projectCode: prj.code,
          projectName: prj.name,
          pmName: prj.pm_name,
          projectStage: normalizeProjectStatus(prj.status),
        };
      }
      return buildDefaultItemForProject(prj, reportType);
    });

    return {
      reportType,
      periodKey: currentPeriodObj.key,
      periodLabel: currentPeriodObj.label,
      overallStage: parsed.overallStage || '이사취합보완중',
      directorName: parsed.directorName || '박용묵 이사',
      directorSummary:
        parsed.directorSummary ??
        (reportType === '주간보고'
          ? '1. 수행 중인 3개 본사업(LX 유지관리, 스마트 충북, LX 디지털트윈) 모두 계획 공정 대비 정상 순항 중입니다.\n2. 행안부 차세대 주소기반 DB 구축 사업은 제안서 마감 단계로 본부장 직접 점검 체제로 전환하여 수주 총력 대응 중입니다.'
          : '1. 10월 당월 사업본부 전체 매출 집행 및 수행 공정률 목표치(100%) 정상 달성하였습니다.\n2. 11월 감리(LX 디지털트윈) 및 신규 입찰(행안부 주소DB) 집중 지원을 위해 연구소·품질팀 협업 체계를 가동합니다.'),
      ceoFeedback:
        parsed.ceoFeedback ??
        '수행 과제 품질관리에 만전을 기해주고, 행안부 제안 발표 준비에 전사 역량을 집중해 주기 바랍니다.',
      submittedToCeoAt: parsed.submittedToCeoAt || '2026-10-30 17:30',
      confirmedByCeoAt: parsed.confirmedByCeoAt || '',
      items: mergedItems,
    };
  }, [matchedApproval, projects, reportType, currentPeriodObj]);

  // 로컬 편집 상태
  const [draftReport, setDraftReport] = useState<ConsolidatedReportPayload>(currentReport);

  useEffect(() => {
    setDraftReport(currentReport);
  }, [currentReport]);

  useEffect(() => {
    if (initialSelectedProjectId) {
      setSelectedProjectId(initialSelectedProjectId);
      setViewMode('pm_edit');
    }
  }, [initialSelectedProjectId]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // DB에 현재 주간/월간 보고서 레코드가 아직 없으면 최초 1회 자동 동기화 저장
  useEffect(() => {
    if (!matchedApproval && projects.length > 0 && selectedPeriodKey === '2026-10-W5') {
      const autoSeed = async () => {
        try {
          await fetch('http://localhost:8080/api/groupware', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              module: 'approvals',
              action: 'create',
              data: {
                doc_no: `RPT-${ currentReport.periodKey }`,
                category: currentReport.reportType,
                title: `[${currentReport.reportType}] ${currentReport.periodLabel}`,
                requester: '박용묵',
                requester_position: '이사',
                department: '사업본부',
                created_at: '2026-10-30',
                status: '이사취합보완중',
                amount: 0,
                project_name: currentReport.periodKey,
                vendor: '사업본부 전체 프로젝트',
                payment_method: currentReport.reportType,
                purpose: currentReport.directorSummary,
                items_json: JSON.stringify(currentReport),
                reviewer_comment: currentReport.ceoFeedback,
                approved_by: '권우석 사장',
              },
            }),
          });
          await onRefresh();
        } catch (e) {
          console.error('Failed to seed report:', e);
        }
      };
      autoSeed();
    }
  }, [matchedApproval, projects.length, selectedPeriodKey]);

  // DB 저장 공통 함수
  const saveReportToDb = async (
    updatedPayload: ConsolidatedReportPayload,
    successMessage: string
  ) => {
    setSaving(true);
    try {
      const docNo = `RPT-${updatedPayload.periodKey}`;
      await fetch('http://localhost:8080/api/groupware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'approvals',
          action: matchedApproval ? 'update' : 'create',
          id: matchedApproval?.id,
          data: {
            doc_no: docNo,
            category: updatedPayload.reportType,
            title: `[${updatedPayload.reportType}] ${updatedPayload.periodLabel}`,
            requester: updatedPayload.directorName.split(' ')[0] || '박용묵',
            requester_position: '이사',
            department: '사업본부',
            created_at: new Date().toISOString().slice(0, 10),
            status: updatedPayload.overallStage,
            amount: 0,
            project_name: updatedPayload.periodKey,
            vendor: `총 ${updatedPayload.items.length}개 프로젝트`,
            payment_method: updatedPayload.reportType,
            purpose: updatedPayload.directorSummary,
            items_json: JSON.stringify(updatedPayload),
            reviewer_comment: updatedPayload.ceoFeedback,
            approved_by:
              updatedPayload.overallStage === '사장님확인완료' ? '권우석 사장' : '',
          },
        }),
      });
      await onRefresh();
      showToast(successMessage);
    } catch (e) {
      console.error('Failed to save report:', e);
      alert('보고서 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 특정 프로젝트 항목 업데이트 헬퍼
  const updateProjectItem = (
    projectId: number,
    patch: Partial<ProjectReportItem>
  ) => {
    setDraftReport((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.projectId === projectId
          ? {
              ...it,
              ...patch,
              updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
            }
          : it
      ),
    }));
  };

  const selectedItem =
    draftReport.items.find((it) => it.projectId === selectedProjectId) ||
    draftReport.items[0];

  const submittedCount = draftReport.items.filter((it) => it.pmSubmitted).length;

  return (
    <div className="space-y-4">
      {/* 상단 알림 토스트 */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-indigo-500/40 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. 상단 컨트롤 바: 주간/월간 전환 + 주차/월 선택 + 보고 프로세스 단계 표시 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 주간보고 / 월간보고 탭 */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['주간보고', '월간보고'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleSwitchReportType(type)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  reportType === type
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {type}
              </button>
            ))}
          </div>

          {/* 주차 / 월 선택 셀렉트 */}
          <select
            value={selectedPeriodKey}
            onChange={(e) => setSelectedPeriodKey(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {periods.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>

          {/* 뷰 전환: 프로젝트별 PM 작성 vs 이사 취합·사장님 보고 통합뷰 */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('consolidated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'consolidated'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              전사 프로젝트 취합·보완 (이사/사장님 보고뷰)
            </button>
            <button
              onClick={() => setViewMode('pm_edit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'pm_edit'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              개별 프로젝트 PM 보고 작성
            </button>
          </div>
        </div>

        {/* 우측: 3단계 보고 결재/진행 프로세스 배지 */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <span
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
              draftReport.overallStage === 'PM작성중'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            1. PM 금주/차주 작성 ({submittedCount}/{draftReport.items.length})
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
              draftReport.overallStage === '이사취합보완중'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            2. 이사 취합·보완
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
              draftReport.overallStage === '사장님보고완료' ||
              draftReport.overallStage === '사장님확인완료'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            3. 사장님 최종 보고{' '}
            {draftReport.overallStage === '사장님확인완료' ? '(확인완료)' : ''}
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 모드 A: 이사 취합·보완 및 사장님 보고용 통합 뷰 (전체 프로젝트 한눈에) */}
      {/* =================================================================== */}
      {viewMode === 'consolidated' && (
        <div className="space-y-4">
          {/* 1) 사업본부장(이사) 총괄 보완 요약 & 사장님 보고 패널 */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-indigo-900/60">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/30 border border-purple-400/40 text-purple-200 flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  사업본부 취합 → 대표이사 보고
                </span>
                <h3 className="text-base font-black">
                  [{reportType}] {currentPeriodObj.label} 프로젝트 종합 취합보고서
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {canConsolidateAsDirector && (
                  <>
                    <button
                      onClick={() =>
                        saveReportToDb(
                          {
                            ...draftReport,
                            overallStage: '이사취합보완중',
                          },
                          '이사 취합·보완 내용이 DB에 저장되었습니다.'
                        )
                      }
                      disabled={saving}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      보완 내용 임시저장
                    </button>
                    <button
                      onClick={() =>
                        saveReportToDb(
                          {
                            ...draftReport,
                            overallStage: '사장님보고완료',
                            submittedToCeoAt: new Date()
                              .toISOString()
                              .replace('T', ' ')
                              .slice(0, 16),
                          },
                          '각 프로젝트 취합 및 보완 내용을 사장님께 보고 상신하였습니다.'
                        )
                      }
                      disabled={saving}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white shadow-sm transition flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      보완 완료 및 사장님께 보고 상신
                    </button>
                  </>
                )}

                {(isCeo || userRole === '시스템 관리자') && (
                  <button
                    onClick={() =>
                      saveReportToDb(
                        {
                          ...draftReport,
                          overallStage: '사장님확인완료',
                          confirmedByCeoAt: new Date()
                            .toISOString()
                            .replace('T', ' ')
                            .slice(0, 16),
                        },
                        '사장님 최종 확인 및 코멘트가 반영되었습니다.'
                      )
                    }
                    disabled={saving}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    사장님 보고 확인 완료
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 좌측 7칸: 이사(박용묵 이사) 취합·보완 총괄 요약 */}
              <div className="lg:col-span-7 bg-white/10 rounded-xl p-3.5 border border-white/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-300" />
                    사업본부장(박용묵 이사) 취합 총괄 요약 및 보완 보고
                  </span>
                  <span className="text-[11px] text-slate-300">
                    {canConsolidateAsDirector ? '직접 수정 가능' : '이사 작성란'}
                  </span>
                </div>
                <textarea
                  rows={3}
                  readOnly={!canConsolidateAsDirector}
                  value={draftReport.directorSummary}
                  onChange={(e) =>
                    setDraftReport((prev) => ({
                      ...prev,
                      directorSummary: e.target.value,
                    }))
                  }
                  placeholder="각 프로젝트 PM 보고를 취합한 후 사장님께 보고할 핵심 요약 및 보완 사항을 입력하세요..."
                  className="w-full bg-slate-900/60 text-white text-xs rounded-lg p-2.5 border border-white/15 focus:outline-none focus:border-indigo-400 leading-relaxed resize-none"
                />
              </div>

              {/* 우측 5칸: 대표이사(권우석 사장) 당부사항 / 피드백 */}
              <div className="lg:col-span-5 bg-white/10 rounded-xl p-3.5 border border-white/15">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                    대표이사(권우석 사장님) 확인 및 당부사항
                  </span>
                  {draftReport.overallStage === '사장님확인완료' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                      보고확인 완료
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/40">
                      {draftReport.overallStage}
                    </span>
                  )}
                </div>
                <textarea
                  rows={3}
                  readOnly={!canConsolidateAsDirector}
                  value={draftReport.ceoFeedback}
                  onChange={(e) =>
                    setDraftReport((prev) => ({
                      ...prev,
                      ceoFeedback: e.target.value,
                    }))
                  }
                  placeholder="대표이사 코멘트 및 지시사항..."
                  className="w-full bg-slate-900/60 text-white text-xs rounded-lg p-2.5 border border-white/15 focus:outline-none focus:border-amber-400 leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>

          {/* 2) 프로젝트별 PM 보고 취합 테이블 (이사가 한눈에 비교하고 즉석에서 보완 가능) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  프로젝트별 PM {reportType === '주간보고' ? '금주 실적 / 차주 계획' : '당월 실적 / 차월 계획'} 취합 현황
                </h4>
                <span className="text-xs text-slate-500">
                  (이사는 각 프로젝트 내용을 바로 첨삭·보완하거나 코멘트를 추가하여 사장님께 보고할 수 있습니다)
                </span>
              </div>
              <span className="text-xs font-bold text-indigo-600">
                총 {draftReport.items.length}개 프로젝트
              </span>
            </div>

            <div className="divide-y divide-slate-200">
              {draftReport.items.map((item) => {
                const isThisItemPm =
                  currentUser.name?.trim() === item.pmName?.trim() ||
                  currentUser.role === '시스템 관리자';

                return (
                  <div
                    key={item.projectId}
                    className="p-4 hover:bg-slate-50/50 transition"
                  >
                    {/* 프로젝트 헤더 라인 */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {item.projectCode}
                        </span>
                        <span className="font-bold text-sm text-slate-900">
                          {item.projectName}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                          isThisItemPm
                            ? 'bg-indigo-100 text-indigo-900 font-bold border border-indigo-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          PM: {item.pmName} {isThisItemPm ? '(담당)' : ''}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {item.projectStage} · 진척률 {item.progress}%
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            item.healthStatus === '정상'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.healthStatus === '주의'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          ● {item.healthStatus}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            item.pmSubmitted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {item.pmSubmitted ? '✓ PM 보고제출 완료' : 'PM 작성대기'}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedProjectId(item.projectId);
                            setViewMode('pm_edit');
                          }}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                            isThisItemPm
                              ? 'text-indigo-600 border-indigo-300 hover:bg-indigo-50 bg-white'
                              : 'text-slate-600 border-slate-200 hover:bg-slate-100 bg-slate-50'
                          }`}
                        >
                          {isThisItemPm ? 'PM 보고작성 →' : '보고 상세조회 →'}
                        </button>
                      </div>
                    </div>

                    {/* 3단 그리드: 금주(당월) 수행실적 | 차주(차월) 수행계획 | 이슈 및 이사 보완의견 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {/* 1. 금주/당월 수행 내용 (담당 PM만 작성 가능) */}
                      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-800">
                            {reportType === '주간보고'
                              ? '■ 금주 주요 수행내용'
                              : '■ 당월 주요 수행실적'}
                          </span>
                          <span className={`text-[10px] font-medium ${isThisItemPm ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                            {isThisItemPm ? '담당 PM 직접편집' : `PM(${item.pmName}) 전용`}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          readOnly={!isThisItemPm}
                          value={item.thisPeriodWork}
                          onChange={(e) =>
                            updateProjectItem(item.projectId, {
                              thisPeriodWork: e.target.value,
                            })
                          }
                          className={`w-full text-xs rounded-lg p-2 border leading-relaxed resize-none transition ${
                            isThisItemPm
                              ? 'bg-white text-slate-800 border-slate-300 focus:outline-none focus:border-indigo-500'
                              : 'bg-slate-100 text-slate-600 border-slate-200 cursor-default'
                          }`}
                        />
                      </div>

                      {/* 2. 차주/차월 수행 계획 (담당 PM만 작성 가능) */}
                      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-indigo-900">
                            {reportType === '주간보고'
                              ? '■ 차주 예정 수행계획'
                              : '■ 차월 예정 수행계획'}
                          </span>
                          <span className={`text-[10px] font-medium ${isThisItemPm ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                            {isThisItemPm ? '담당 PM 직접편집' : `PM(${item.pmName}) 전용`}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          readOnly={!isThisItemPm}
                          value={item.nextPeriodPlan}
                          onChange={(e) =>
                            updateProjectItem(item.projectId, {
                              nextPeriodPlan: e.target.value,
                            })
                          }
                          className={`w-full text-xs rounded-lg p-2 border leading-relaxed resize-none transition ${
                            isThisItemPm
                              ? 'bg-white text-slate-800 border-slate-300 focus:outline-none focus:border-indigo-500'
                              : 'bg-slate-100 text-slate-600 border-slate-200 cursor-default'
                          }`}
                        />
                      </div>

                      {/* 3. 이사 보완의견 및 주요이슈 */}
                      <div className="bg-purple-50/40 rounded-xl p-3 border border-purple-200/70">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                            <Crown className="w-3.5 h-3.5 text-purple-600" />
                            이사 보완 코멘트
                          </span>
                          <span className="text-[10px] text-purple-500 font-semibold">
                            {canConsolidateAsDirector ? '이사 첨삭/보완 가능' : '이사 작성'}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          readOnly={!canConsolidateAsDirector}
                          value={item.directorNote}
                          onChange={(e) =>
                            updateProjectItem(item.projectId, {
                              directorNote: e.target.value,
                            })
                          }
                          placeholder={
                            canConsolidateAsDirector
                              ? '이사가 검토 후 보완 사항을 입력하세요...'
                              : '등록된 이사 보완 의견이 없습니다.'
                          }
                          className={`w-full text-xs rounded-lg p-2 border leading-relaxed resize-none transition ${
                            canConsolidateAsDirector
                              ? 'bg-white text-purple-950 border-purple-300 focus:outline-none focus:border-purple-500'
                              : 'bg-purple-50/50 text-purple-900 border-purple-200 cursor-default'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 모드 B: 개별 프로젝트 PM 작성 뷰 (PM이 본인 프로젝트 금주/차주 작성) */}
      {/* =================================================================== */}
      {viewMode === 'pm_edit' && selectedItem && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 좌측 4칸: 프로젝트 선택 목록 */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700">
                보고 대상 프로젝트 선택 ({draftReport.items.length}건)
              </h4>
              <span className="text-[11px] text-slate-400">PM 작성현황</span>
            </div>

            {draftReport.items.map((it) => {
              const active = it.projectId === selectedItem.projectId;
              const isMine = it.pmName === currentUser.name;
              return (
                <div
                  key={it.projectId}
                  onClick={() => setSelectedProjectId(it.projectId)}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    active
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-200'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] font-bold text-indigo-600">
                      {it.projectCode}
                    </span>
                    <div className="flex items-center gap-1">
                      {isMine && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-600 text-white">
                          내 담당
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          it.pmSubmitted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {it.pmSubmitted ? '제출완료' : '작성대기'}
                      </span>
                    </div>
                  </div>
                  <div className="font-bold text-xs text-slate-900 truncate">
                    {it.projectName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>PM: {it.pmName}</span>
                    <span>진척률 {it.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 우측 8칸: 선택된 프로젝트의 PM 금주/차주 작성 폼 */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            {/* 담당 PM 권한 체크 (담당 PM 본인 또는 사업본부장(이사)/관리자는 작성 가능) */}
            {(() => {
              const isSelectedPm =
                currentUser.name?.trim() === selectedItem.pmName?.trim() ||
                canConsolidateAsDirector ||
                currentUser.role === '시스템 관리자';

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {selectedItem.projectCode}
                        </span>
                        <h3 className="text-base font-black text-slate-900">
                          {selectedItem.projectName}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        담당 PM: <strong className="text-slate-800">{selectedItem.pmName}</strong> {isSelectedPm ? <span className="text-indigo-600 font-bold">(로그인 사용자 일치)</span> : <span className="text-slate-400">(타 PM/조회 전용)</span>} ·
                        보고 기준: <strong className="text-indigo-600">{currentPeriodObj.label}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-600">공정 상태:</label>
                      <select
                        disabled={!isSelectedPm}
                        value={selectedItem.healthStatus}
                        onChange={(e) =>
                          updateProjectItem(selectedItem.projectId, {
                            healthStatus: e.target.value as '정상' | '주의' | '지연',
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold disabled:bg-slate-100 disabled:cursor-not-allowed"
                      >
                        <option value="정상">● 정상 추진</option>
                        <option value="주의">▲ 주의 (이슈관리)</option>
                        <option value="지연">■ 지연 (집중지원)</option>
                      </select>

                      <label className="text-xs font-bold text-slate-600 ml-2">진척률(%):</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        disabled={!isSelectedPm}
                        value={selectedItem.progress}
                        onChange={(e) =>
                          updateProjectItem(selectedItem.projectId, {
                            progress: Number(e.target.value),
                          })
                        }
                        className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-center disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {!isSelectedPm && (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        주간/월간보고는 담당 PM({selectedItem.pmName})만 작성할 수 있습니다. (현재 조회 전용 모드)
                      </span>
                      {canConsolidateAsDirector && (
                        <span className="text-[11px] text-purple-800 font-bold bg-purple-100 px-2 py-0.5 rounded">
                          이사는 하단 보완 코멘트 작성 가능
                        </span>
                      )}
                    </div>
                  )}

                  {/* 금주 수행실적 & 차주 수행계획 입력 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {reportType === '주간보고'
                          ? '1. 금주 주요 수행 내용 (실적)'
                          : '1. 당월 주요 수행 내용 (실적)'}
                        {!isSelectedPm && <span className="text-slate-400 font-normal ml-1">(담당 PM 작성)</span>}
                      </label>
                      <textarea
                        rows={6}
                        readOnly={!isSelectedPm}
                        value={selectedItem.thisPeriodWork}
                        onChange={(e) =>
                          updateProjectItem(selectedItem.projectId, {
                            thisPeriodWork: e.target.value,
                          })
                        }
                        placeholder={isSelectedPm ? "금주 수행한 핵심 과업 및 산출물 내역을 간략히 작성하세요..." : "담당 PM이 작성한 내용이 표시됩니다."}
                        className={`w-full rounded-xl border p-3 text-xs leading-relaxed focus:outline-none transition ${
                          isSelectedPm
                            ? 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                            : 'bg-slate-100 text-slate-600 border-slate-200 cursor-default'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-indigo-900 mb-1.5">
                        {reportType === '주간보고'
                          ? '2. 차주 예정 수행 계획'
                          : '2. 차월 예정 수행 계획'}
                        {!isSelectedPm && <span className="text-slate-400 font-normal ml-1">(담당 PM 작성)</span>}
                      </label>
                      <textarea
                        rows={6}
                        readOnly={!isSelectedPm}
                        value={selectedItem.nextPeriodPlan}
                        onChange={(e) =>
                          updateProjectItem(selectedItem.projectId, {
                            nextPeriodPlan: e.target.value,
                          })
                        }
                        placeholder={isSelectedPm ? "차주 예정된 주요 일정, 고객사 협의, 개발 계획을 간략히 작성하세요..." : "담당 PM이 작성한 계획이 표시됩니다."}
                        className={`w-full rounded-xl border p-3 text-xs leading-relaxed focus:outline-none transition ${
                          isSelectedPm
                            ? 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                            : 'bg-slate-100 text-slate-600 border-slate-200 cursor-default'
                        }`}
                      />
                    </div>
                  </div>

                  {/* 이슈 및 이사님 지원 요청사항 */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      3. 주요 이슈 및 사업본부장(이사) 지원 요청사항
                    </label>
                    <input
                      type="text"
                      readOnly={!isSelectedPm}
                      value={selectedItem.issueAndSupport}
                      onChange={(e) =>
                        updateProjectItem(selectedItem.projectId, {
                          issueAndSupport: e.target.value,
                        })
                      }
                      placeholder={isSelectedPm ? "리스크 요인이나 타 부서/임원 지원이 필요한 사항을 입력하세요 (없으면 '특이사항 없음')" : ""}
                      className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none transition ${
                        isSelectedPm
                          ? 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500'
                          : 'bg-slate-100 text-slate-600 border-slate-200 cursor-default'
                      }`}
                    />
                  </div>

                  {/* 이사 보완 코멘트 확인란 */}
                  <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200">
                    <div className="text-xs font-bold text-purple-900 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-purple-600" />
                        이사(사업본부장) 보완 의견
                      </span>
                      {canConsolidateAsDirector && (
                        <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded">
                          이사 권한 작성 가능
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      readOnly={!canConsolidateAsDirector}
                      value={selectedItem.directorNote}
                      onChange={(e) =>
                        updateProjectItem(selectedItem.projectId, {
                          directorNote: e.target.value,
                        })
                      }
                      placeholder={
                        canConsolidateAsDirector
                          ? "사업본부장(이사)이 검토 후 보완 코멘트를 작성하는 란입니다."
                          : "등록된 이사 보완 의견이 없습니다."
                      }
                      className={`w-full rounded-lg border px-3 py-1.5 text-xs focus:outline-none transition ${
                        canConsolidateAsDirector
                          ? 'border-purple-300 bg-white text-purple-950 focus:ring-2 focus:ring-purple-400'
                          : 'border-purple-200 bg-purple-50/50 text-purple-900 cursor-default'
                      }`}
                    />
                  </div>

                  {/* 하단 저장 / 이사 취합보고 제출 버튼 */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => setViewMode('consolidated')}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900"
                    >
                      ← 전체 프로젝트 취합뷰로 돌아가기
                    </button>

                    <div className="flex items-center gap-2">
                      {isSelectedPm && (
                        <button
                          onClick={() => {
                            const updated: ConsolidatedReportPayload = {
                              ...draftReport,
                              items: draftReport.items.map((it) =>
                                it.projectId === selectedItem.projectId
                                  ? {
                                      ...it,
                                      pmSubmitted: true,
                                      updatedAt: new Date()
                                        .toISOString()
                                        .replace('T', ' ')
                                        .slice(0, 16),
                                    }
                                  : it
                              ),
                            };
                            setDraftReport(updated);
                            saveReportToDb(
                              updated,
                              `[${selectedItem.projectName}] PM 보고가 제출되었습니다. 전체 프로젝트 취합 현황으로 이동합니다.`
                            );
                            // 제출 완료 후 전체 올라온 내용을 확인할 수 있도록 취합 뷰로 전환
                            setViewMode('consolidated');
                          }}
                          disabled={saving}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          PM 보고 저장 및 제출
                        </button>
                      )}

                      {!isSelectedPm && canConsolidateAsDirector && (
                        <button
                          onClick={() => {
                            saveReportToDb(
                              draftReport,
                              `[${selectedItem.projectName}] 이사 보완 코멘트가 저장되었습니다.`
                            );
                          }}
                          disabled={saving}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          이사 보완의견 저장
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

