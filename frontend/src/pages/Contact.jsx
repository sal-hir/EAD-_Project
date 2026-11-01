import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, HelpCircle } from 'lucide-react';
import { PageHeader, Input, Textarea, Button, ErrorState } from '../components/ui';
import { publicServices } from '../api/publicServices';

export function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' }), [errors, setErrors] = useState({}), [busy, setBusy] = useState(false), [state, setState] = useState('idle');
  const field = name => ({ value: form[name], onChange: e => { setForm({ ...form, [name]: e.target.value }); setErrors({}); setState('idle'); } });
  return <section className="public-container space-y-8 py-10 sm:py-14"><PageHeader title="Contact SwiftDrop" description="Have a question? Start with our help center. Online message submission is not connected yet." />
    <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]"><form noValidate className="ui-card space-y-5 p-5 sm:p-7" onSubmit={async e => {
      e.preventDefault(); if (busy) return;
      const next = {}; for (const key of ['name', 'subject', 'message']) if (!form[key].trim()) next[key] = `Enter your ${key}.`;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
      setErrors(next); if (Object.keys(next).length) return;
      setBusy(true); setState('loading');
      try { const receipt = await publicServices.contact(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]))); if (receipt?.accepted !== true) throw new Error('No confirmed submission'); setState('submitted'); }
      catch (error) { setState(error.kind === 'unavailable' ? 'unavailable' : 'network'); } finally { setBusy(false); }
    }}><h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquare className="text-blue-600" size={21} />Send a message</h2>
      <div className="grid gap-4 sm:grid-cols-2"><Input required label="Name" autoComplete="name" maxLength={120} disabled={busy} error={errors.name} {...field('name')} /><Input required label="Email" type="email" autoComplete="email" maxLength={254} disabled={busy} error={errors.email} {...field('email')} /></div>
      <Input required label="Subject" maxLength={160} disabled={busy} error={errors.subject} {...field('subject')} /><Textarea required label="Message" maxLength={3000} disabled={busy} error={errors.message} hint="Do not include passwords, verification links or payment information." {...field('message')} />
      <Button type="submit" busy={busy}>{busy ? 'Checking availability...' : 'Submit message'}</Button>
      {state === 'unavailable' && <p role="status" className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">Message submission is not connected yet. Your message has not been sent.</p>}
      {state === 'network' && <ErrorState message="Your message could not be sent. Please try again later." />}
      {state === 'submitted' && <p role="status">Your message was accepted by the connected contact service.</p>}
    </form><aside className="space-y-5"><div className="ui-card p-6"><HelpCircle className="mb-4 text-blue-600" /><h2 className="text-lg font-bold">Find an answer first</h2><p className="mt-3 text-sm leading-6 text-slate-600">Our help center explains account access, password recovery, merchant registration and the features currently available.</p><Link className="ui-button ui-button-secondary mt-5" to="/help">Open help center</Link></div><div className="rounded-2xl border border-slate-200 p-6"><h2 className="font-semibold">A note about availability</h2><p className="mt-3 text-sm leading-6 text-slate-600">No public support address or contact submission service is configured in this release. We will list verified contact details when they are provided.</p></div></aside></div>
  </section>;
}
