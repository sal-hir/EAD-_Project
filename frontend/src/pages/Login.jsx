import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE_URL, authError, dashboardPath } from '../api/client';
import { AuthPanel, PasswordInput } from '../components/PublicWebsite';
import { Input, Button, ErrorState } from '../components/ui';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(new URLSearchParams(window.location.search).get('error') === 'google_activation_required' ? 'Complete the activation or verification required for your existing account, then try Google again. Ask your administrator for a new activation link if needed.' : new URLSearchParams(window.location.search).has('error') ? 'Google sign-in failed. Try again with your verified Google account, or use your password.' : '');
  const [googleAvailable, setGoogleAvailable] = useState(false);
  useEffect(() => {
    api.get('/auth/providers').then(res => setGoogleAvailable(res.data.data.google)).catch(() => setGoogleAvailable(false));
  }, []);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      navigate(dashboardPath(user.role));
    } catch (err) {
      setError(authError(err, 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading || !googleAvailable) return;
    setLoading(true);
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const base64url = (value) => btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      const verifier = base64url(bytes);
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      sessionStorage.setItem('swiftdrop_oauth_verifier', verifier);
      window.location.assign(`${API_BASE_URL}/oauth2/authorization/google?challenge=${base64url(new Uint8Array(hash))}`);
    } catch (error) {
      setError('Google sign-in could not start. Use HTTPS or localhost and allow session storage.');
      setLoading(false);
    }
  };

  return <AuthPanel title="Welcome back" description="Sign in to your SwiftDrop account." footer={<>New to SwiftDrop? <Link className="font-semibold text-blue-700 hover:underline" to="/register">Create one now</Link></>}>
    {error && <ErrorState message={error} />}
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="Email address" id="email" autoComplete="email" type="email" maxLength={254} required value={email} disabled={loading} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
      <PasswordInput label="Password" id="password" autoComplete="current-password" required value={password} disabled={loading} onChange={e => setPassword(e.target.value)} />
      <div className="text-right"><Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-medium text-blue-700 hover:underline">Forgot password?</Link></div>
      <Button type="submit" busy={loading} className="w-full">{loading ? 'Signing in...' : 'Sign in'}</Button>
    </form>
    <div className="flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-xs text-slate-400">or continue with</span><span className="h-px flex-1 bg-slate-200" /></div>
    <Button variant="secondary" className="w-full" onClick={handleGoogleLogin} disabled={loading || !googleAvailable}><svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg><span>{googleAvailable ? 'Sign in with Google' : 'Google sign-in unavailable until configured'}</span></Button>
    <p className="text-center text-xs leading-5 text-slate-500">Your active session can be restored after a browser refresh. Sign out when using a shared device.</p>
  </AuthPanel>;
};
