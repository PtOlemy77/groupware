'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  HelpCircle,
  X,
} from 'lucide-react';

export type ModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface ModalOptions {
  title?: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  autoClose?: boolean; // 자동 닫힘 여부 (기본값: alert는 true, confirm은 false)
  autoCloseDuration?: number; // 자동 닫힘 시간(ms, 기본값: 2000ms)
}

interface ModalState extends ModalOptions {
  isOpen: boolean;
  resolve?: (value: any) => void;
}

export interface ModalContextType {
  showAlert: (
    message: string,
    options?: Partial<Omit<ModalOptions, 'message'>>
  ) => Promise<void>;
  showConfirm: (
    message: string,
    options?: Partial<Omit<ModalOptions, 'message'>>
  ) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

// 싱글톤 브리지: React 트리 외부나 기존 코드에서도 호출 가능하도록 전역 바인딩 지원
let globalModalBridge: ModalContextType | null = null;

export const notify = {
  alert: (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => {
    if (globalModalBridge) {
      return globalModalBridge.showAlert(message, options);
    }
    return Promise.reject(new Error('ModalProvider가 준비되지 않았습니다.'));
  },
  confirm: (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => {
    if (globalModalBridge) {
      return globalModalBridge.showConfirm(message, options);
    }
    return Promise.reject(new Error('ModalProvider가 준비되지 않았습니다.'));
  },
};

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const closeModal = useCallback(
    (result?: any) => {
      clearTimer();
      setModal((prev) => {
        if (prev.resolve) {
          prev.resolve(result);
        }
        return { ...prev, isOpen: false, resolve: undefined };
      });
    },
    [clearTimer]
  );

  const showAlert = useCallback(
    (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => {
      clearTimer();
      return new Promise<void>((resolve) => {
        const autoClose = options?.autoClose ?? true; // alert는 기본 2초 자동 닫힘
        const autoCloseDuration = options?.autoCloseDuration ?? 2000;

        setModal({
          isOpen: true,
          message,
          title: options?.title,
          type: options?.type || 'info',
          confirmText: options?.confirmText || '확인',
          autoClose,
          autoCloseDuration,
          resolve: () => {
            resolve();
          },
        });
      });
    },
    [clearTimer]
  );

  const showConfirm = useCallback(
    (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => {
      clearTimer();
      return new Promise<boolean>((resolve) => {
        setModal({
          isOpen: true,
          message,
          title: options?.title,
          type: 'confirm',
          confirmText: options?.confirmText || '확인',
          cancelText: options?.cancelText || '취소',
          isDanger: options?.isDanger ?? false,
          autoClose: false, // 확인은 반드시 사용자 선택으로만 완료
          autoCloseDuration: 0,
          resolve: (result: boolean) => {
            resolve(result);
          },
        });
      });
    },
    [clearTimer]
  );

  // 자동 닫힘 타이머 처리
  useEffect(() => {
    if (modal.isOpen && modal.autoClose && (modal.autoCloseDuration || 0) > 0) {
      clearTimer();
      timerRef.current = setTimeout(() => {
        closeModal(true);
      }, modal.autoCloseDuration);
    }
    return () => {
      clearTimer();
    };
  }, [modal.isOpen, modal.autoClose, modal.autoCloseDuration, closeModal, clearTimer]);

  // 브리지 등록
  useEffect(() => {
    globalModalBridge = { showAlert, showConfirm };
    return () => {
      globalModalBridge = null;
    };
  }, [showAlert, showConfirm]);

  useEffect(() => {
    if (!modal.isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeModal(false);
      }
      if (event.key !== 'Tab' || !dialog) return;
      const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [modal.isOpen, closeModal]);

  const handleConfirm = () => {
    closeModal(true);
  };

  const handleCancel = () => {
    closeModal(false);
  };

  const getIcon = () => {
    switch (modal.type) {
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-rose-600" />;
      case 'confirm':
        return modal.isDanger ? (
          <AlertTriangle className="w-6 h-6 text-rose-600" />
        ) : (
          <HelpCircle className="w-6 h-6 text-indigo-600" />
        );
      default:
        return <Info className="w-6 h-6 text-indigo-600" />;
    }
  };

  const getIconBg = () => {
    switch (modal.type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-100';
      case 'warning':
        return 'bg-amber-50 border-amber-100';
      case 'error':
        return 'bg-rose-50 border-rose-100';
      case 'confirm':
        return modal.isDanger ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50 border-indigo-100';
      default:
        return 'bg-indigo-50 border-indigo-100';
    }
  };

  const getDefaultTitle = () => {
    if (modal.title) return modal.title;
    switch (modal.type) {
      case 'success':
        return '완료';
      case 'warning':
        return '확인 필요';
      case 'error':
        return '오류 안내';
      case 'confirm':
        return '확인 안내';
      default:
        return '알림';
    }
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Global Dialog Modal */}
      {modal.isOpen && (
        <div
          data-global-modal
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            // 알림 모달은 백드롭 클릭 시에도 편안하게 닫힘
            if (modal.type !== 'confirm') closeModal(true);
          }}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150 relative"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-modal-title"
            aria-describedby="global-modal-message"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={clearTimer}
            onMouseLeave={() => {
              if (modal.autoClose && (modal.autoCloseDuration || 0) > 0) {
                clearTimer();
                timerRef.current = setTimeout(() => {
                  closeModal(true);
                }, 1000); // 마우스 나간 후 1초 뒤 종료
              }
            }}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${getIconBg()}`}
                >
                  {getIcon()}
                </div>
                <div className="flex-1 pt-1 min-w-0">
                  <h3 id="global-modal-title" className="text-base font-bold text-slate-900 mb-1 leading-snug">
                    {getDefaultTitle()}
                  </h3>
                  <p id="global-modal-message" className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-line break-words">
                    {modal.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-between gap-2 border-t border-slate-100">
              <span className="text-[11px] font-medium text-slate-400">
                {modal.autoClose && modal.type !== 'confirm'
                  ? '2초 후 자동으로 닫힙니다'
                  : ''}
              </span>
              <div className="flex items-center gap-2">
                {modal.type === 'confirm' && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                  >
                    {modal.cancelText || '취소'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                    modal.isDanger || modal.type === 'error'
                      ? 'bg-rose-600 hover:bg-rose-700 focus:ring-4 focus:ring-rose-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20'
                  }`}
                >
                  {modal.confirmText || '확인'}
                </button>
              </div>
            </div>

            {/* 2초 자동 카운트다운 애니메이션 바 */}
            {modal.autoClose && (modal.autoCloseDuration || 0) > 0 && (
              <div className="h-1 w-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all ease-linear"
                  style={{
                    animation: `modalCountdown ${modal.autoCloseDuration}ms linear forwards`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Countdown animation keyframe */}
      <style>{`
        @keyframes modalCountdown {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal은 ModalProvider 안에서 사용해야 합니다.');
  return context;
}
