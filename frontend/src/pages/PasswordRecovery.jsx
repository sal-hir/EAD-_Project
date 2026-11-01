import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, authError } from '../api/client';

const input = 'border rounded-lg p-2 block w-full mt-1';
const button = 'bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50';
const frame = 'max-w-md mx-auto my-12 bg-white border rounded-xl p-6 space-y-4';
export const ForgotPassword = () => {
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  return <section className={frame}><h1 className="text-2xl font-bold">Forgot password?</h1>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {done ? <p role="status">If an eligible account exists, password reset instructions will be sent. If you use Google sign-in, continue with Google.</p> :
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); if (busy) return; setBusy(true); setError('');
        try { await api.post('/auth/password/forgot', { email }); setDone(true); }
        catch (e) { setError(authError(e, 'Could not request password recovery')); }
        finally { setBusy(false); }
      }}><label>Email address<input required type="email" maxLength={254} autoComplete="email" className={input} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <button disabled={busy} className={button}>{busy ? 'Sending...' : 'Send reset instructions'}</button></form>}
    <Link to="/login" className="block text-blue-700">Back to sign in</Link>
  </section>;
};
export const ResetPassword = () => {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'));
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  return <section className={frame}><h1 className="text-2xl font-bold">Reset password</h1>
    {!token && <p role="alert">Reset link missing. Request a new password reset link.</p>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {done ? <p role="status">Password changed. Sign in again with your new password.</p> :
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); if (busy) return;
        if (password !== confirmation) { setError('Passwords must match'); return; }
        setBusy(true); setError('');
        try {
          await api.post('/auth/password/reset', { token, newPassword: password });
          window.dispatchEvent(new Event('swiftdrop:unauthorized'));
          setPassword(''); setConfirmation(''); setDone(true);
        } catch (e) { setError(authError(e, 'Reset link expired or unavailable')); }
        finally { setBusy(false); }
      }}>
        <label>New password<input required type="password" minLength={8} maxLength={72} pattern="[\x20-\x7E]+" autoComplete="new-password" className={input} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Confirm password<input required type="password" autoComplete="new-password" className={input} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        <button disabled={busy || !token} className={button}>Change password</button>
      </form>}
    <Link to="/login" className="block text-blue-700">Back to sign in</Link>
    <Link to="/forgot-password" className="block text-blue-700">Request another reset link</Link>
  </section>;
};
