import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { merchantApi, authError } from '../api/client';
import { PageHeader, Input, Textarea, Button, LoadingSkeleton, EmptyState, ErrorState } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';

export const businessFields = [
  ['businessName', 'Registered business name', true, 120], ['tradingName', 'Trading name', false, 120],
  ['registrationNumber', 'Business registration number (if applicable)', false, 80], ['category', 'Business category', true, 60],
  ['contactName', 'Contact person', true, 120], ['businessEmail', 'Business email', true, 254], ['phone', 'Business phone', true, 30],
  ['address', 'Business address', true, 500], ['district', 'City / district', true, 120], ['website', 'Website', false, 300],
  ['additionalDetails', 'Additional details', false, 2000],
];
const blank = Object.fromEntries(businessFields.map(([key]) => [key, '']));
const frame = 'max-w-4xl mx-auto p-6 space-y-5';
const button = 'bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50';
export const BusinessSummary = ({ business }) => <dl className="grid sm:grid-cols-2 gap-4 text-sm">
  {businessFields.filter(([key]) => business?.[key]).map(([key, label]) => <div key={key}><dt className="font-semibold text-slate-600">{label}</dt><dd className="break-words">{business[key]}</dd></div>)}
</dl>;
export const MerchantApply = () => {
  const [form, setForm] = useState(blank), [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    merchantApi.get('/merchants/applications/me').then(r => { setApplication(r.data.data); setForm({ ...blank, ...r.data.data.business }); })
      .catch(e => { if (e.response?.status !== 404) setError(authError(e, 'Could not load application')); }).finally(() => setLoading(false));
  }, []);
  return <section className={frame}><PageHeader title="Become a Merchant" />
    <p className="text-slate-600">Tell us about your business. Submitting an application does not grant merchant privileges.</p>
    {error && <ErrorState message={error} />}
    {loading ? <LoadingSkeleton label="Loading application..." /> : application && !['PENDING', 'REJECTED'].includes(application.status) ?
      <Link to="/merchant/application-status" className="text-blue-700">View your application status</Link> :
      <form className="bg-white border rounded-xl p-5 grid sm:grid-cols-2 gap-4" onSubmit={async e => {
        e.preventDefault(); if (busy) return; setBusy(true); setError('');
        try {
          if (application) await merchantApi.put('/merchants/applications/me', { business: form, version: application.version });
          else await merchantApi.post('/merchants/applications', form);
          navigate('/merchant/application-status', { state: { submitted: !application } });
        } catch (e) { setError(authError(e, 'Could not save application')); } finally { setBusy(false); }
      }}>
        {businessFields.map(([key, label, required, max]) => {
          const Control = ['address', 'additionalDetails'].includes(key) ? Textarea : Input;
          return <Control key={key} label={`${label}${required ? ' *' : ''}`} required={required} maxLength={max}
            type={key === 'businessEmail' ? 'email' : key === 'website' ? 'url' : key === 'phone' ? 'tel' : undefined}
            value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />;
        })}
        <Button type="submit" busy={busy}>{busy ? 'Saving...' : application ? 'Save corrections' : 'Submit application'}</Button>
      </form>}
    <Link to="/merchant/application-status" className="block text-blue-700">View application status</Link>
  </section>;
};
export const MerchantStatus = ({ dashboard = false }) => {
  const [application, setApplication] = useState(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      let response;
      if (dashboard) {
        try { response = await merchantApi.get('/merchants/profile'); }
        catch (e) { if (![403, 404].includes(e.response?.status)) throw e; }
      }
      if (!response) response = await merchantApi.get('/merchants/applications/me');
      setApplication(response.data.data);
    } catch (e) { if (e.response?.status === 404) setApplication(null); else setError(authError(e, 'Could not load application')); }
    finally { setLoading(false); }
  }, [dashboard]);
  useEffect(() => { load(); }, [load]);
  return <section className={frame}><PageHeader title={dashboard ? 'Merchant dashboard' : 'Merchant application status'} />
    {loading ? <LoadingSkeleton label="Loading application..." /> : error ? <ErrorState message={error} onRetry={load} /> : !application ?
      <EmptyState title="No merchant business application yet." description="A merchant identity also requires business approval." action={<Link className="ui-button ui-button-primary" to="/merchant/apply">Apply for your business</Link>} /> :
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-xl font-semibold">{application.business.businessName}</h2>
        <p role="status">Status: <StatusBadge status={application.status} /></p>
        <p>Submitted: {new Date(application.submittedAt).toLocaleString()}</p>
        {application.status === 'PENDING' && <p>Your merchant application has been submitted and is awaiting administrator approval.</p>}
        {application.status === 'APPROVING' && <p>Your application is being approved. Account permissions are updating.</p>}
        {application.status === 'REJECTED' && <p className="text-rose-700">Reason: {application.rejectionReason}</p>}
        {application.status === 'APPROVED' && <p>Business approved. Sign in again if your account permissions have changed.</p>}
        <BusinessSummary business={application.business} />
        {['PENDING', 'REJECTED'].includes(application.status) && <Link className="block text-blue-700" to="/merchant/apply">Edit business details</Link>}
        {application.status === 'REJECTED' && <button disabled={busy} className={button} onClick={async () => {
          setBusy(true); setError('');
          try { setApplication((await merchantApi.post('/merchants/applications/me/resubmit', { version: application.version })).data.data); }
          catch (e) { setError(authError(e, 'Could not resubmit application')); } finally { setBusy(false); }
        }}>Resubmit application</button>}
        {dashboard && application.status === 'APPROVED' && <div className="space-y-3"><Link to="/merchant/credentials" className="ui-button ui-button-primary">Manage API credentials</Link><p role="status" className="bg-blue-50 rounded-lg p-4">Delivery order APIs are coming soon.</p></div>}
      </div>}
    {!loading && application && <button onClick={load} className="text-blue-700">Refresh status</button>}
  </section>;
};
export const MerchantDashboard = () => <MerchantStatus dashboard />;
