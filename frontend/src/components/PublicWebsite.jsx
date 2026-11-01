import React, { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, PackageCheck, Truck, MapPin } from 'lucide-react';
import { Input, Button } from './ui';
import { normalizeTrackingNumber, validTrackingNumber } from '../api/publicServices';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../api/client';

export const publicLinks = [['/', 'Home'], ['/track', 'Track Parcel'], ['/pricing', 'Pricing'], ['/help', 'Help'], ['/contact', 'Contact']];
export function PublicFooter() {
  const { isAuthenticated, user } = useAuth();
  return <footer className="border-t border-slate-200 bg-white"><div className="public-container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4"><div className="sm:col-span-2 lg:col-span-2"><Link to="/" className="text-xl font-extrabold tracking-tight text-slate-900">Swift<span className="text-blue-600">Drop</span></Link><p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">Your account and business onboarding, together. Parcel delivery services are being prepared for a future release.</p></div><nav aria-label="Footer navigation"><h2 className="mb-3 text-sm font-bold">Explore</h2><ul>{publicLinks.map(([to, label]) => <li key={to}><Link to={to} className="inline-flex min-h-11 items-center text-sm text-slate-600 hover:text-blue-700">{label}</Link></li>)}</ul></nav><nav aria-label="Footer account navigation"><h2 className="mb-3 text-sm font-bold">Your account</h2><ul>{(isAuthenticated ? [[dashboardPath(user?.role), 'Dashboard'], ['/account', 'Account settings']] : [['/login', 'Log in'], ['/register', 'Register']]).concat([['/forgot-password', 'Password recovery']]).map(([to, label]) => <li key={to}><Link className="inline-flex min-h-11 items-center text-sm text-slate-600 hover:text-blue-700" to={to}>{label}</Link></li>)}</ul></nav></div><div className="border-t px-4 py-5 text-center text-xs text-slate-500">SwiftDrop · Enterprise Courier</div></footer>;
}

export function TrackingSearch({ initialValue = '', onSearch, busy = false }) {
  const [value, setValue] = useState(initialValue), [error, setError] = useState(''); const navigate = useNavigate();
  return <form noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start" onSubmit={e => {
    e.preventDefault(); if (busy) return;
    if (!validTrackingNumber(value)) { setError('Enter 4–64 letters, numbers or hyphens from your tracking reference.'); return; }
    setError(''); const code = normalizeTrackingNumber(value);
    if (onSearch) onSearch(code); else navigate(`/track/${encodeURIComponent(code)}`);
  }}><Input label="Tracking number" className="flex-1" autoComplete="off" spellCheck={false} maxLength={64} placeholder="Enter your tracking reference" value={value} error={error} onChange={e => { setValue(e.target.value); setError(''); }} />
    <Button type="submit" busy={busy} className="sm:mt-[26px]">{busy ? 'Looking up...' : 'Track Parcel'}<ArrowRight size={16} aria-hidden="true" /></Button></form>;
}
export function PasswordInput({ label = 'Password', id, hint, error, ...props }) {
  const generated = useId(), fieldId = id || generated; const [visible, setVisible] = useState(false);
  return <div className="space-y-1.5"><label className="text-sm font-medium text-slate-700" htmlFor={fieldId}>{label}</label><div className="relative">
    <input {...props} id={fieldId} type={visible ? 'text' : 'password'} className="ui-input pr-14" aria-invalid={error ? true : undefined} aria-describedby={hint || error ? `${fieldId}-help` : undefined} />
    <button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} className="absolute inset-y-0 right-0 flex min-h-11 w-12 items-center justify-center rounded-r-lg text-slate-500 hover:text-blue-700" onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>
  </div>{(hint || error) && <p id={`${fieldId}-help`} className={`text-xs ${error ? 'text-rose-700' : 'text-slate-500'}`}>{error || hint}</p>}</div>;
}
export const passwordRules = { minLength: 8, maxLength: 72, pattern: '[\\x20-\\x7E]+' };
export function AuthPanel({ title, description, children, footer }) {
  return <section className="mx-auto w-full max-w-lg py-10 sm:py-14"><div className="mb-6 text-center"><span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white"><Truck size={26} aria-hidden="true" /></span><h1 className="text-3xl font-bold tracking-tight">{title}</h1>{description && <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>}</div><div className="ui-card space-y-5 p-5 sm:p-8">{children}</div>{footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}</section>;
}
// A code-native route illustration: no invented metrics, maps or live delivery claims.
export function DeliveryIllustration() {
  return <div role="img" aria-label="Illustration of a parcel journey between two locations" className="relative mx-auto aspect-[5/4] w-full max-w-lg overflow-hidden rounded-[2rem] border border-blue-100 bg-blue-50">
    <svg viewBox="0 0 500 400" aria-hidden="true" className="absolute inset-0 h-full w-full"><defs><pattern id="route-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#dbeafe" strokeWidth="1" /></pattern></defs><rect width="500" height="400" fill="url(#route-grid)" /><path d="M100 100 H340 Q400 100 400 160 V250 Q400 300 340 300 H170 Q110 300 110 240 V200" fill="none" stroke="#93c5fd" strokeWidth="14" strokeLinecap="round" /><path d="M100 100 H340 Q400 100 400 160 V250" fill="none" stroke="#2563eb" strokeWidth="4" strokeDasharray="8 10" /><circle cx="100" cy="100" r="15" fill="#2563eb" /><circle cx="170" cy="300" r="15" fill="#dbeafe" stroke="#2563eb" strokeWidth="4" /></svg>
    <div className="absolute left-[12%] top-[38%] flex h-28 w-36 -rotate-6 items-center justify-center rounded-3xl border-2 border-white bg-white shadow-lg shadow-blue-900/10"><PackageCheck className="h-16 w-16 text-blue-600" strokeWidth={1.3} aria-hidden="true" /></div>
    <div className="absolute right-[10%] top-[18%] rounded-2xl bg-slate-900 p-4 text-white shadow-lg"><Truck className="h-12 w-12" strokeWidth={1.5} aria-hidden="true" /></div><div className="absolute bottom-[14%] right-[13%] rounded-full bg-white p-4 text-blue-600 shadow-sm"><MapPin size={32} aria-hidden="true" /></div>
  </div>;
}
