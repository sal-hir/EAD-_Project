import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let client, sessionApi, axios;
const response = (config, data = {}) => ({ config, status: 200, statusText: 'OK', headers: {}, data });
beforeEach(async () => {
  vi.resetModules();
  axios = (await import('axios')).default;
  const create = axios.create.bind(axios);
  const instances = [];
  vi.spyOn(axios, 'create').mockImplementation(config => {
    const instance = create(config); instances.push(instance); return instance;
  });
  client = await import('./client');
  sessionApi = instances[1];
});
afterEach(() => vi.restoreAllMocks());

it('uses credentials and the CSRF header only on the dedicated session client', async () => {
  sessionApi.defaults.adapter = async config => {
    expect(config.withCredentials).toBe(true);
    expect(config.headers['X-SwiftDrop-CSRF']).toBe('1');
    expect(config.headers.Authorization).toBeUndefined();
    return response(config);
  };
  client.setAccessToken('in-memory-access');
  await client.sessionRequest('/auth/logout');
  client.api.defaults.adapter = async config => {
    expect(config.withCredentials).not.toBe(true);
    expect(config.headers.Authorization).toBe('Bearer in-memory-access');
    return response(config);
  };
  await client.api.get('/auth/me');
});
it('coalesces simultaneous refreshes into one cookie rotation', async () => {
  const adapter = vi.fn(async config => response(config, { data: { token: 'new-access' } }));
  sessionApi.defaults.adapter = adapter;
  const a = client.refreshSession(), b = client.refreshSession();
  expect(a).toBe(b);
  expect(await a).toEqual({ token: 'new-access' });
  await b;
  expect(adapter).toHaveBeenCalledTimes(1);
});
it('serializes login, refresh and logout cookie mutations', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const order = [];
  sessionApi.defaults.adapter = async config => {
    order.push(config.url);
    if (config.url === '/auth/login') await gate;
    return response(config);
  };
  const login = client.sessionRequest('/auth/login');
  const logout = client.sessionRequest('/auth/logout');
  await vi.waitFor(() => expect(order).toEqual(['/auth/login']));
  release(); await Promise.all([login, logout]);
  expect(order).toEqual(['/auth/login', '/auth/logout']);
});
it('refreshes a rejected access token and retries the API request once', async () => {
  client.setAccessToken('old-access');
  const headers = [];
  client.api.defaults.adapter = async config => {
    headers.push(config.headers.Authorization);
    if (!config._sessionRetried) throw new axios.AxiosError('Expired', 'ERR_BAD_REQUEST', config, null, { status: 401 });
    return response(config);
  };
  const restore = vi.fn(async () => { client.setAccessToken('new-access'); return { id: 'customer' }; });
  client.setSessionRefresher(restore);
  await client.api.get('/auth/me');
  expect(restore).toHaveBeenCalledTimes(1);
  expect(headers).toEqual(['Bearer old-access', 'Bearer new-access']);
});
it('does not loop on a rejected retry and clears authentication', async () => {
  client.setAccessToken('bad-access');
  const unauthorized = vi.fn();
  window.addEventListener('swiftdrop:unauthorized', unauthorized);
  const restore = vi.fn(async () => ({ id: 'customer' }));
  client.setSessionRefresher(restore);
  client.api.defaults.adapter = async config => {
    throw new axios.AxiosError('Rejected', 'ERR_BAD_REQUEST', config, null, { status: 401 });
  };
  await expect(client.api.get('/auth/me')).rejects.toThrow('Rejected');
  expect(restore).toHaveBeenCalledTimes(1);
  expect(unauthorized).toHaveBeenCalledTimes(1);
  window.removeEventListener('swiftdrop:unauthorized', unauthorized);
});
