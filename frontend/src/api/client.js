import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
let accessToken = null;
let sessionRefresher = null;
let refreshPromise = null;
let sessionQueue = Promise.resolve();
export const setAccessToken = (token) => { accessToken = token; };
export const setSessionRefresher = (callback) => {
  sessionRefresher = callback;
  return () => { if (sessionRefresher === callback) sessionRefresher = null; };
};
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});
const sessionApi = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'X-SwiftDrop-CSRF': '1' },
});
// Serialize cookie mutations, including across tabs when Web Locks is available.
export const sessionRequest = (endpoint, payload = {}) => {
  const request = () => sessionApi.post(endpoint, payload);
  const run = () => globalThis.navigator?.locks
    ? navigator.locks.request('swiftdrop-session', request) : request();
  const pending = sessionQueue.then(run, run);
  sessionQueue = pending.catch(() => {});
  return pending;
};
export const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = sessionRequest('/auth/refresh').then(response => response.data.data)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  else delete config.headers.Authorization;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401 && config?.headers?.Authorization) {
      if (sessionRefresher && !config.skipSessionRefresh && !config._sessionRetried) {
        config._sessionRetried = true;
        try {
          if (await sessionRefresher()) return api(config);
        } catch { /* Clear local identity below if restoration fails. */ }
      }
      if (config.headers.Authorization === `Bearer ${accessToken}`) {
        accessToken = null;
        window.dispatchEvent(new Event('swiftdrop:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);
export const authError = (error, fallback) => {
  const body = error.response?.data;
  const fields = Object.entries(body?.errors || {}).map(([field, message]) => `${field}: ${message}`);
  return fields.length ? fields.join('. ') : body?.message || error.message || fallback;
};
export const dashboardPath = (role) =>
  ({ ADMIN: '/admin', DISPATCHER: '/admin', COURIER: '/courier', MERCHANT: '/merchant' }[role] || '/customer');
