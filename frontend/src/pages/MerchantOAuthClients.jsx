import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { merchantApi, authError } from '../api/client';
import { PageHeader, Input, Button, DataTable, LoadingSkeleton, ErrorState, ConfirmDialog, Toast } from '../components/ui';

const availableScopes = [
  ['merchant:read', 'Read merchant identity'], ['orders:write', 'Submit merchant orders'],
];
function OAuthPanel({ merchantId }) {
  const admin = Boolean(merchantId);
  const endpoint = admin ? `/merchants/admin/applications/${merchantId}/oauth-clients` : '/merchants/oauth-clients';
  const [result, setResult] = useState(null), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0);
  const [label, setLabel] = useState(''), [scopes, setScopes] = useState(['merchant:read', 'orders:write']);
  const [revealed, setRevealed] = useState(null), [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => {
    let current = true; setLoading(true); setError('');
    merchantApi.get(endpoint).then(r => { if (current) setResult(r.data.data); })
      .catch(e => { if (current) setError(authError(e, 'Could not load OAuth clients')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [endpoint, attempt]);
  const create = async event => {
    event.preventDefault(); if (busy || revealed) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const value = (await merchantApi.post(endpoint, { label: label.trim(), scopes })).data.data;
      setRevealed(value); setLabel('');
      setResult(previous => ({ ...previous, clients: [value.credential, ...previous.clients] }));
    } catch (e) { setError(authError(e, 'Could not create OAuth client')); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (busy || !action) return; setBusy(true); setError(''); setNotice('');
    try {
      const value = (await merchantApi.post(`${endpoint}/${action.client.id}/${action.operation}`)).data.data;
      const updated = action.operation === 'rotate' ? value.credential : value;
      setResult(previous => ({ ...previous, clients: previous.clients.map(client => client.id === updated.id ? updated : client) }));
      if (action.operation === 'rotate') { setRevealed(value); setNotice('Client secret rotated. The previous secret and all existing access tokens are invalid.'); }
      else { if (revealed?.credential.id === updated.id) setRevealed(null); setNotice('OAuth client revoked. Its secret and access tokens can no longer be used.'); }
      setAction(null);
    } catch (e) { setError(authError(e, 'OAuth client operation failed')); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(revealed.clientSecret); setNotice('Client secret copied. Store it securely on your server.'); }
    catch { setError('Could not copy automatically. Select and copy the client secret below.'); }
  };
  return <section className="max-w-6xl mx-auto p-6 space-y-5">
    <PageHeader title={admin ? 'Merchant OAuth client administration' : 'OAuth client credentials'}
      description="Manage server applications that request short-lived access tokens." />
    <Link className="text-blue-700" to={admin ? '/admin/merchants' : '/merchant'}>{admin ? 'Back to merchant applications' : 'Back to merchant dashboard'}</Link>
    {error && <ErrorState message={error} onRetry={!result ? () => setAttempt(n => n + 1) : undefined} />}
    {notice && <Toast message={notice} onDismiss={() => setNotice('')} />}
    {loading ? <LoadingSkeleton label="Loading OAuth clients..." /> : result && <>
      <p className="text-sm text-slate-600 break-all">Merchant ID: {result.merchantId}</p>
      {!result.approved && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm">Business approval is required to create clients, rotate secrets or obtain access tokens. Existing clients can still be revoked.</p>}
      {!admin && result.approved && <form onSubmit={create} className="ui-card p-5 space-y-4">
        <Input label="Client label" required maxLength={80} value={label} onChange={e => setLabel(e.target.value)} placeholder="Example: Store backend" />
        <fieldset className="space-y-2"><legend className="font-semibold text-sm">Allowed permissions</legend>
          {availableScopes.map(([scope, description]) => <label key={scope} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={scopes.includes(scope)} onChange={e => setScopes(previous => e.target.checked ? [...previous, scope] : previous.filter(value => value !== scope))} />
            {description} ({scope})
          </label>)}
        </fieldset>
        <Button type="submit" busy={busy} disabled={Boolean(revealed) || !label.trim() || !scopes.length || result.clients.filter(client => client.status === 'ACTIVE').length >= 5}>Create OAuth client</Button>
        <p className="text-sm text-slate-600">Up to five clients can be active. Each client secret is shown once.</p>
      </form>}
      {revealed && <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-3">
        <h2 className="font-semibold">Save your client credentials</h2>
        <p className="text-sm">The client ID stays available in the list. Copy the secret now; it cannot be retrieved after leaving this page.</p>
        <Input label="Client ID" readOnly value={revealed.credential.clientId} className="font-mono" />
        <Input label="Client secret (shown once)" readOnly value={revealed.clientSecret} autoComplete="off" spellCheck={false} className="font-mono" />
        <div className="flex flex-wrap gap-3"><Button onClick={copy}>Copy client secret</Button><Button variant="secondary" onClick={() => setRevealed(null)}>I have saved the client secret</Button></div>
      </div>}
      <DataTable caption="Merchant OAuth clients" rows={result.clients} emptyMessage="No OAuth clients have been created." columns={[
        { key: 'label', label: 'Label' }, { key: 'clientId', label: 'Client ID', render: client => <code className="break-all">{client.clientId}</code> },
        { key: 'scopes', label: 'Permissions', render: client => client.scopes.join(', ') }, { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'Created', render: client => new Date(client.createdAt).toLocaleString() },
        { key: 'rotatedAt', label: 'Secret rotated', render: client => client.rotatedAt ? new Date(client.rotatedAt).toLocaleString() : '—' },
        { key: 'actions', label: 'Actions', render: client => client.status === 'ACTIVE' ? <div className="flex flex-wrap gap-2">
          {!admin && result.approved && <Button variant="secondary" disabled={busy || Boolean(revealed)} onClick={() => setAction({ client, operation: 'rotate' })}>Rotate secret</Button>}
          <Button variant="danger" disabled={busy} onClick={() => setAction({ client, operation: 'revoke' })}>Revoke client</Button>
        </div> : <span className="text-slate-500">Revoked</span> },
      ]} />
      <div className="ui-card p-5 space-y-2 text-sm"><h2 className="font-semibold">Connect your server</h2>
        <p>Request a token from <code>POST /api/v1/oauth/token</code> on the Merchant API using HTTP Basic client authentication and form field <code>grant_type=client_credentials</code>.</p>
        <p>Use the returned token in an <code>Authorization: Bearer</code> header. The identity check is <code>GET /api/v1/merchant-api/oauth/identity</code> and requires <code>merchant:read</code>.</p>
        <p>Keep secrets and tokens on your server. Order submission will become available when the Merchant Orders API is integrated.</p>
      </div>
    </>}
    <ConfirmDialog open={Boolean(action)} onClose={() => setAction(null)} onConfirm={confirm}
      title={action?.operation === 'rotate' ? 'Rotate client secret?' : 'Revoke OAuth client?'}
      confirmLabel={action?.operation === 'rotate' ? 'Confirm rotation' : 'Confirm client revocation'} busy={busy} danger>
      {action?.operation === 'rotate' ? `Replace the secret for “${action.client.label}”? The old secret and all issued tokens will stop working immediately.` : `Revoke “${action?.client.label}”? This invalidates its secret and all access tokens. This cannot be undone.`}
    </ConfirmDialog>
  </section>;
}
export function MerchantOAuthClients() { const { user } = useAuth(); return <OAuthPanel key={user?.id} />; }
export function AdminMerchantOAuthClients() {
  const { user } = useAuth(); const { merchantId } = useParams(); return <OAuthPanel key={`${user?.id}:${merchantId}`} merchantId={merchantId} />;
}
