import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, authError } from '../api/client';
import { AuthPanel, PasswordInput, passwordRules } from '../components/PublicWebsite';
import { Input, Button, ErrorState, Toast } from '../components/ui';

export const ForgotPassword = () => {
  const [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  return <AuthPanel title="Forgot password?" description="Enter your email to request a single-use password reset link." footer={<Link className="font-semibold text-blue-700" to="/login">Back to sign in</Link>}>
    {error && <ErrorState message={error} />}
    {done ? <Toast message="If an eligible account exists, password reset instructions will be sent. If you use Google sign-in, continue with Google." /> :
      <form className="space-y-5" onSubmit={async e => {
        e.preventDefault(); if (busy) return; setBusy(true); setError('');
        try { await api.post('/auth/password/forgot', { email }); setDone(true); }
        catch (e) { setError(authError(e, 'Could not request password recovery')); }
        finally { setBusy(false); }
      }}><Input required label="Email address" type="email" maxLength={254} autoComplete="email" disabled={busy} value={email} onChange={e => setEmail(e.target.value)} />
        <Button type="submit" busy={busy} className="w-full">{busy ? 'Sending...' : 'Send reset instructions'}</Button></form>}
    <p className="text-xs leading-6 text-slate-500">Use the latest valid link within 20 minutes. If you normally sign in with Google, continue with Google instead. Never share a reset link.</p>
  </AuthPanel>;
};
export const ResetPassword = () => {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token'));
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  return <AuthPanel title="Reset password" description="Choose a new password. All existing sessions will be revoked after a successful reset." footer={<Link className="font-semibold text-blue-700" to="/login">Back to sign in</Link>}>
    {!token && <ErrorState message="Reset link missing. Request a new password reset link." />}
    {error && <ErrorState message={error} />}
    {done ? <Toast message="Password changed. Sign in again with your new password." /> :
      <form className="space-y-5" onSubmit={async e => {
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
        <PasswordInput label="New password" required {...passwordRules} autoComplete="new-password" hint="Use 8–72 printable ASCII characters." disabled={busy} value={password} onChange={e => setPassword(e.target.value)} />
        <PasswordInput label="Confirm password" required maxLength={72} autoComplete="new-password" disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        <Button type="submit" busy={busy} disabled={!token} className="w-full">{busy ? 'Changing password...' : 'Change password'}</Button>
      </form>}
    <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-medium text-blue-700">Request another reset link</Link>
  </AuthPanel>;
};
