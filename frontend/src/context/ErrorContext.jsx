import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { setErrorNotifier } from '../api/client';

const ErrorContext = createContext(null);

let nextId = 0;
const AUTO_DISMISS_MS = 6000;

/**
 * Centralized error notification provider. Manages a queue of floating toast
 * notifications (bottom-right) that auto-dismiss. Pages can trigger toasts via
 * the `useError()` hook or let the Axios global interceptor do it automatically.
 */
export function ErrorProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const push = useCallback((message, tone = 'error') => {
    const id = ++nextId;
    setToasts((prev) => [...prev.slice(-4), { id, message, tone }]); // keep last 5
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    timers.current.set(id, timer);
    return id;
  }, [dismiss]);

  const showError = useCallback((message) => push(message, 'error'), [push]);
  const showSuccess = useCallback((message) => push(message, 'success'), [push]);
  const clearErrors = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setToasts([]);
  }, []);

  // Connect Axios global interceptor to this provider
  useEffect(() => {
    return setErrorNotifier(showError);
  }, [showError]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => timers.current.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <ErrorContext.Provider value={{ showError, showSuccess, clearErrors }}>
      {children}
      {createPortal(
        <div aria-live="polite" aria-label="Notifications" className="fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2">
          {toasts.map(({ id, message, tone }) => (
            <div key={id} role={tone === 'error' ? 'alert' : 'status'}
              className={`flex items-start gap-3 rounded-xl border p-4 text-sm shadow-lg backdrop-blur animate-in slide-in-from-bottom-2 ${
                tone === 'error'
                  ? 'border-rose-200 bg-rose-50/95 text-rose-800'
                  : 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
              }`}>
              {tone === 'error'
                ? <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                : <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}
              <p className="min-w-0 flex-1">{message}</p>
              <button type="button" aria-label="Dismiss notification" className="shrink-0 rounded p-1 opacity-70 hover:opacity-100" onClick={() => dismiss(id)}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ErrorContext.Provider>
  );
}

/**
 * Hook to access the global error notification system.
 *
 * @returns {{ showError: (msg: string) => number, showSuccess: (msg: string) => number, clearErrors: () => void }}
 */
export function useError() {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useError() must be used inside <ErrorProvider>');
  return ctx;
}
