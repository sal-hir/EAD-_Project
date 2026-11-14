import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { merchantApi, authError } from '../api/client';
import { PageHeader, Input, Button, DataTable, LoadingSkeleton, ErrorState, ConfirmDialog, Toast } from '../components/ui';

function CredentialsPanel({ merchantId }) {
  const admin = Boolean(merchantId);
  const endpoint = admin ? `/merchants/admin/applications/${merchantId}/api-keys` : '/merchants/api-keys';
  const [result, setResult] = useState(null), [loading, setLoading] = useState(true);
  const [label, setLabel] = useState(''), [created, setCreated] = useState(null), [revoking, setRevoking] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    merchantApi.get(endpoint).then(r => { if (current) setResult(r.data.data); })
      .catch(e => { if (current) setError(authError(e, 'Could not load API credentials')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [endpoint, attempt]);
  const generate = async event => {
    event.preventDefault(); if (busy || created) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await merchantApi.post(endpoint, { label: label.trim() });
      const value = response.data.data;
      setCreated(value); setLabel('');
      setResult(previous => ({ ...previous, keys: [value.credential, ...previous.keys] }));
    } catch (e) { setError(authError(e, 'Could not generate API key')); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (busy || !revoking) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await merchantApi.post(`${endpoint}/${revoking.id}/revoke`);
      setResult(previous => ({ ...previous, keys: previous.keys.map(k => k.id === revoking.id ? response.data.data : k) }));
      if (created?.credential.id === revoking.id) setCreated(null);
      setRevoking(null); setNotice('API key revoked. Future requests using this key will be rejected.');
    } catch (e) { setError(authError(e, 'Could not revoke API key')); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(created.apiKey); setNotice('API key copied. Store it securely in your server configuration.'); }
    catch { setError('Could not copy automatically. Select and copy the new API key below.'); }
  };
  return <section className="max-w-6xl mx-auto p-6 space-y-5">
    <PageHeader title={admin ? 'Merchant API key administration' : 'API credentials'}
      description={admin ? 'Inspect credential metadata and revoke access for this business.' : 'Manage keys for your business integrations. Up to five keys can be active.'} />
    <Link className="text-blue-700" to={admin ? '/admin/merchants' : '/merchant'}>{admin ? 'Back to merchant applications' : 'Back to merchant dashboard'}</Link>
    {error && <ErrorState message={error} onRetry={!result ? () => setAttempt(n => n + 1) : undefined} />}
    {notice && <Toast message={notice} onDismiss={() => setNotice('')} />}
    {loading ? <LoadingSkeleton label="Loading API credentials..." /> : result && <>
      <p className="text-sm text-slate-600 break-all">Merchant ID: {result.merchantId}</p>
      {!result.approved && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm">Business approval is required to generate or use API keys. Existing keys can still be revoked.</p>}
      {!admin && result.approved && <form onSubmit={generate} className="ui-card p-5 space-y-3">
        <Input label="Key label" required maxLength={80} value={label} onChange={e => setLabel(e.target.value)} placeholder="Example: Store integration" />
        <Button type="submit" busy={busy} disabled={Boolean(created) || !label.trim() || result.keys.filter(k => k.status === 'ACTIVE').length >= 5}>Generate API key</Button>
        <p className="text-sm text-slate-600">The full key is shown once. Only its prefix and status are available later.</p>
      </form>}
      {created && <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-3">
        <h2 className="font-semibold">Save your new API key</h2>
        <p className="text-sm">Copy it now and store it securely. It cannot be retrieved after you dismiss this message or leave the page.</p>
        <Input label="New API key (shown once)" value={created.apiKey} readOnly autoComplete="off" spellCheck={false} className="font-mono" />
        <div className="flex flex-wrap gap-3"><Button onClick={copy}>Copy API key</Button><Button variant="secondary" onClick={() => setCreated(null)}>I have saved the key</Button></div>
      </div>}
      <DataTable caption="Merchant API keys" rows={result.keys} emptyMessage="No API keys have been generated." columns={[
        { key: 'label', label: 'Label' },
        { key: 'prefix', label: 'Key prefix', render: key => <code>{key.prefix}…</code> },
        { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'Created', render: key => new Date(key.createdAt).toLocaleString() },
        { key: 'revokedAt', label: 'Revoked', render: key => key.revokedAt ? new Date(key.revokedAt).toLocaleString() : '—' },
        { key: 'actions', label: 'Actions', render: key => key.status === 'ACTIVE' ? <Button variant="danger" disabled={busy} onClick={() => setRevoking(key)}>Revoke</Button> : <span className="text-slate-500">Revoked</span> },
      ]} />
      <div className="ui-card p-5 space-y-2 text-sm"><h2 className="font-semibold">Using your API key</h2>
        <p>Send the key from your server in the <code>X-API-Key</code> header. Never put it in a URL or frontend code.</p>
        <p>The authentication check is <code>GET /api/v1/merchant-api/identity</code> on the Merchant API. Order submission will be available when the Merchant Orders API is integrated.</p>
      </div>
    </>}
    <ConfirmDialog open={Boolean(revoking)} onClose={() => setRevoking(null)} onConfirm={revoke} title="Revoke API key?" confirmLabel="Revoke key" busy={busy} danger>
      Revoke “{revoking?.label}”? Integrations using this key will lose access. This cannot be undone.
    </ConfirmDialog>
  </section>;
}

export function MerchantCredentials() {
  const { user } = useAuth();
  return <CredentialsPanel key={user?.id} />;
}
export function AdminMerchantCredentials() {
  const { user } = useAuth(); const { merchantId } = useParams();
  return <CredentialsPanel key={`${user?.id}:${merchantId}`} merchantId={merchantId} />;
}
