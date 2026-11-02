'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  AuthUser,
  Employee,
  Project,
  Approval,
} from '@/types/groupware';
import { useModal } from '@/contexts/ModalContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Building2,
  Palmtree,
  Briefcase,
  Flag,
  CalendarDays,
  List,
  Clock,
  Sparkles,
  X,
  AlertCircle,
  Users,
} from 'lucide-react';

export type ScheduleCategory = 'company' | 'vacation' | 'project' | 'holiday' | 'event';

export interface CalendarEvent {
  id: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
  category: ScheduleCategory;
  description?: string;
  target_name?: string;
  is_custom?: boolean;
}

interface Props {
  currentUser: AuthUser;
  employees: Employee[];
  projects: Project[];
  approvals: Approval[];
}

// 2025~2027 한국 법정 공휴일 및 명절 (양력 기준 및 주요 대체공휴일)
const KOREAN_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-03-03': '삼일절 대체공휴일',
  '2025-05-05': '어린이날 / 부처님오신날',
  '2025-05-06': '대체공휴일',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '대체공휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',
  // 2026
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '삼일절 대체공휴일',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '부처님오신날 대체공휴일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '광복절 대체공휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '개천절 대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',
  // 2027
  '2027-01-01': '신정',
  '2027-02-06': '설날 연휴',
  '2027-02-07': '설날',
  '2027-02-08': '설날 연휴',
  '2027-03-01': '삼일절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-08-16': '광복절 대체공휴일',
  '2027-09-14': '추석 연휴',
  '2027-09-15': '추석',
  '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절',
  '2027-10-04': '개천절 대체공휴일',
  '2027-10-09': '한글날',
  '2027-10-11': '한글날 대체공휴일',
  '2027-12-25': '성탄절',
};

// 고정 전사 기념일 (매년 반복)
const ANNUAL_COMPANY_EVENTS = [
  { month: 1, day: 2, title: '🎍 신년 시무식 및 사업계획 발표', category: 'company' as ScheduleCategory, desc: '전사 임직원 참석 (대회의실)' },
  { month: 5, day: 1, title: '🚩 근로자의 날 (유급휴일)', category: 'company' as ScheduleCategory, desc: '전사 유급 휴무' },
  { month: 10, day: 15, title: '🏢 회사 창립기념일 (전사 유급휴무)', category: 'company' as ScheduleCategory, desc: '창립기념일 축하 휴무' },
  { month: 12, day: 31, title: '🎉 송년 종무식 및 우수사원 포상', category: 'company' as ScheduleCategory, desc: '한 해 마무리 및 우수사원 시상' },
];

const STORAGE_KEY_CUSTOM_EVENTS = 'groupware_custom_schedules_v1';

export default function CompanyScheduleCalendar({
  currentUser,
  employees,
  projects,
  approvals,
}: Props) {
  const { showAlert, showConfirm } = useModal();

  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(() => today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => today.getMonth() + 1); // 1~12
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'ALL' | ScheduleCategory>('ALL');
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');

  // 사용자 등록 커스텀 일정
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_EVENTS);
      if (saved) return JSON.parse(saved);
    } catch {}
    // 기본 샘플 데이터 (창립기념 행사 및 워크숍)
    return [
      {
        id: 'cust-1',
        title: '전사 상반기 워크숍 및 비전 공유회',
        start_date: `${currentYear}-05-22`,
        end_date: `${currentYear}-05-23`,
        category: 'event',
        description: '강원도 양양 솔비치 / 전사 임직원 참여',
        is_custom: true,
      },
      {
        id: 'cust-2',
        title: '신임 팀장 리더십 세미나',
        start_date: `${currentYear}-06-12`,
        end_date: `${currentYear}-06-12`,
        category: 'event',
        description: '본사 4층 중회의실 (09:00~17:00)',
        is_custom: true,
      },
      {
        id: 'cust-3',
        title: '기술연구소 AI GIS 모델 기술발표회',
        start_date: `${currentYear}-07-10`,
        end_date: `${currentYear}-07-10`,
        category: 'event',
        description: '사내 기술 세미나 및 질의응답',
        is_custom: true,
      },
    ];
  });

  // 커스텀 일정 변경 시 로컬스토리지 저장
  const saveCustomEvents = (events: CalendarEvent[]) => {
    setCustomEvents(events);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_EVENTS, JSON.stringify(events));
    } catch {}
  };

  // 모달 상태 (새 일정 추가)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFormData, setModalFormData] = useState<{
    title: string;
    category: ScheduleCategory;
    start_date: string;
    end_date: string;
    target_name: string;
    description: string;
  }>({
    title: '',
    category: 'event',
    start_date: selectedDate,
    end_date: selectedDate,
    target_name: '',
    description: '',
  });

  // 통합 이벤트 목록 산출
  const allEvents = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];

    // 1. 법정 공휴일
    Object.entries(KOREAN_HOLIDAYS).forEach(([dateStr, name]) => {
      list.push({
        id: `holiday-${dateStr}`,
        title: `[공휴일] ${name}`,
        start_date: dateStr,
        end_date: dateStr,
        category: 'holiday',
        description: '대한민국 법정 공휴일',
      });
    });

    // 2. 회사 연례 기념일 (매년 반복 등록: 2025, 2026, 2027)
    [2025, 2026, 2027].forEach((yr) => {
      ANNUAL_COMPANY_EVENTS.forEach((ev, idx) => {
        const mm = String(ev.month).padStart(2, '0');
        const dd = String(ev.day).padStart(2, '0');
        const dateStr = `${yr}-${mm}-${dd}`;
        list.push({
          id: `annual-company-${yr}-${idx}`,
          title: ev.title,
          start_date: dateStr,
          end_date: dateStr,
          category: ev.category,
          description: ev.desc,
        });
      });
    });

    // 3. 직원 휴직/휴가 및 결재 승인된 휴가
    // 3-1) 결재 문서 중 휴가 관련 내역 파싱
    approvals
      .filter((ap) => {
        const cat = (ap.category || '').trim();
        const tit = (ap.title || '').trim();
        return (
          cat.includes('휴가') ||
          cat.includes('연차') ||
          tit.includes('휴가') ||
          tit.includes('연차')
        );
      })
      .forEach((ap) => {
        const sDate = ap.created_at?.slice(0, 10) || `${currentYear}-01-01`;
        list.push({
          id: `approval-vacation-${ap.id}`,
          title: `🏖️ [휴가] ${ap.requester} (${ap.department})`,
          start_date: sDate,
          end_date: sDate,
          category: 'vacation',
          target_name: ap.requester,
          description: `${ap.title} (결재상태: ${ap.status})`,
        });
      });

    // 3-2) 직원 중 현재 휴직 상태인 인원 표시
    employees
      .filter((e) => e.status === '휴직')
      .forEach((e) => {
        const hireDate = e.hire_date || `${currentYear}-01-01`;
        list.push({
          id: `employee-suspended-${e.id}`,
          title: `🛌 [휴직] ${e.name} ${e.position} (${e.department})`,
          start_date: hireDate > `${currentYear}-01-01` ? hireDate : `${currentYear}-01-01`,
          end_date: `${currentYear}-12-31`,
          category: 'vacation',
          target_name: e.name,
          description: `임직원 상태: 휴직 (소속: ${e.department})`,
        });
      });

    // 3-3) 직원들의 입사기념일 (올해 기준)
    employees
      .filter((e) => e.status !== '퇴사' && e.hire_date && e.hire_date.length === 10)
      .forEach((e) => {
        const hireParts = e.hire_date!.split('-');
        if (hireParts.length === 3) {
          const hireYear = Number(hireParts[0]);
          const thisYearDate = `${currentYear}-${hireParts[1]}-${hireParts[2]}`;
          const yearsCount = currentYear - hireYear;
          if (yearsCount > 0) {
            list.push({
              id: `hire-anniversary-${e.id}-${currentYear}`,
              title: `💐 [입사기념일] ${e.name} ${e.position} (${yearsCount}주년)`,
              start_date: thisYearDate,
              end_date: thisYearDate,
              category: 'company',
              target_name: e.name,
              description: `${hireYear}년 ${hireParts[1]}월 ${hireParts[2]}일 입사 (${yearsCount}년 근속)`,
            });
          }
        }
      });

    // 4. 프로젝트 착수 및 납품/완료 일정
    projects.forEach((prj) => {
      if (prj.start_date && prj.start_date.length === 10) {
        list.push({
          id: `prj-start-${prj.id}`,
          title: `🚀 [착수] ${prj.name}`,
          start_date: prj.start_date,
          end_date: prj.start_date,
          category: 'project',
          target_name: prj.pm_name,
          description: `발주처: ${prj.client_name || '미지정'} / PM: ${prj.pm_name} / 예산: ${prj.budget?.toLocaleString()}만원`,
        });
      }
      if (prj.end_date && prj.end_date.length === 10) {
        list.push({
          id: `prj-end-${prj.id}`,
          title: `🏁 [납품/검수] ${prj.name}`,
          start_date: prj.end_date,
          end_date: prj.end_date,
          category: 'project',
          target_name: prj.pm_name,
          description: `프로젝트 완료 및 검수 예정일 (PM: ${prj.pm_name})`,
        });
      }
    });

    // 5. 사용자 등록 커스텀 일정
    list.push(...customEvents);

    return list;
  }, [employees, projects, approvals, customEvents, currentYear]);

  // 카테고리 필터링된 이벤트
  const filteredEvents = useMemo(() => {
    if (activeCategoryFilter === 'ALL') return allEvents;
    return allEvents.filter((ev) => ev.category === activeCategoryFilter);
  }, [allEvents, activeCategoryFilter]);

  // 해당 월의 날짜 그리드 생성
  const monthDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekDay = firstDay.getDay(); // 0(일) ~ 6(토)

    const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();

    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: 'sun' | 'sat' | false;
    }[] = [];

    // 이전 달 잔여일 채우기
    for (let i = startWeekDay - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: (startWeekDay - 1 - i) % 7 === 0 ? 'sun' : false,
      });
    }

    // 이번 달 날짜들
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(currentYear, currentMonth - 1, d).getDay();
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 0 ? 'sun' : dayOfWeek === 6 ? 'sat' : false,
      });
    }

    // 다음 달 날짜 채우기 (총 35일 또는 42일로 맞춤)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: (days.length % 7 === 6) ? 'sat' : false,
      });
    }

    return days;
  }, [currentYear, currentMonth, today]);

  // 날짜별 이벤트 맵 생성 (YYYY-MM-DD -> CalendarEvent[])
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((ev) => {
      const start = ev.start_date;
      const end = ev.end_date || ev.start_date;

      // 단일 날짜
      if (start === end) {
        const arr = map.get(start) || [];
        arr.push(ev);
        map.set(start, arr);
      } else {
        // 기간 일정
        try {
          const s = new Date(start);
          const e = new Date(end);
          if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
            const curr = new Date(s);
            // 최대 90일 범위 제한
            let loopCount = 0;
            while (curr <= e && loopCount < 90) {
              const dStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
              const arr = map.get(dStr) || [];
              arr.push(ev);
              map.set(dStr, arr);
              curr.setDate(curr.getDate() + 1);
              loopCount++;
            }
          }
        } catch {
          const arr = map.get(start) || [];
          arr.push(ev);
          map.set(start, arr);
        }
      }
    });
    return map;
  }, [filteredEvents]);

  // 현재 선택된 날짜의 이벤트 목록
  const selectedDateEvents = useMemo(() => {
    return eventsByDate.get(selectedDate) || [];
  }, [eventsByDate, selectedDate]);

  // 이번 달 전체 이벤트 목록 (일자순 정렬)
  const currentMonthEvents = useMemo(() => {
    const ymPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    return filteredEvents
      .filter((ev) => ev.start_date.startsWith(ymPrefix) || (ev.end_date && ev.end_date.startsWith(ymPrefix)))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [filteredEvents, currentYear, currentMonth]);

  // 연/월 이동 핸들러
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setSelectedDate(todayStr);
  };

  // 일정 스타일 헬퍼
  const getEventBadgeClass = (category: ScheduleCategory) => {
    switch (category) {
      case 'company':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'vacation':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'project':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'holiday':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'event':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  const getCategoryLabel = (category: ScheduleCategory) => {
    switch (category) {
      case 'company':
        return '회사기념일/행사';
      case 'vacation':
        return '휴가/근태';
      case 'project':
        return '프로젝트 일정';
      case 'holiday':
        return '법정공휴일';
      case 'event':
        return '사내행사/세미나';
    }
  };

  // 새 일정 저장 처리
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFormData.title.trim()) {
      await showAlert('일정 제목을 입력해 주세요.');
      return;
    }
    if (!modalFormData.start_date) {
      await showAlert('시작일을 입력해 주세요.');
      return;
    }

    const newEvent: CalendarEvent = {
      id: `cust-${Date.now()}`,
      title: modalFormData.title.trim(),
      category: modalFormData.category,
      start_date: modalFormData.start_date,
      end_date: modalFormData.end_date || modalFormData.start_date,
      target_name: modalFormData.target_name.trim() || undefined,
      description: modalFormData.description.trim() || undefined,
      is_custom: true,
    };

    saveCustomEvents([...customEvents, newEvent]);
    setIsModalOpen(false);
    setSelectedDate(modalFormData.start_date);
    await showAlert('주요 일정이 등록되었습니다.');
  };

  // 커스텀 일정 삭제 처리
  const handleDeleteEvent = async (id: string, title: string) => {
    const ok = await showConfirm(`'${title}' 일정을 삭제하시겠습니까?`, {
      title: '일정 삭제 확인',
      isDanger: true,
    });
    if (!ok) return;

    saveCustomEvents(customEvents.filter((ev) => ev.id !== id));
    await showAlert('일정이 삭제되었습니다.');
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 컨트롤 패널: 연/월 선택, 오늘 버튼, 필터 칩, 일정 등록 버튼 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* 연/월 네비게이션 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition"
              title="이전 달"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-3 font-extrabold text-base md:text-lg text-slate-900 font-mono tracking-tight flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              <span>{currentYear}년 {currentMonth}월</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition"
              title="다음 달"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={handleGoToday}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition"
          >
            오늘
          </button>

          {/* 뷰 모드 토글 (달력 vs 목록) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold ml-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                viewMode === 'calendar'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>달력 뷰</span>
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                viewMode === 'agenda'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>일정 목록 ({currentMonthEvents.length})</span>
            </button>
          </div>
        </div>

        {/* 카테고리 필터 & 새 일정 등록 버튼 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-semibold overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition ${
                activeCategoryFilter === 'ALL'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setActiveCategoryFilter('company')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                activeCategoryFilter === 'company'
                  ? 'bg-purple-700 text-white font-bold'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <Building2 className="w-3 h-3" />
              <span>회사기념일</span>
            </button>
            <button
              onClick={() => setActiveCategoryFilter('vacation')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                activeCategoryFilter === 'vacation'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <Palmtree className="w-3 h-3" />
              <span>직원휴가/근태</span>
            </button>
            <button
              onClick={() => setActiveCategoryFilter('project')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                activeCategoryFilter === 'project'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>프로젝트</span>
            </button>
            <button
              onClick={() => setActiveCategoryFilter('holiday')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                activeCategoryFilter === 'holiday'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <Flag className="w-3 h-3" />
              <span>공휴일</span>
            </button>
          </div>

          <button
            onClick={() => {
              setModalFormData({
                title: '',
                category: 'event',
                start_date: selectedDate,
                end_date: selectedDate,
                target_name: '',
                description: '',
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-2xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>일정 추가</span>
          </button>
        </div>
      </div>

      {/* 2. 메인 컨텐츠 영역: 달력 그리드 / 목록 뷰 */}
      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* 좌측 3열: 월간 달력 그리드 */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 mb-2 text-center text-xs font-bold text-slate-500 pb-2 border-b border-slate-100">
              <span className="text-rose-500">일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span className="text-blue-500">토</span>
            </div>

            {/* 날짜 셀 그리드 */}
            <div className="grid grid-cols-7 gap-1.5">
              {monthDays.map((dayItem, idx) => {
                const dayEvents = eventsByDate.get(dayItem.dateStr) || [];
                const isSelected = selectedDate === dayItem.dateStr;

                return (
                  <div
                    key={`${dayItem.dateStr}-${idx}`}
                    onClick={() => setSelectedDate(dayItem.dateStr)}
                    className={`min-h-[105px] p-1.5 rounded-xl border transition cursor-pointer flex flex-col justify-between group ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/20'
                        : dayItem.isToday
                        ? 'border-indigo-300 bg-indigo-50/15'
                        : dayItem.isCurrentMonth
                        ? 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                        : 'border-transparent bg-slate-50/40 text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {/* 상단: 일자 숫자 & 오늘 배지 */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center font-mono ${
                          dayItem.isToday
                            ? 'bg-indigo-600 text-white font-extrabold'
                            : isSelected
                            ? 'bg-indigo-100 text-indigo-900 font-extrabold'
                            : dayItem.isWeekend === 'sun'
                            ? dayItem.isCurrentMonth ? 'text-rose-600' : 'text-rose-300'
                            : dayItem.isWeekend === 'sat'
                            ? dayItem.isCurrentMonth ? 'text-blue-600' : 'text-blue-300'
                            : dayItem.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {dayItem.dayNumber}
                      </span>

                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-bold text-slate-400">
                          {dayEvents.length}건
                        </span>
                      )}
                    </div>

                    {/* 일정 뱃지 목록 (최대 2개 노출, 초과 시 +N 표시) */}
                    <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate border ${getEventBadgeClass(
                            ev.category
                          )}`}
                          title={`${ev.title} ${ev.description ? `(${ev.description})` : ''}`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-slate-400 font-bold px-1">
                          +{dayEvents.length - 2}개 더보기
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 우측 1열: 선택된 날짜 상세 일정 패널 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span className="font-extrabold text-sm text-slate-900">
                    {selectedDate} 일정
                  </span>
                </div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  총 {selectedDateEvents.length}건
                </span>
              </div>

              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <CalendarDays className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p>등록된 일정이 없습니다.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    새 일정을 추가하여 관리해 보세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {selectedDateEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition space-y-1.5 relative group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getEventBadgeClass(
                            ev.category
                          )}`}
                        >
                          {getCategoryLabel(ev.category)}
                        </span>
                        {ev.is_custom && (
                          <button
                            onClick={() => handleDeleteEvent(ev.id, ev.title)}
                            className="text-slate-300 hover:text-rose-600 transition p-1"
                            title="일정 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="font-bold text-xs text-slate-900 leading-snug">
                        {ev.title}
                      </div>

                      {ev.description && (
                        <div className="text-[11px] text-slate-500 leading-relaxed bg-white p-2 rounded-lg border border-slate-100">
                          {ev.description}
                        </div>
                      )}

                      {ev.target_name && (
                        <div className="text-[10px] text-indigo-600 font-medium flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>대상: {ev.target_name}</span>
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 font-mono">
                        기간: {ev.start_date} {ev.end_date && ev.end_date !== ev.start_date ? `~ ${ev.end_date}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setModalFormData({
                  title: '',
                  category: 'event',
                  start_date: selectedDate,
                  end_date: selectedDate,
                  target_name: '',
                  description: '',
                });
                setIsModalOpen(true);
              }}
              className="w-full mt-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>선택 일자에 일정 추가</span>
            </button>
          </div>
        </div>
      ) : (
        /* 3. 목록(아젠다) 뷰: 월간 일정 타임라인 */
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="font-extrabold text-sm text-slate-900">
                {currentYear}년 {currentMonth}월 전체 일정 타임라인 ({currentMonthEvents.length}건)
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              일자 오름차순 정렬
            </span>
          </div>

          {currentMonthEvents.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CalendarDays className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">해당 월에 등록된 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentMonthEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-indigo-300 transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
                      {ev.start_date}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getEventBadgeClass(
                        ev.category
                      )}`}
                    >
                      {getCategoryLabel(ev.category)}
                    </span>
                  </div>

                  <div className="font-bold text-sm text-slate-900">
                    {ev.title}
                  </div>

                  {ev.description && (
                    <div className="text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-100">
                      {ev.description}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>
                      {ev.target_name ? `대상: ${ev.target_name}` : '전사 공통'}
                    </span>
                    {ev.is_custom && (
                      <button
                        onClick={() => handleDeleteEvent(ev.id, ev.title)}
                        className="text-slate-300 hover:text-rose-600 transition"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. 새 일정 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-base text-slate-900">
                  주요 일정 등록
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  일정 제목 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 넥서스시스템즈 제21주년 창립기념일 행사"
                  value={modalFormData.title}
                  onChange={(e) => setModalFormData({ ...modalFormData, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    일정 구분
                  </label>
                  <select
                    value={modalFormData.category}
                    onChange={(e) => setModalFormData({ ...modalFormData, category: e.target.value as ScheduleCategory })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  >
                    <option value="company">🏢 회사기념일/행사</option>
                    <option value="vacation">🏖️ 직원휴가/근태</option>
                    <option value="event">🎉 사내행사/세미나</option>
                    <option value="project">💼 프로젝트 일정</option>
                    <option value="holiday">📌 공휴일</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    대상자 / 참여부서
                  </label>
                  <input
                    type="text"
                    placeholder="예: 전사 임직원 또는 홍길동"
                    value={modalFormData.target_name}
                    onChange={(e) => setModalFormData({ ...modalFormData, target_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    시작일자 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={modalFormData.start_date}
                    onChange={(e) => setModalFormData({ ...modalFormData, start_date: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    종료일자 (선택)
                  </label>
                  <input
                    type="date"
                    value={modalFormData.end_date}
                    onChange={(e) => setModalFormData({ ...modalFormData, end_date: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  상세 내용 및 비고
                </label>
                <textarea
                  rows={3}
                  placeholder="일정에 대한 상세 안내나 장소, 준비물 등을 입력하세요."
                  value={modalFormData.description}
                  onChange={(e) => setModalFormData({ ...modalFormData, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition"
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

