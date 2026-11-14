import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { merchantApi } from './api/client';
import { MerchantCredentials, AdminMerchantCredentials } from './pages/MerchantCredentials';

let user;
vi.mock('./context/AuthContext', () => ({ useAuth: () => ({ user }) }));
vi.mock('./api/client', () => ({ merchantApi: { get: vi.fn(), post: vi.fn() }, authError: (e, fallback) => e.response?.data?.message || e.message || fallback }));
const key = { id: 'key-1', merchantId: 'merchant-1', label: 'Store integration', prefix: 'sd_mk_abcdefgh', status: 'ACTIVE', createdAt: '2026-11-14T06:00:00Z', revokedAt: null };
const raw = 'sd_mk_test-secret-shown-only-once';
const own = () => <MemoryRouter><MerchantCredentials /></MemoryRouter>;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); user = { id: 'owner', role: 'MERCHANT' };
  merchantApi.get.mockResolvedValue({ data: { data: { merchantId: 'merchant-1', approved: true, keys: [] } } });
  merchantApi.post.mockResolvedValue({ data: { data: { credential: key, apiKey: raw } } });
});
afterEach(cleanup);
async function generate() {
  await screen.findByLabelText('Key label');
  fireEvent.change(screen.getByLabelText('Key label'), { target: { value: 'Store integration' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate API key' }));
  await screen.findByLabelText('New API key (shown once)');
}
it('generates a key, displays it once, copies explicitly and never persists its full value', async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  render(own()); await generate();
  expect(merchantApi.post).toHaveBeenCalledWith('/merchants/api-keys', { label: 'Store integration' });
  expect(screen.getByLabelText('New API key (shown once)').value).toBe(raw);
  expect(copy).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Copy API key' }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith(raw));
  expect(JSON.stringify(localStorage)).not.toContain(raw);
  expect(JSON.stringify(sessionStorage)).not.toContain(raw);
  fireEvent.click(screen.getByRole('button', { name: 'I have saved the key' }));
  expect(screen.queryByLabelText('New API key (shown once)')).toBeNull();
  expect(screen.getByText(`${key.prefix}…`)).toBeTruthy();
});
it('does not offer generation to a merchant without business approval', async () => {
  merchantApi.get.mockResolvedValue({ data: { data: { merchantId: 'merchant-1', approved: false, keys: [] } } });
  render(own()); await screen.findByText(/Business approval is required/);
  expect(screen.queryByRole('button', { name: 'Generate API key' })).toBeNull();
  expect(merchantApi.post).not.toHaveBeenCalled();
});
it('requires revoke confirmation and clears a newly revealed key after revocation', async () => {
  render(own()); await generate();
  merchantApi.post.mockResolvedValue({ data: { data: { ...key, status: 'REVOKED', revokedAt: '2026-11-14T07:00:00Z' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Revoke', exact: true }));
  expect(merchantApi.post).toHaveBeenCalledTimes(1);
  await screen.findByRole('dialog', { name: 'Revoke API key?' });
  fireEvent.click(screen.getByRole('button', { name: 'Revoke key', exact: true }));
  await screen.findByText(/API key revoked. Future requests/);
  expect(merchantApi.post).toHaveBeenLastCalledWith('/merchants/api-keys/key-1/revoke');
  expect(screen.queryByLabelText('New API key (shown once)')).toBeNull();
});
it('shows server generation errors without inventing a key', async () => {
  merchantApi.post.mockRejectedValue(new Error('Merchant business approval required'));
  render(own()); await screen.findByLabelText('Key label');
  fireEvent.change(screen.getByLabelText('Key label'), { target: { value: 'Store' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate API key' }));
  await screen.findByRole('alert');
  expect(screen.queryByLabelText('New API key (shown once)')).toBeNull();
});
it('keeps a failed revocation visible and retains the active key for retry', async () => {
  merchantApi.get.mockResolvedValue({ data: { data: { merchantId: 'merchant-1', approved: true, keys: [key] } } });
  merchantApi.post.mockRejectedValue(new Error('Service unavailable'));
  render(own()); await screen.findByRole('button', { name: 'Revoke', exact: true });
  fireEvent.click(screen.getByRole('button', { name: 'Revoke', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Revoke key', exact: true }));
  await screen.findByRole('alert');
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.queryByText(/API key revoked. Future requests/)).toBeNull();
});
it('removes the previous full key when the signed-in identity changes', async () => {
  const view = render(own()); await generate(); user = { id: 'other', role: 'MERCHANT' };
  view.rerender(own());
  expect(screen.queryByLabelText('New API key (shown once)')).toBeNull();
  await screen.findByLabelText('Key label');
});
it('lets an administrator inspect and revoke via the selected merchant endpoint without a generation form', async () => {
  user = { id: 'admin', role: 'ADMIN' };
  merchantApi.get.mockResolvedValue({ data: { data: { merchantId: 'merchant-1', approved: true, keys: [key] } } });
  merchantApi.post.mockResolvedValue({ data: { data: { ...key, status: 'REVOKED', revokedAt: '2026-11-14T07:00:00Z' } } });
  render(<MemoryRouter initialEntries={['/admin/merchants/merchant-1/credentials']}><Routes>
    <Route path="/admin/merchants/:merchantId/credentials" element={<AdminMerchantCredentials />} />
  </Routes></MemoryRouter>);
  await screen.findByRole('button', { name: 'Revoke', exact: true });
  expect(merchantApi.get).toHaveBeenCalledWith('/merchants/admin/applications/merchant-1/api-keys');
  expect(screen.queryByRole('button', { name: 'Generate API key' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Revoke', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Revoke key', exact: true }));
  await screen.findByText(/API key revoked. Future requests/);
  expect(merchantApi.post).toHaveBeenCalledWith('/merchants/admin/applications/merchant-1/api-keys/key-1/revoke');
});
