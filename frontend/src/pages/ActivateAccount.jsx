import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, authError } from '../api/client';

export const ActivateAccount = () => {
  const [code] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('code'));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  return <section className="max-w-md mx-auto my-12 bg-white border rounded-xl p-6 space-y-4">
    <h1 className="text-2xl font-bold">Activate your account</h1>
    {done ? <><p role="status">Password set. You can now sign in.</p><Link className="text-blue-700" to="/login">Sign in</Link></> : <>
      {!code && <p role="alert">Activation link missing. Ask your administrator for a new link.</p>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); if (busy) return;
        if (password !== confirmation) { setError('Passwords must match'); return; }
        setBusy(true); setError('');
        try { await api.post('/auth/activate', { code, password }); setPassword(''); setConfirmation(''); setDone(true); }
        catch (e) { setError(authError(e, 'Activation failed')); }
        finally { setBusy(false); }
      }}>
        <label className="block">New password<input className="border rounded-lg p-2 block w-full" required type="password" autoComplete="new-password" minLength={8} maxLength={72} pattern="[\x20-\x7E]+" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label className="block">Confirm password<input className="border rounded-lg p-2 block w-full" required type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        <button className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy || !code}>Set password</button>
      </form>
    </>}
  </section>;
};
