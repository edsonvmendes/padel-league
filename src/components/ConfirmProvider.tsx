'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleResponse = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const VARIANT_STYLES = {
    danger:  { icon: <Trash2 size={22} className="text-red-500" />,      btn: 'bg-red-600 hover:bg-red-700 text-white',      bg: 'bg-red-50' },
    warning: { icon: <AlertTriangle size={22} className="text-amber-500" />, btn: 'bg-amber-500 hover:bg-amber-600 text-white', bg: 'bg-amber-50' },
    default: { icon: null,                                                   btn: 'bg-teal-600 hover:bg-teal-700 text-white',   bg: 'bg-teal-50' },
  };

  const variant = state?.variant || 'default';
  const styles = VARIANT_STYLES[variant];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {state && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => handleResponse(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-3">
              <div className="flex items-start gap-3">
                {styles.icon && (
                  <div className={`w-10 h-10 ${styles.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    {styles.icon}
                  </div>
                )}
                <div>
                  {state.title && (
                    <h3 className="font-bold text-neutral-900 text-base">{state.title}</h3>
                  )}
                  <p className={`text-sm text-neutral-600 ${state.title ? 'mt-1' : 'font-medium text-neutral-800'}`}>
                    {state.message}
                  </p>
                </div>
              </div>
              <button onClick={() => handleResponse(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition ml-2 flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-4 pt-2">
              <button onClick={() => handleResponse(false)}
                className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition">
                {state.cancelLabel || 'Cancel'}
              </button>
              <button onClick={() => handleResponse(true)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${styles.btn}`}>
                {state.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}
