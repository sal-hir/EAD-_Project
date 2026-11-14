import React, { useCallback, useEffect, useRef, useState } from 'react';
import { merchantApi, authError } from '../../api/client';
import { Button, Input, Select, Modal } from '../../components/ui';

const base = '/merchants/operations';
const date = value => value ? new Date(value).toLocaleString() : '—';
export function MerchantOperations() {
  const [orders, setOrders] = useState({ orders: [], total: 0 });
  const [page, setPage] = useState(0), [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [settings, setSettings] = useState(null), [url, setUrl] = useState(''), [enabled, setEnabled] = useState(false);
  const [logs, setLogs] = useState({ deliveries: [], total: 0 }), [logPage, setLogPage] = useState(0);
  const [detail, setDetail] = useState(null), [delivery, setDelivery] = useState(null);
  const [secret, setSecret] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const load = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true); setError('');
    try {
      const [o, s, l] = await Promise.all([
        merchantApi.get(`${base}/orders`, { params: { page, size: 20, status: filter } }),
        merchantApi.get(`${base}/webhook`),
        merchantApi.get(`${base}/webhook/deliveries`, { params: { page: logPage, size: 20 } }),
      ]);
      if (current !== revision.current) return;
      setOrders(o.data.data); setSettings(s.data.data); setUrl(s.data.data.url); setEnabled(s.data.data.enabled); setLogs(l.data.data);
    } catch (e) { if (current === revision.current) setError(authError(e, 'Could not load merchant orders and webhooks')); }
    finally { if (current === revision.current) setLoading(false); }
  }, [page, filter, logPage]);
  useEffect(() => { load(); return () => { revision.current++; }; }, [load]);
  const action = async work => {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(authError(e, 'Operation failed')); } finally { setBusy(false); }
  };
  const refreshLogs = async () => setLogs((await merchantApi.get(`${base}/webhook/deliveries`, { params: { page: logPage, size: 20 } })).data.data);
  return <div className="space-y-8">
    <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Orders and integrations</h2><Button variant="secondary" onClick={load} disabled={loading || busy}>Refresh orders and webhooks</Button></div>
    {error && <div role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-800">{error}<Button variant="ghost" onClick={load}>Retry loading</Button></div>}
    {message && <p role="status" className="text-emerald-800">{message}</p>}
    {loading ? <p role="status">Loading orders and webhooks…</p> : !settings ? null : <>
      <section aria-label="Merchant orders" className="space-y-4">
        <Select label="Order status" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="">All statuses</option><option value="PENDING_BOOKING">Pending booking</option></Select>
        <p className="text-sm text-slate-600">Orders awaiting parcel booking have no tracking number yet.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Merchant delivery orders</caption><thead><tr><th className="p-3">Order reference</th><th>Status</th><th>Created</th><th>Tracking number</th><th>Details</th></tr></thead><tbody>
          {orders.orders.map(order => <tr key={order.id} className="border-t"><td className="p-3">{order.merchantOrderId}</td><td>{order.status}</td><td>{date(order.createdAt)}</td><td>{order.trackingNumber || 'Awaiting booking'}</td><td><Button variant="ghost" disabled={busy} onClick={() => action(async () => setDetail((await merchantApi.get(`${base}/orders/${order.id}`)).data.data))}>View {order.merchantOrderId}</Button></td></tr>)}
        </tbody></table></div>
        {!orders.orders.length && <p>No orders match this filter.</p>}
        <div className="flex items-center gap-3"><Button disabled={page === 0 || busy} onClick={() => setPage(p => p - 1)}>Previous orders</Button><span>Page {page + 1} · {orders.total} orders</span><Button disabled={(page + 1) * 20 >= orders.total || busy} onClick={() => setPage(p => p + 1)}>Next orders</Button></div>
      </section>
      <section aria-label="Webhook settings" className="space-y-4 border-t pt-6"><h3 className="text-lg font-semibold">Webhook settings</h3>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); action(async () => {
          setSecret(''); const result = (await merchantApi.put(`${base}/webhook`, { url, enabled })).data.data;
          setSettings(result.settings); setSecret(result.signingSecret || ''); setMessage('Webhook settings saved.'); await refreshLogs();
        }); }}>
          <Input label="Webhook URL" type="url" required maxLength={2000} placeholder="https://shop.example/webhooks/swiftdrop" value={url} onChange={e => setUrl(e.target.value)} />
          <label className="flex gap-2"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Enable webhook delivery</label>
          <p className="text-sm text-slate-600">Public HTTPS endpoints on port 443 only. Disabling, changing the URL or rotating the secret cancels queued deliveries. A request already in flight may finish.</p>
          <Button type="submit" disabled={busy}>Save webhook settings</Button>
        </form>
        <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={busy || !settings.configured} onClick={() => {
          if (!window.confirm('Rotate the signing secret? Update your receiver; queued deliveries will be cancelled.')) return;
          action(async () => { setSecret(''); const result = (await merchantApi.post(`${base}/webhook/rotate`)).data.data; setSecret(result.signingSecret); setSettings(result.settings); await refreshLogs(); });
        }}>Rotate signing secret</Button><Button disabled={busy || !settings.configured || !settings.enabled} onClick={() => action(async () => {
          await merchantApi.post(`${base}/webhook/test`); setMessage('Test webhook queued. Refresh delivery history to see its result.'); await refreshLogs();
        })}>Send test webhook</Button></div>
        {secret && <div className="rounded-lg bg-amber-50 p-4 space-y-2"><p>Save this signing secret now. It is shown once.</p><code className="block break-all">{secret}</code><Button variant="secondary" onClick={() => action(async () => { await navigator.clipboard.writeText(secret); setMessage('Signing secret copied.'); })}>Copy signing secret</Button><Button variant="ghost" onClick={() => setSecret('')}>Dismiss signing secret</Button></div>}
      </section>
      <section aria-label="Webhook delivery history" className="space-y-4 border-t pt-6"><h3 className="text-lg font-semibold">Webhook delivery history</h3>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Event</th><th>State</th><th>Attempts</th><th>Next attempt / lease expiry</th><th>History</th></tr></thead><tbody>{logs.deliveries.map(log => <tr key={log.id} className="border-t"><td className="p-3">{log.eventType}</td><td>{log.state}</td><td>{log.attempts}</td><td>{date(log.nextAttemptAt)}</td><td><Button variant="ghost" disabled={busy} onClick={() => action(async () => setDelivery((await merchantApi.get(`${base}/webhook/deliveries/${log.id}`)).data.data))}>View attempts {log.id.slice(0, 8)}</Button></td></tr>)}</tbody></table></div>
        {!logs.deliveries.length && <p>No webhook deliveries yet.</p>}
        <div className="flex items-center gap-3"><Button disabled={logPage === 0 || busy} onClick={() => setLogPage(p => p - 1)}>Previous deliveries</Button><span>Page {logPage + 1} · {logs.total} deliveries</span><Button disabled={(logPage + 1) * 20 >= logs.total || busy} onClick={() => setLogPage(p => p + 1)}>Next deliveries</Button></div>
      </section>
    </>}
    <Modal open={!!detail} onClose={() => setDetail(null)} title="Order details">{detail && <div className="space-y-3"><p>Reference: {detail.merchantOrderId}</p><p>Status: {detail.status}</p><p>Tracking: {detail.trackingNumber || 'Awaiting booking'}</p><h3>Pickup</h3><p>{detail.request.pickup.name} · {detail.request.pickup.phone}</p><p>{detail.request.pickup.address}, {detail.request.pickup.district}</p><h3>Recipient</h3><p>{detail.request.recipient.name} · {detail.request.recipient.phone}</p><p>{detail.request.recipient.address}, {detail.request.recipient.district}</p><p>{detail.request.parcel.description} · {detail.request.parcel.weightKg} kg · {detail.request.serviceType}</p>{detail.request.notes && <p>{detail.request.notes}</p>}</div>}</Modal>
    <Modal open={!!delivery} onClose={() => setDelivery(null)} title="Delivery attempts">{delivery && <div className="space-y-3"><p>State: {delivery.delivery.state}</p>{delivery.attempts.length ? <ol>{delivery.attempts.map(attempt => <li key={attempt.attemptNumber}>Attempt {attempt.attemptNumber}: {attempt.responseStatus ?? 'No HTTP response'} · {attempt.outcome} · {date(attempt.createdAt)}</li>)}</ol> : <p>No attempts yet. Delivery is queued.</p>}</div>}</Modal>
  </div>;
}
