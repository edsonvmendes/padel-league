'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const success = useCallback((msg: string) => add(msg, 'success'), [add]);
  const error   = useCallback((msg: string) => add(msg, 'error'),   [add]);
  const info    = useCallback((msg: string) => add(msg, 'info'),     [add]);
  const warning = useCallback((msg: string) => add(msg, 'warning'), [add]);

  const ICONS: Record<ToastType, string> = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
    warning: '⚠',
  };
  const COLORS: Record<ToastType, string> = {
    success: 'bg-emerald-600',
    error:   'bg-red-600',
    info:    'bg-teal-600',
    warning: 'bg-amber-500',
  };

  return (
    <ToastContext.Provider value={{ success, error, info, warning }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-20 lg:bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl
              animate-in slide-in-from-right-4 fade-in duration-200 ${COLORS[t.type]}`}
          >
            <span className="text-base leading-none">{ICONS[t.type]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
