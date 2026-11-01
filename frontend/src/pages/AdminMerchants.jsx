import React, { useCallback, useEffect, useState } from 'react';
import { merchantApi, authError } from '../api/client';
import { BusinessSummary } from './MerchantOnboarding';
import { PageHeader, Input, Select, Textarea, Button, DataTable, SearchFilterBar, Pagination, LoadingSkeleton, ErrorState, Toast } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';

export const AdminMerchants = () => {
  const [result, setResult] = useState({ applications: [], page: 0, pages: 0 }), [status, setStatus] = useState('PENDING'), [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null), [audit, setAudit] = useState([]), [decision, setDecision] = useState(''), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const load = useCallback(async (page = 0, filter = 'PENDING', term = '') => {
    const response = await merchantApi.get('/merchants/admin/applications', { params: { page, status: filter || undefined, search: term } });
    setResult(response.data.data);
  }, []);
  useEffect(() => { load().catch(e => setError(authError(e, 'Could not load applications'))).finally(() => setLoading(false)); }, [load]);
  const run = async task => {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await task(); } catch (e) { setError(authError(e, 'Review operation failed')); } finally { setBusy(false); }
  };
  const view = async id => {
    const response = await merchantApi.get(`/merchants/admin/applications/${id}`); setSelected(response.data.data);
    setAudit((await merchantApi.get(`/merchants/admin/applications/${id}/audit`)).data.data); setDecision(''); setReason('');
  };
  return <section className="max-w-6xl mx-auto p-6 space-y-5"><PageHeader title="Merchant applications" description="Review businesses, record decisions and follow approval progress." />
    {error && <ErrorState message={error} />}{notice && <Toast message={notice} onDismiss={() => setNotice('')} />}
    <SearchFilterBar onSubmit={e => { e.preventDefault(); run(() => load(0, status, search)); }}>
      <Input label="Search" className="sm:flex-1" maxLength={120} value={search} onChange={e => setSearch(e.target.value)} />
      <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">All</option>{['PENDING', 'APPROVING', 'APPROVED', 'REJECTED'].map(s => <option key={s}>{s}</option>)}
      </Select><Button type="submit" variant="secondary" busy={busy}>Filter applications</Button>
    </SearchFilterBar>
    {loading ? <LoadingSkeleton label="Loading applications..." /> : <DataTable caption="Merchant applications" rows={result.applications} emptyMessage="No applications match this filter." columns={[
      { key: 'business', label: 'Business', render: a => a.business.businessName },
      { key: 'contact', label: 'Contact', render: a => a.business.businessEmail },
      { key: 'status', label: 'Status', render: a => <StatusBadge status={a.status} /> },
      { key: 'submittedAt', label: 'Submitted', render: a => <time className="whitespace-nowrap" dateTime={a.submittedAt}>{new Date(a.submittedAt).toLocaleDateString()}</time> },
      { key: 'review', label: 'Review', render: a => <Button variant="ghost" busy={busy} onClick={() => run(() => view(a.id))}>View details</Button> },
    ]} />}
    <Pagination page={result.page} pages={result.pages} disabled={busy} onPageChange={page => run(() => load(page, status, search))} />
    {selected && <article className="bg-white border rounded-xl p-5 space-y-4"><h2 className="text-xl font-semibold">Review {selected.business.businessName}</h2>
      <p>Status: <StatusBadge status={selected.status} /></p><BusinessSummary business={selected.business} />
      {selected.rejectionReason && <p>Rejection reason: {selected.rejectionReason}</p>}
      {selected.status === 'APPROVING' && <p role="status">Approval is waiting for account permissions to update. Check service availability and retry approval.</p>}
      {['PENDING', 'APPROVING'].includes(selected.status) && <div className="flex gap-4">
        <button disabled={busy} onClick={() => setDecision('approve')} className="text-blue-700">{selected.status === 'APPROVING' ? 'Retry approval' : 'Approve'}</button>
        {selected.status === 'PENDING' && <button disabled={busy} onClick={() => setDecision('reject')} className="text-rose-700">Reject</button>}
      </div>}
      {decision && <form className="space-y-3 border rounded-lg p-4" onSubmit={e => { e.preventDefault(); run(async () => {
        const body = { version: selected.version, ...(decision === 'reject' ? { reason } : {}) };
        const response = await merchantApi.post(`/merchants/admin/applications/${selected.id}/${decision}`, body);
        setNotice(response.data.data.status === 'APPROVING' ? 'Approval recorded. Account update is pending; retry when the service is available.' : 'Application review saved.');
        await view(selected.id); await load(result.page, status, search);
      }); }}>
        <p>Confirm you have reviewed this business application and want to {decision} it.</p>
        {decision === 'reject' && <Textarea label="Rejection reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} />}
        <button disabled={busy} className="bg-blue-600 text-white rounded-lg px-4 py-2">Confirm {decision === 'approve' ? 'approval' : 'rejection'}</button>
        <button type="button" className="ml-4" onClick={() => setDecision('')}>Cancel</button>
      </form>}
      <h3 className="font-semibold">Decision history</h3>
      {audit.map(event => <p key={event.id} className="break-words text-sm">{new Date(event.createdAt).toLocaleString()} · {event.action} · {event.detail} · {event.actorId}</p>)}
    </article>}
  </section>;
};
