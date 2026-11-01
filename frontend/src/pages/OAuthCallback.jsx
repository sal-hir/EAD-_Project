import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthPanel } from '../components/PublicWebsite';
import { LoadingSkeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../api/client';

export const OAuthCallback = () => {
  const navigate = useNavigate();
  const { handleOAuthCallback } = useAuth();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get('code');
    const verifier = sessionStorage.getItem('swiftdrop_oauth_verifier');
    sessionStorage.removeItem('swiftdrop_oauth_verifier');
    window.history.replaceState(null, '', window.location.pathname);
    if (!code || !verifier) {
      navigate('/login?error=google_auth_failed', { replace: true });
      return;
    }
    handleOAuthCallback(code, verifier)
      .then((user) => navigate(dashboardPath(user.role), { replace: true }))
      .catch(() => navigate('/login?error=google_auth_failed', { replace: true }));
  }, [handleOAuthCallback, navigate]);
  return <AuthPanel title="Completing Google login" description="We are verifying your sign-in and preparing your session."><LoadingSkeleton label="Completing Google login..." rows={2} /><p className="text-sm leading-6 text-slate-600">You will be redirected to your portal after verification. If sign-in cannot complete, the login page will explain how to try again.</p><Link className="ui-button ui-button-secondary" to="/login">Return to login</Link></AuthPanel>;
};
