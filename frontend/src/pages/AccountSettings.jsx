import React, { useEffect, useState } from 'react';
import { api, API_BASE_URL, authError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const AccountSettings = () => {
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/auth/account').then(r => setAccount(r.data.data)).catch(e => setError(authError(e, 'Could not load account'))); }, []);
  const connect = async e => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const base64url = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      const response = await api.post('/auth/google/link', { password, challenge });
      setPassword('');
      sessionStorage.setItem('swiftdrop_oauth_verifier', verifier);
      window.location.assign(`${API_BASE_URL}${response.data.data.authorizationPath}`);
    } catch (e) { setPassword(''); setError(authError(e, 'Google linking failed')); setBusy(false); }
  };
  return <section className="max-w-lg mx-auto my-12 bg-white border rounded-xl p-6 space-y-4">
    <h1 className="text-2xl font-bold">Account settings</h1>
    <p>{user.email} · {user.role}</p>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {!account && !error && <p role="status">Loading account...</p>}
    {account?.googleLinked && <p role="status">Google account connected.</p>}
    {account && !account.googleLinked && account.passwordEnabled && <form onSubmit={connect} className="space-y-4">
      <p>Connect your verified Google account with the same email address. Confirm your current password first. Your role stays the same.</p>
      {!account.googleAvailable && <p>Google sign-in is unavailable until configured.</p>}
      <label className="block">Current password<input required maxLength={72} type="password" autoComplete="current-password" className="border rounded-lg p-2 block w-full" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button disabled={busy || !account.googleAvailable} className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">Connect Google Account</button>
    </form>}
  </section>;
};
