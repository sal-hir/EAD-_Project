import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, authError } from '../api/client';
import { AuthPanel, PasswordInput, passwordRules } from '../components/PublicWebsite';
import { Button, ErrorState, Toast } from '../components/ui';

export const ActivateAccount = () => {
  const [code] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('code'));
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  return <AuthPanel title="Activate your account" description="Set your own password using the private invitation provided by your administrator." footer={<Link className="font-semibold text-blue-700" to="/login">Sign in</Link>}>
    {done ? <Toast message="Password set. You can now sign in." /> : <>
      {!code && <ErrorState message="Activation link missing. Ask your administrator for a new link." />}
      {error && <ErrorState message={error} />}
      <form className="space-y-5" onSubmit={async e => {
        e.preventDefault(); if (busy) return;
        if (password !== confirmation) { setError('Passwords must match'); return; }
        setBusy(true); setError('');
        try { await api.post('/auth/activate', { code, password }); setPassword(''); setConfirmation(''); setDone(true); }
        catch (e) { setError(authError(e, 'Activation failed')); }
        finally { setBusy(false); }
      }}>
        <PasswordInput label="New password" required autoComplete="new-password" {...passwordRules} hint="Use 8–72 printable ASCII characters." disabled={busy} value={password} onChange={e => setPassword(e.target.value)} />
        <PasswordInput label="Confirm password" required maxLength={72} autoComplete="new-password" disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        <Button type="submit" busy={busy} disabled={!code} className="w-full">{busy ? 'Activating...' : 'Set password'}</Button>
      </form><p className="text-xs leading-6 text-slate-500">Activation links expire after 30 minutes and work once. Ask your administrator for a new invitation if the link is unavailable. Activation does not sign you in automatically.</p>
    </>}
  </AuthPanel>;
};
