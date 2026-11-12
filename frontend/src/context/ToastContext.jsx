import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ title, message, tone = 'info', duration = 5000 }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast = { id, title, message, tone, createdAt: Date.now() };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const success = useCallback((title, message, duration) => addToast({ title, message, tone: 'success', duration }), [addToast]);
  const error = useCallback((title, message, duration) => addToast({ title, message, tone: 'error', duration }), [addToast]);
  const warning = useCallback((title, message, duration) => addToast({ title, message, tone: 'warning', duration }), [addToast]);
  const info = useCallback((title, message, duration) => addToast({ title, message, tone: 'info', duration }), [addToast]);

  const value = useMemo(() => ({
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  }), [toasts, addToast, removeToast, success, error, warning, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Floating Viewport */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex max-w-sm flex-col gap-2.5 sm:max-w-md"
      >
        {toasts.map((toast) => {
          const toneStyles = {
            success: {
              border: 'border-emerald-500/20',
              bg: 'bg-white dark:bg-slate-900',
              icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />,
              bar: 'bg-emerald-500'
            },
            error: {
              border: 'border-rose-500/20',
              bg: 'bg-white dark:bg-slate-900',
              icon: <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />,
              bar: 'bg-rose-500'
            },
            warning: {
              border: 'border-amber-500/20',
              bg: 'bg-white dark:bg-slate-900',
              icon: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />,
              bar: 'bg-amber-500'
            },
            info: {
              border: 'border-sky-500/20',
              bg: 'bg-white dark:bg-slate-900',
              icon: <Info className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />,
              bar: 'bg-sky-500'
            }
          }[toast.tone] || {
            border: 'border-slate-200',
            bg: 'bg-white',
            icon: <Info className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />,
            bar: 'bg-slate-500'
          };

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${toneStyles.bg} ${toneStyles.border}`}
            >
              {toneStyles.icon}
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {toast.title}
                  </p>
                )}
                {toast.message && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Close notification"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

