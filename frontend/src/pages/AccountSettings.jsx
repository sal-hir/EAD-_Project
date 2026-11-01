import React, { useEffect, useState } from 'react';
import { api, authError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardPath } from '../api/client';
import { PageHeader, Button, ErrorState, LoadingSkeleton } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';

export const AccountSettings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/auth/account').then(r => setAccount(r.data.data)).catch(e => setError(authError(e, 'Could not load account'))); }, []);
  return <section className="max-w-4xl mx-auto space-y-6">
    <PageHeader title="Account settings" description="Your verified profile and sign-in security. Profile details are currently read-only." />
    {error && <ErrorState message={error} />}
    <div className="ui-card p-5 sm:p-7"><h2 className="mb-5 text-lg font-bold">Profile</h2><dl className="grid gap-5 sm:grid-cols-2">{[['Name', user.name], ['Email', user.email], ['Assigned role', user.role]].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-2 break-words font-medium">{value}</dd></div>)}<div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account status</dt><dd className="mt-2">{typeof user.active === 'boolean' ? <StatusBadge status={user.active ? 'ACTIVE' : 'INACTIVE'} /> : 'Signed in'}</dd></div></dl></div>
    <div className="ui-card space-y-5 p-5 sm:p-7"><h2 className="text-lg font-bold">Security</h2>
      {!account && !error && <LoadingSkeleton label="Loading account..." rows={2} />}
      {account?.googleLinked && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Google account connected.</p>}
      {account && !account.googleLinked && <p className="text-sm text-slate-600">No Google account is connected.</p>}
      {account?.passwordEnabled && <Link to="/forgot-password" className="ui-button ui-button-secondary">Request password recovery</Link>}
      {account && !account.passwordEnabled && <p className="text-sm leading-6 text-slate-600">Use your connected Google account to sign in. Password recovery does not create a password for Google-only identities.</p>}
      {account && !account.googleLinked && <p className="text-sm leading-6 text-slate-600">Sign in with Google using the same verified email to connect automatically, after completing any required account activation. Your existing identity and role are preserved.</p>}
      {account && !account.googleAvailable && <p className="text-sm text-slate-500">Google sign-in is unavailable until configured.</p>}
      <p className="text-xs leading-6 text-slate-500">Keep recovery links private and sign out on shared devices. Password reset and sensitive administrator changes revoke existing sessions.</p>
    </div>
    <div className="ui-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><Link className="ui-button ui-button-secondary" to={dashboardPath(user.role)}>Return to dashboard</Link><Button variant="danger" busy={ending} onClick={async () => { if (ending) return; setEnding(true); setError(''); try { await logout(); navigate('/login'); } catch { setError('Could not end your session. Please try logging out again.'); } finally { setEnding(false); } }}>Log out of account</Button></div>
  </section>;
};
