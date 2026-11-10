import { useEffect, useId, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import type { ProcurementFilter } from '@/types/procurement';

interface NotificationBellProps {
  employeeId: number;
  onOpen: (filter: ProcurementFilter) => void;
}

/**
 * 상단 헤더의 입찰공고 미읽음 알림 배지 및 팝오버 메뉴
 */
export default function NotificationBell({ employeeId, onOpen }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();

  // 미읽음 알림 건수 폴링 및 이벤트 수신
  useEffect(() => {
    const abortController = new AbortController();
    let currentRequestId = 0;

    const fetchNotificationStatus = async () => {
      const requestId = ++currentRequestId;
      try {
        const response = await fetch('/api/procurement/status', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: abortController.signal,
        });

        if (!response.ok) return;

        const data = await response.json();
        if (requestId === currentRequestId && !abortController.signal.aborted) {
          setUnreadCount(data.unread);
        }
      } catch {
        // 일시적인 네트워크 오류 시 이전 카운트 보존
      }
    };

    void fetchNotificationStatus();
    const intervalTimer = setInterval(fetchNotificationStatus, 60000);
    window.addEventListener('procurement-updated', fetchNotificationStatus);

    return () => {
      abortController.abort();
      clearInterval(intervalTimer);
      window.removeEventListener('procurement-updated', fetchNotificationStatus);
    };
  }, [employeeId]);

  // 외부 클릭 및 ESC 키 바인딩
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const animationFrameId = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLButtonElement>('[data-category-count]')?.focus();
    });

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleNavigateToAlerts = (filter: ProcurementFilter) => {
    setIsOpen(false);
    onOpen(filter);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`알림 ${unreadCount}건`}
        title="알림"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className="relative rounded-xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white shadow-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <span className="sr-only" role="status" aria-live="polite">
          미읽음 알림 {unreadCount}건
        </span>
      </button>

      {isOpen && (
        <section
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="알림"
          className="fixed inset-x-3 top-[4.5rem] z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-80"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">알림</h2>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                buttonRef.current?.focus();
              }}
              aria-label="알림 닫기"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 py-3 text-sm text-slate-700">
            <span className="font-medium">입찰공고 알림</span>
            <button
              data-category-count
              type="button"
              onClick={() => handleNavigateToAlerts({ kind: 'ALL', business: 'ALL', unread: true })}
              aria-label={`입찰공고 알림 ${unreadCount}건 보기`}
              className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold tabular-nums text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              {unreadCount}건
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
