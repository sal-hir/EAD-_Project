import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setAccessToken, sessionRequest, refreshSession, setSessionRefresher } from '../api/client';

const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const pendingRestore = useRef(null);
  const channel = useRef(null);
  const reset = useCallback(() => {
    generation.current += 1;
    pendingRestore.current = null;
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setExpiresAt(null);
    setLoading(false);
  }, []);
  const verify = useCallback(async (result, operation) => {
    if (operation !== generation.current) return null;
    setAccessToken(result.token);
    const profile = await api.get('/auth/me', { skipSessionRefresh: true });
    if (operation !== generation.current) return null;
    setToken(result.token);
    setUser(profile.data.data);
    setExpiresAt(result.expiresAt ? Date.parse(result.expiresAt) : Date.now() + result.expiresIn * 1000);
    return profile.data.data;
  }, []);
  const restore = useCallback(() => {
    if (pendingRestore.current) return pendingRestore.current;
    const operation = generation.current;
    const promise = (async () => {
      try {
        return await verify(await refreshSession(), operation);
      } catch {
        if (operation === generation.current) reset();
        return null;
      } finally {
        if (operation === generation.current) setLoading(false);
      }
    })();
    pendingRestore.current = promise;
    promise.finally(() => { if (pendingRestore.current === promise) pendingRestore.current = null; });
    return promise;
  }, [reset, verify]);
  useEffect(() => {
    localStorage.removeItem('swiftdrop_token');
    localStorage.removeItem('swiftdrop_user');
    const removeRefresher = setSessionRefresher(restore);
    window.addEventListener('swiftdrop:unauthorized', reset);
    if (typeof window.BroadcastChannel === 'function') {
      channel.current = new BroadcastChannel('swiftdrop-auth');
      channel.current.onmessage = event => {
        if (event.data?.type === 'logout') reset();
        if (event.data?.type === 'login') { reset(); restore(); }
      };
    }
    if (window.location.pathname !== '/auth/callback') restore();
    return () => {
      removeRefresher();
      window.removeEventListener('swiftdrop:unauthorized', reset);
      channel.current?.close();
      channel.current = null;
    };
  }, [reset, restore]);
  useEffect(() => {
    if (!expiresAt) return;
    const timeout = window.setTimeout(() => { restore(); }, Math.max(0, expiresAt - Date.now() - 5000));
    return () => window.clearTimeout(timeout);
  }, [expiresAt, restore]);
  const authenticate = useCallback(async (endpoint, payload) => {
    const operation = ++generation.current;
    setLoading(true);
    setUser(null); setToken(null); setExpiresAt(null); setAccessToken(null);
    try {
      const result = await sessionRequest(endpoint, payload);
      const profile = await verify(result.data.data, operation);
      if (!profile) throw new Error('Login cancelled');
      channel.current?.postMessage({ type: 'login' });
      return profile;
    } catch (error) {
      if (operation === generation.current) reset();
      throw error;
    } finally {
      if (operation === generation.current) setLoading(false);
    }
  }, [reset, verify]);
  const login = useCallback((email, password) => authenticate('/auth/login', { email, password }), [authenticate]);
  const handleOAuthCallback = useCallback((code, verifier) => authenticate('/auth/oauth/exchange', { code, verifier }), [authenticate]);
  const register = useCallback(async (form) => (await api.post('/auth/register', form)).data, []);
  const logout = useCallback(async () => {
    // Keep the user signed in if revocation could not be confirmed.
    await sessionRequest('/auth/logout');
    reset();
    channel.current?.postMessage({ type: 'logout' });
  }, [reset]);
  const value = {
    user, token, loading, login, register, logout, handleOAuthCallback,
    isAuthenticated: !!user,
    isCustomer: user?.role === 'CUSTOMER', isMerchant: user?.role === 'MERCHANT',
    isCourier: user?.role === 'COURIER', isDispatcher: user?.role === 'DISPATCHER', isAdmin: user?.role === 'ADMIN',
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
