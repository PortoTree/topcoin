import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Standalone export for direct imperative calls where hook is inconvenient
let globalToastHandler: ToastContextValue | null = null;
export const toast = {
  success: (msg: string, duration?: number) => globalToastHandler?.success(msg, duration),
  error: (msg: string, duration?: number) => globalToastHandler?.error(msg, duration),
  warning: (msg: string, duration?: number) => globalToastHandler?.warning(msg, duration),
  info: (msg: string, duration?: number) => globalToastHandler?.info(msg, duration),
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timeoutsRef.current.has(id)) {
      clearTimeout(timeoutsRef.current.get(id));
      timeoutsRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3500) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);

      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);

      timeoutsRef.current.set(id, timeout);
    },
    [removeToast]
  );

  const success = useCallback((msg: string, d?: number) => showToast(msg, 'success', d), [showToast]);
  const error = useCallback((msg: string, d?: number) => showToast(msg, 'error', d), [showToast]);
  const warning = useCallback((msg: string, d?: number) => showToast(msg, 'warning', d), [showToast]);
  const info = useCallback((msg: string, d?: number) => showToast(msg, 'info', d), [showToast]);

  const value = { showToast, success, error, warning, info };
  globalToastHandler = value;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-live="polite"
            className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md flex flex-col gap-2 pointer-events-none"
            style={{ paddingTop: 'var(--sat, 0px)' }}
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                onClick={() => removeToast(t.id)}
                className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-200 cursor-pointer animate-in slide-in-from-top-4 fade-in active:scale-98 ${
                  t.type === 'success'
                    ? 'bg-emerald-900/90 dark:bg-emerald-950/90 text-white border-emerald-500/40 shadow-emerald-900/20'
                    : t.type === 'error'
                    ? 'bg-rose-900/90 dark:bg-rose-950/90 text-white border-rose-500/40 shadow-rose-900/20'
                    : t.type === 'warning'
                    ? 'bg-amber-900/90 dark:bg-amber-950/90 text-white border-amber-500/40 shadow-amber-900/20'
                    : 'bg-slate-900/90 dark:bg-slate-900/95 text-white border-slate-700/60 shadow-slate-900/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-300" />}
                    {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-300" />}
                    {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-300" />}
                    {t.type === 'info' && <Info className="w-5 h-5 text-indigo-300" />}
                  </div>
                  <p className="text-xs sm:text-sm font-semibold leading-snug">{t.message}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeToast(t.id);
                  }}
                  className="p-1 rounded-lg text-white/70 hover:text-white transition flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
