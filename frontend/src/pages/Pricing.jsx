import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Package } from 'lucide-react';
import { PageHeader, Input, Select, Button, ErrorState } from '../components/ui';
import { publicServices } from '../api/publicServices';

export function Pricing() {
  const [form, setForm] = useState({ origin: '', destination: '', weight: '', category: 'small' });
  const [errors, setErrors] = useState({}), [busy, setBusy] = useState(false), [state, setState] = useState('idle'), [quote, setQuote] = useState(null);
  const field = name => ({ value: form[name], onChange: e => { setForm({ ...form, [name]: e.target.value }); setErrors({}); setState('idle'); setQuote(null); } });
  return <section className="public-container space-y-10 py-10 sm:py-14"><PageHeader title="Delivery pricing" description="A clear estimate starts with your route and package. Live delivery rates are not available in this release." />
    <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]"><form noValidate className="ui-card space-y-5 p-5 sm:p-7" onSubmit={async e => {
      e.preventDefault(); if (busy) return;
      const next = {}; if (!form.origin.trim()) next.origin = 'Enter a pickup city or district.'; if (!form.destination.trim()) next.destination = 'Enter a delivery city or district.';
      if (!form.weight || !Number.isFinite(Number(form.weight)) || Number(form.weight) <= 0) next.weight = 'Enter a parcel weight greater than zero.';
      setErrors(next); if (Object.keys(next).length) return;
      setBusy(true); setState('loading'); setQuote(null);
      try { const value = await publicServices.quote({ ...form, origin: form.origin.trim(), destination: form.destination.trim(), weight: Number(form.weight) }); if (!value || value.currency !== 'LKR' || !Number.isFinite(value.amount) || value.amount < 0) throw new Error('Invalid quote'); setQuote(value); setState('result'); }
      catch (error) { setState(error.kind === 'unavailable' ? 'unavailable' : 'network'); } finally { setBusy(false); }
    }}><h2 className="flex items-center gap-2 text-lg font-bold"><Calculator size={21} className="text-blue-600" />Delivery fee calculator</h2>
      <div className="grid gap-4 sm:grid-cols-2"><Input required label="Origin city / district" maxLength={120} error={errors.origin} disabled={busy} {...field('origin')} /><Input required label="Destination city / district" maxLength={120} error={errors.destination} disabled={busy} {...field('destination')} /><Input required label="Parcel weight (kg)" type="number" min="0.001" step="any" error={errors.weight} disabled={busy} {...field('weight')} /><Select label="Parcel category" disabled={busy} {...field('category')}><option value="small">Small parcel</option><option value="medium">Medium parcel</option><option value="large">Large parcel</option><option value="documents">Documents</option></Select></div>
      <Button type="submit" busy={busy} className="w-full sm:w-auto">{busy ? 'Checking pricing...' : 'Calculate estimate'}</Button><p className="text-xs leading-5 text-slate-500">Calculator preview. Categories do not represent confirmed rate bands or size limits.</p>
    </form><aside className="ui-card space-y-4 p-5 sm:p-7"><p className="section-eyebrow">Estimated fee · LKR</p>{quote ? <p className="text-3xl font-bold">{new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(quote.amount)}</p> : <p className="text-2xl font-bold">No live estimate available</p>}<p className="text-sm leading-6 text-slate-600">We will show a fee only after it is supplied by a connected pricing service. No SwiftDrop prices or pricing formulas are assumed here.</p>
      {state === 'unavailable' && <p role="status" className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">Live pricing calculation is not connected yet. No fee was calculated and no booking was created.</p>}
      {state === 'network' && <ErrorState message="Pricing could not be reached. Please try again later." />}
      {state === 'loading' && <p role="status" className="text-sm">Checking available pricing...</p>}
    </aside></div>
    <div className="grid gap-6 md:grid-cols-2"><article className="ui-card p-6"><Package className="mb-4 text-blue-600" /><h2 className="text-lg font-bold">What helps prepare an estimate?</h2><p className="mt-3 text-sm leading-7 text-slate-600">Have your pickup and delivery cities, package weight and category ready. Final service availability, rates and any additional charges must come from confirmed delivery rules.</p></article><article className="ui-card p-6"><h2 className="text-lg font-bold">Planning a business account?</h2><p className="mt-3 text-sm leading-7 text-slate-600">Merchant registration is available through an account and administrator review. Merchant approval does not imply a delivery rate or pricing agreement.</p><Link className="ui-button ui-button-secondary mt-4" to="/help#merchant-registration">Merchant registration help</Link></article></div>
  </section>;
}
