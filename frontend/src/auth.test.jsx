import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api, setAccessToken, sessionRequest, refreshSession } from './api/client';
import App from './App';

vi.mock('./api/client', async (original) => ({
  ...await original(),
  api: { get: vi.fn(), post: vi.fn() },
  setAccessToken: vi.fn(),
  sessionRequest: vi.fn(), refreshSession: vi.fn(), setSessionRefresher: vi.fn(() => () => {}),
}));
const customer = { id: 'test-user', name: 'Kamal', email: 'kamal@example.lk', role: 'CUSTOMER' };
const result = { data: { data: { token: 'signed-token', expiresIn: 900, user: { role: 'ADMIN' } } } };
function Probe() {
  const auth = useAuth();
  return <>
    <span data-testid="identity">{auth.user?.role || 'anonymous'}</span>
    <button onClick={() => auth.login('kamal@example.lk', 'password').catch(() => {})}>Login probe</button>
    <button onClick={auth.logout}>Logout probe</button>
  </>;
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  api.get.mockImplementation((path) => Promise.resolve({ data: { data: path === '/auth/providers' ? { google: false } : customer } }));
  api.post.mockResolvedValue(result);
  sessionRequest.mockResolvedValue(result);
  refreshSession.mockRejectedValue(new Error('No session'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('authentication and routing', () => {
  it('ignores stored identities and tokens', () => {
    localStorage.setItem('swiftdrop_user', JSON.stringify({ role: 'ADMIN' }));
    localStorage.setItem('swiftdrop_token', 'forged');
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('identity').textContent).toBe('anonymous');
    expect(localStorage.getItem('swiftdrop_token')).toBeNull();
  });
  it('verifies me and uses its role instead of the login response role', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    fireEvent.click(screen.getByText('Login probe'));
    await waitFor(() => expect(screen.getByTestId('identity').textContent).toBe('CUSTOMER'));
    expect(api.get).toHaveBeenCalledWith('/auth/me', { skipSessionRefresh: true });
    expect(setAccessToken).toHaveBeenCalledWith('signed-token');
    expect(localStorage.getItem('swiftdrop_token')).toBeNull();
  });
  it('restores identity from the HttpOnly cookie on page load', async () => {
    refreshSession.mockResolvedValue(result.data.data);
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('identity').textContent).toBe('CUSTOMER'));
    expect(localStorage.length).toBe(0);
  });
  it('rejects the identity when me verification fails', async () => {
    api.get.mockRejectedValue(new Error('Expired token'));
    render(<AuthProvider><Probe /></AuthProvider>);
    fireEvent.click(screen.getByText('Login probe'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/me', { skipSessionRefresh: true }));
    await waitFor(() => expect(setAccessToken).toHaveBeenLastCalledWith(null));
    expect(screen.getByTestId('identity').textContent).toBe('anonymous');
  });
  it('clears authenticated state when the API reports an expired token', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    fireEvent.click(screen.getByText('Login probe'));
    await waitFor(() => expect(screen.getByTestId('identity').textContent).toBe('CUSTOMER'));
    act(() => window.dispatchEvent(new Event('swiftdrop:unauthorized')));
    expect(screen.getByTestId('identity').textContent).toBe('anonymous');
    expect(setAccessToken).toHaveBeenLastCalledWith(null);
  });
  it('clears identity when the scheduled refresh fails', async () => {
    vi.useFakeTimers();
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => fireEvent.click(screen.getByText('Login probe')));
    expect(screen.getByTestId('identity').textContent).toBe('CUSTOMER');
    await act(async () => vi.advanceTimersByTime(895_000));
    expect(refreshSession).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('identity').textContent).toBe('anonymous');
  });
  it('keeps identity when the scheduled refresh succeeds', async () => {
    vi.useFakeTimers();
    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => fireEvent.click(screen.getByText('Login probe')));
    refreshSession.mockResolvedValue({ ...result.data.data, token: 'rotated-access' });
    await act(async () => vi.advanceTimersByTime(895_000));
    expect(screen.getByTestId('identity').textContent).toBe('CUSTOMER');
    expect(setAccessToken).toHaveBeenLastCalledWith('rotated-access');
  });
  it('keeps identity and shows an error if server logout cannot be confirmed', async () => {
    window.history.replaceState(null, '', '/login');
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: customer.email } });
    fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'Customer@123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Customer dashboard' });
    sessionRequest.mockRejectedValueOnce(new Error('Offline'));
    fireEvent.click(screen.getByTitle('Logout'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(window.location.pathname).toBe('/customer');
  });
  it('redirects unauthenticated protected routes to login', async () => {
    window.history.replaceState(null, '', '/admin');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
  });
  it('logs in, redirects by verified role and logs out', async () => {
    window.history.replaceState(null, '', '/login');
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: customer.email } });
    fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'Customer@123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Customer dashboard' })).toBeTruthy();
    expect(window.location.pathname).toBe('/customer');
    expect(screen.getByRole('status').textContent).toContain('Coming soon');
    act(() => {
      window.history.pushState(null, '', '/admin');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    fireEvent.click(screen.getByTitle('Logout'));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(setAccessToken).toHaveBeenLastCalledWith(null);
  });
  it('shows backend validation errors on registration', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'Invalid request', errors: { password: 'must be at least 8 characters' } } } });
    window.history.replaceState(null, '', '/register');
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Kamal Perera'), { target: { value: 'Kamal' } });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), { target: { value: customer.email } });
    fireEvent.change(document.querySelector('input[type="password"]'), { target: { value: 'Customer@123!' } });
    fireEvent.submit(document.querySelector('form'));
    expect(await screen.findByText('password: must be at least 8 characters')).toBeTruthy();
  });
  it('exchanges an OAuth code once in StrictMode and removes it from the address bar', async () => {
    sessionStorage.setItem('swiftdrop_oauth_verifier', 'browser-verifier');
    window.history.replaceState(null, '', '/auth/callback#code=one-time-code');
    render(<React.StrictMode><App /></React.StrictMode>);
    expect(await screen.findByRole('heading', { name: 'Customer dashboard' })).toBeTruthy();
    expect(sessionRequest).toHaveBeenCalledTimes(1);
    expect(sessionRequest).toHaveBeenCalledWith('/auth/oauth/exchange', { code: 'one-time-code', verifier: 'browser-verifier' });
    expect(sessionStorage.getItem('swiftdrop_oauth_verifier')).toBeNull();
    expect(window.location.hash).toBe('');
  });
});
