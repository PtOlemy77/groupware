'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
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
}

interface ModalState extends ModalOptions {
  isOpen: boolean;
  resolve?: (value: any) => void;
}

export interface ModalContextType {
  showAlert: (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => Promise<void>;
  showConfirm: (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

// 싱글톤 브리지: React 트리 외부나 기존 코드에서도 호출 가능하도록 전역 바인딩 지원
let globalModalBridge: ModalContextType | null = null;

export const notify = {
  alert: (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => {
    if (globalModalBridge) {
      return globalModalBridge.showAlert(message, options);
    }
    window.alert(message);
    return Promise.resolve();
  },
  confirm: (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => {
    if (globalModalBridge) {
      return globalModalBridge.showConfirm(message, options);
    }
    return Promise.resolve(window.confirm(message));
  },
};

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showAlert = useCallback(
    (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => {
      return new Promise<void>((resolve) => {
        setModal({
          isOpen: true,
          message,
          title: options?.title,
          type: options?.type || 'info',
          confirmText: options?.confirmText || '확인',
          resolve: () => {
            setModal((prev) => ({ ...prev, isOpen: false }));
            resolve();
          },
        });
      });
    },
    []
  );

  const showConfirm = useCallback(
    (message: string, options?: Partial<Omit<ModalOptions, 'message'>>) => {
      return new Promise<boolean>((resolve) => {
        setModal({
          isOpen: true,
          message,
          title: options?.title,
          type: options?.type || 'confirm',
          confirmText: options?.confirmText || '확인',
          cancelText: options?.cancelText || '취소',
          isDanger: options?.isDanger ?? false,
          resolve: (result: boolean) => {
            setModal((prev) => ({ ...prev, isOpen: false }));
            resolve(result);
          },
        });
      });
    },
    []
  );

  // 브리지 등록
  React.useEffect(() => {
    globalModalBridge = { showAlert, showConfirm };
    // window.alert 및 window.confirm 오버라이드로 서드파티나 기존 호출 자동 낚아채기
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    window.alert = (msg) => {
      showAlert(String(msg));
    };
    window.confirm = (msg) => {
      // confirm의 동기적 반환 특성상 기본 true 처리 및 비동기 모달 표시
      showConfirm(String(msg));
      return originalConfirm(msg);
    };

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
      globalModalBridge = null;
    };
  }, [showAlert, showConfirm]);

  const handleConfirm = () => {
    if (modal.resolve) {
      modal.resolve(true);
    }
  };

  const handleCancel = () => {
    if (modal.resolve) {
      modal.resolve(false);
    }
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${getIconBg()}`}
                >
                  {getIcon()}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-base font-bold text-slate-900 mb-1 leading-snug">
                    {getDefaultTitle()}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                    {modal.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-2 border-t border-slate-100">
              {modal.type === 'confirm' && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition"
                >
                  {modal.cancelText || '취소'}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={handleConfirm}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition ${
                  modal.isDanger || modal.type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-700 focus:ring-4 focus:ring-rose-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20'
                }`}
              >
                {modal.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    return {
      showAlert: notify.alert,
      showConfirm: notify.confirm,
    };
  }
  return context;
}

