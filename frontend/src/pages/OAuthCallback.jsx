import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  return <div className="p-12 text-center text-slate-600" role="status">Completing Google login...</div>;
};
