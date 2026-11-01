import React, { forwardRef, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, PackageOpen, AlertCircle } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', busy = false, disabled, className, children, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} disabled={disabled || busy} aria-busy={busy || undefined}
    className={twMerge('ui-button', { primary: 'ui-button-primary', secondary: 'ui-button-secondary', danger: 'ui-button-danger', ghost: 'ui-button-ghost' }[variant], size === 'sm' ? 'px-3 text-xs' : 'px-4', className)} {...props}>{children}</button>;
});

function Field({ as: Control = 'input', label, hint, error, id, className, ...props }, ref) {
  const generated = useId(); const fieldId = id || generated;
  const description = [hint && `${fieldId}-hint`, error && `${fieldId}-error`, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
  return <div className={twMerge('min-w-0 space-y-1.5', className)}>
    {label && <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">{label}</label>}
    <Control {...props} ref={ref} id={fieldId} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={description} className={twMerge('ui-input', error && 'border-rose-500')} />
    {hint && <p id={`${fieldId}-hint`} className="text-xs text-slate-500">{hint}</p>}
    {error && <p id={`${fieldId}-error`} className="text-sm text-rose-700">{error}</p>}
  </div>;
}
export const Input = forwardRef(Field);
export const Select = forwardRef((props, ref) => <Input {...props} as="select" ref={ref} />);
export const Textarea = forwardRef((props, ref) => <Input {...props} as="textarea" ref={ref} />);

export function Modal({ open, onClose, title, children, className }) {
  const titleId = useId(); const panel = useRef(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement; const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = document.getElementById('root'); const wasInert = root?.inert;
    if (root) root.inert = true;
    const focusable = () => [...panel.current.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')].filter(el => !el.disabled && el.getAttribute('aria-hidden') !== 'true');
    (focusable()[0] || panel.current).focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); close.current?.(); }
      if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items[items.length - 1];
        if (!items.length) { event.preventDefault(); panel.current.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = overflow; if (root) root.inert = wasInert; if (previous?.isConnected) previous.focus(); };
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={twMerge('w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl', className)}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id={titleId} className="text-lg font-bold">{title}</h2><Button variant="ghost" aria-label="Close dialog" onClick={onClose}><X size={20} /></Button></div>{children}
    </section>
  </div>, document.body);
}
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm action', children, confirmLabel = 'Confirm', busy = false, danger = false }) {
  return <Modal open={open} onClose={busy ? undefined : onClose} title={title}>
    <div className="space-y-5"><div className="text-sm text-slate-600">{children}</div><div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} busy={busy} onClick={onConfirm}>{confirmLabel}</Button></div></div>
  </Modal>;
}
export function PageHeader({ title, description, actions }) {
  return <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}</div>{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}</header>;
}
export function StatCard({ label, value, description, icon: Icon }) {
  return <article className="ui-card flex min-w-0 items-start justify-between gap-3 p-5"><div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 break-words text-3xl font-bold">{value}</p>{description && <p className="mt-2 text-xs text-slate-500">{description}</p>}</div>{Icon && <Icon aria-hidden="true" className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600" />}</article>;
}
export function EmptyState({ title = 'Nothing here yet', description, action }) {
  return <div className="ui-card p-8 text-center"><PackageOpen aria-hidden="true" className="mx-auto mb-3 h-9 w-9 text-slate-400" /><h2 className="font-semibold">{title}</h2>{description && <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}
export function ErrorState({ message = 'Something went wrong. Please try again.', onRetry }) {
  return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><div className="flex items-start gap-2"><AlertCircle aria-hidden="true" size={20} className="shrink-0" /><p role="alert">{message}</p></div>{onRetry && <Button variant="secondary" className="mt-3" onClick={onRetry}>Retry</Button>}</div>;
}
export function LoadingSkeleton({ label = 'Loading...', rows = 3 }) {
  return <div role="status" aria-label={label} className="space-y-3"><span className="sr-only">{label}</span>{Array.from({ length: rows }, (_, i) => <div key={i} aria-hidden="true" className="h-12 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none" />)}</div>;
}
export function SearchFilterBar({ children, onSubmit }) {
  return <form className="ui-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={onSubmit}>{children}</form>;
}
export function Pagination({ page, pages, onPageChange, disabled = false }) {
  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm"><Button variant="secondary" disabled={disabled || page === 0} onClick={() => onPageChange(page - 1)}>Previous</Button><span aria-live="polite">Page {page + 1} of {Math.max(1, pages)}</span><Button variant="secondary" disabled={disabled || page + 1 >= pages} onClick={() => onPageChange(page + 1)}>Next</Button></nav>;
}
// Table on desktop; labeled records on mobile. Both render the same caller-supplied cells.
export function DataTable({ columns, rows, rowKey = 'id', caption, emptyMessage = 'No records found.' }) {
  return <div className="ui-card min-w-0 overflow-hidden"><table className="responsive-table w-full text-left text-sm"><caption className="sr-only">{caption}</caption><thead><tr>{columns.map(c => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[rowKey]}>{columns.map(c => <td key={c.key} data-label={c.label}><div>{c.render ? c.render(row) : row[c.key]}</div></td>)}</tr>)}</tbody></table>{!rows.length && <p className="p-5 text-sm text-slate-500">{emptyMessage}</p>}</div>;
}
export function Toast({ message, tone = 'success', onDismiss }) {
  if (!message) return null;
  return <div role={tone === 'error' ? 'alert' : 'status'} className={twMerge('flex items-start justify-between gap-3 rounded-xl border p-4 text-sm', tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}><p>{message}</p>{onDismiss && <button type="button" aria-label="Dismiss notification" className="shrink-0 rounded p-2" onClick={onDismiss}><X size={18} /></button>}</div>;
}
