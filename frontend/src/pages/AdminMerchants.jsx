import React, { useCallback, useEffect, useState } from 'react';
import { merchantApi, authError } from '../api/client';
import { BusinessSummary } from './MerchantOnboarding';

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
  return <section className="max-w-6xl mx-auto p-6 space-y-5"><h1 className="text-2xl font-bold">Merchant applications</h1>
    {error && <p role="alert" className="text-rose-700">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); run(() => load(0, status, search)); }}>
      <label>Search<input className="border rounded-lg p-2 block" maxLength={120} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Status<select className="border rounded-lg p-2 block" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">All</option>{['PENDING', 'APPROVING', 'APPROVED', 'REJECTED'].map(s => <option key={s}>{s}</option>)}
      </select></label><button disabled={busy} className="border rounded-lg px-4 py-2">Filter applications</button>
    </form>
    {loading ? <p role="status">Loading applications...</p> : <div className="overflow-x-auto bg-white border rounded-xl"><table className="w-full text-sm text-left">
      <thead><tr>{['Business', 'Contact', 'Status', 'Submitted', 'Review'].map(s => <th className="p-3" key={s}>{s}</th>)}</tr></thead>
      <tbody>{result.applications.map(a => <tr className="border-t" key={a.id}><td className="p-3">{a.business.businessName}</td><td className="p-3">{a.business.businessEmail}</td><td className="p-3">{a.status}</td><td className="p-3">{new Date(a.submittedAt).toLocaleDateString()}</td>
        <td className="p-3"><button disabled={busy} className="text-blue-700" onClick={() => run(() => view(a.id))}>View details</button></td></tr>)}</tbody>
    </table>{result.applications.length === 0 && <p className="p-4">No applications match this filter.</p>}</div>}
    <div className="flex gap-4"><button disabled={busy || result.page === 0} onClick={() => run(() => load(result.page - 1, status, search))}>Previous</button><span>Page {result.page + 1} of {Math.max(1, result.pages)}</span><button disabled={busy || result.page + 1 >= result.pages} onClick={() => run(() => load(result.page + 1, status, search))}>Next</button></div>
    {selected && <article className="bg-white border rounded-xl p-5 space-y-4"><h2 className="text-xl font-semibold">Review {selected.business.businessName}</h2>
      <p>Status: {selected.status}</p><BusinessSummary business={selected.business} />
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
        {decision === 'reject' && <label>Rejection reason<textarea required maxLength={1000} className="border rounded-lg p-2 block w-full" value={reason} onChange={e => setReason(e.target.value)} /></label>}
        <button disabled={busy} className="bg-blue-600 text-white rounded-lg px-4 py-2">Confirm {decision === 'approve' ? 'approval' : 'rejection'}</button>
        <button type="button" className="ml-4" onClick={() => setDecision('')}>Cancel</button>
      </form>}
      <h3 className="font-semibold">Decision history</h3>
      {audit.map(event => <p key={event.id} className="text-sm">{new Date(event.createdAt).toLocaleString()} · {event.action} · {event.detail} · {event.actorId}</p>)}
    </article>}
  </section>;
};
