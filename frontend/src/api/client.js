import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
let accessToken = null;
let sessionRefresher = null;
let refreshPromise = null;
let sessionQueue = Promise.resolve();
let errorNotifier = null;
/**
 * Register a callback that receives user-facing error messages from the global
 * Axios error interceptor. Called by ErrorProvider on mount; returns a cleanup
 * function that unregisters the notifier.
 */
export const setErrorNotifier = (callback) => {
  errorNotifier = callback;
  return () => { if (errorNotifier === callback) errorNotifier = null; };
};
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
export const MERCHANT_API_BASE_URL = (import.meta.env.VITE_MERCHANT_API_URL || 'http://localhost:4001').replace(/\/$/, '');
export const merchantApi = axios.create({ baseURL: `${MERCHANT_API_BASE_URL}/api/v1`, headers: { 'Content-Type': 'application/json' } });
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
const installAuthentication = instance => {
instance.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  else delete config.headers.Authorization;
  return config;
});
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (error.response?.status === 401 && config?.headers?.Authorization) {
      if (sessionRefresher && !config.skipSessionRefresh && !config._sessionRetried) {
        config._sessionRetried = true;
        try {
          if (await sessionRefresher()) return instance(config);
        } catch { /* Clear local identity below if restoration fails. */ }
      }
      if (config.headers.Authorization === `Bearer ${accessToken}`) {
        accessToken = null;
        window.dispatchEvent(new Event('swiftdrop:unauthorized'));
      }
    }
    // Global error notification for non-401 errors (skip if request opted out)
    if (error.response?.status !== 401 && !config?.silent && errorNotifier) {
      const body = error.response?.data;
      const message = body?.message || (error.code === 'ERR_NETWORK' ? 'Network error — please check your connection' : 'An unexpected error occurred');
      errorNotifier(message);
    }
    return Promise.reject(error);
  }
);
};
installAuthentication(api);
installAuthentication(merchantApi);
export const authError = (error, fallback) => {
  const body = error.response?.data;
  const fields = Object.entries(body?.errors || {}).map(([field, message]) => `${field}: ${message}`);
  return fields.length ? fields.join('. ') : body?.message || error.message || fallback;
};
export const dashboardPath = (role) =>
  ({ ADMIN: '/admin', DISPATCHER: '/admin', COURIER: '/courier', MERCHANT: '/merchant' }[role] || '/customer');
