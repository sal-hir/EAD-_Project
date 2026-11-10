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
export const MERCHANT_API_BASE_URL = (import.meta.env.VITE_MERCHANT_API_URL || 'http://localhost:4001').replace(/\/$/, '');
export const merchantApi = axios.create({ baseURL: `${MERCHANT_API_BASE_URL}/api/v1`, headers: { 'Content-Type': 'application/json' } });
export const COURIER_API_BASE_URL = (import.meta.env.VITE_COURIER_API_URL || 'http://localhost:4003').replace(/\/$/, '');
export const courierApi = axios.create({ baseURL: `${COURIER_API_BASE_URL}/api/v1`, headers: { 'Content-Type': 'application/json' } });
export const TRACKING_API_BASE_URL = (import.meta.env.VITE_TRACKING_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
export const trackingApi = axios.create({ baseURL: `${TRACKING_API_BASE_URL}/api/v1`, headers: { 'Content-Type': 'application/json' } });
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
    return Promise.reject(error);
  }
);
};
installAuthentication(api);
installAuthentication(merchantApi);
installAuthentication(courierApi);
export const authError = (error, fallback) => {
  const body = error.response?.data;
  const fields = Object.entries(body?.errors || {}).map(([field, message]) => `${field}: ${message}`);
  return fields.length ? fields.join('. ') : body?.message || error.message || fallback;
};
export const dashboardPath = (role) =>
  ({ ADMIN: '/admin', DISPATCHER: '/admin', COURIER: '/courier', MERCHANT: '/merchant' }[role] || '/customer');
