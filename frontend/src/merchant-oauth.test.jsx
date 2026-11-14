import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { merchantApi } from './api/client';
import { MerchantOAuthClients, AdminMerchantOAuthClients } from './pages/MerchantOAuthClients';

let user;
vi.mock('./context/AuthContext', () => ({ useAuth: () => ({ user }) }));
vi.mock('./api/client', () => ({ merchantApi: { get: vi.fn(), post: vi.fn() }, authError: (error, fallback) => error.message || fallback }));
const client = { id: 'client-1', merchantId: 'business-1', clientId: 'sd_client_public-identifier', label: 'Store backend', scopes: ['merchant:read', 'orders:write'], status: 'ACTIVE', createdAt: '2026-11-14T08:00:00Z', rotatedAt: null, revokedAt: null };
const raw = 'sd_cs_once-only-client-secret';
const view = () => <MemoryRouter><MerchantOAuthClients /></MemoryRouter>;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); user = { id: 'owner', role: 'MERCHANT' };
  merchantApi.get.mockResolvedValue({ data: { data: { merchantId: 'business-1', approved: true, clients: [] } } });
  merchantApi.post.mockResolvedValue({ data: { data: { credential: client, clientSecret: raw } } });
});
afterEach(cleanup);
async function create() {
  await screen.findByLabelText('Client label');
  fireEvent.change(screen.getByLabelText('Client label'), { target: { value: 'Store backend' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create OAuth client' }));
  await screen.findByLabelText('Client secret (shown once)');
}
it('creates a scoped client and reveals its secret only once without browser persistence', async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  render(view()); await create();
  expect(merchantApi.post).toHaveBeenCalledWith('/merchants/oauth-clients', { label: 'Store backend', scopes: ['merchant:read', 'orders:write'] });
  expect(screen.getByLabelText('Client secret (shown once)').value).toBe(raw);
  expect(copy).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Copy client secret' }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith(raw));
  expect(JSON.stringify(localStorage)).not.toContain(raw); expect(JSON.stringify(sessionStorage)).not.toContain(raw);
  fireEvent.click(screen.getByRole('button', { name: 'I have saved the client secret' }));
  expect(screen.queryByLabelText('Client secret (shown once)')).toBeNull();
  expect(screen.getByText(client.clientId)).toBeTruthy();
});
it('allows a reduced scope and prevents an empty permission selection', async () => {
  render(view()); await screen.findByLabelText('Client label');
  fireEvent.change(screen.getByLabelText('Client label'), { target: { value: 'Read only' } });
  fireEvent.click(screen.getByLabelText('Submit merchant orders (orders:write)'));
  fireEvent.click(screen.getByLabelText('Read merchant identity (merchant:read)'));
  expect(screen.getByRole('button', { name: 'Create OAuth client' }).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('Read merchant identity (merchant:read)'));
  fireEvent.click(screen.getByRole('button', { name: 'Create OAuth client' }));
  await screen.findByLabelText('Client secret (shown once)');
  expect(merchantApi.post).toHaveBeenCalledWith('/merchants/oauth-clients', { label: 'Read only', scopes: ['merchant:read'] });
});
it('requires confirmation before rotating and shows the replacement secret once', async () => {
  merchantApi.get.mockResolvedValue({ data: { data: { merchantId: 'business-1', approved: true, clients: [client] } } });
  merchantApi.post.mockResolvedValue({ data: { data: { credential: { ...client, rotatedAt: '2026-11-14T09:00:00Z' }, clientSecret: 'replacement-secret' } } });
  render(view()); fireEvent.click(await screen.findByRole('button', { name: 'Rotate secret' }));
  expect(merchantApi.post).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm rotation' }));
  await screen.findByLabelText('Client secret (shown once)');
  expect(merchantApi.post).toHaveBeenCalledWith('/merchants/oauth-clients/client-1/rotate');
  expect(screen.getByLabelText('Client secret (shown once)').value).toBe('replacement-secret');
});
it('revokes a client and clears its revealed secret after confirmation', async () => {
  render(view()); await create();
  merchantApi.post.mockResolvedValue({ data: { data: { ...client, status: 'REVOKED', revokedAt: '2026-11-14T09:00:00Z' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Revoke client', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm client revocation' }));
  await screen.findByText('OAuth client revoked. Its secret and access tokens can no longer be used.');
  expect(screen.queryByLabelText('Client secret (shown once)')).toBeNull();
});
it('does not offer creation or rotation without business approval', async () => {
  merchantApi.get.mockResolvedValue({ data: { data: { merchantId: 'business-1', approved: false, clients: [client] } } });
  render(view()); await screen.findByText(/Business approval is required/);
  expect(screen.queryByRole('button', { name: 'Create OAuth client' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Rotate secret' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Revoke client' })).toBeTruthy();
});
it('shows creation errors without displaying a fictional secret', async () => {
  merchantApi.post.mockRejectedValue(new Error('Merchant business approval required'));
  render(view()); await screen.findByLabelText('Client label');
  fireEvent.change(screen.getByLabelText('Client label'), { target: { value: 'Store' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create OAuth client' }));
  await screen.findByRole('alert'); expect(screen.queryByLabelText('Client secret (shown once)')).toBeNull();
});
it('clears a previous merchant secret when identity changes', async () => {
  const rendered = render(view()); await create(); user = { id: 'other', role: 'MERCHANT' }; rendered.rerender(view());
  expect(screen.queryByLabelText('Client secret (shown once)')).toBeNull(); await screen.findByLabelText('Client label');
});
it('restricts administrator UI to metadata and client revocation', async () => {
  user = { id: 'admin', role: 'ADMIN' };
  merchantApi.get.mockResolvedValue({ data: { data: { merchantId: 'business-1', approved: true, clients: [client] } } });
  merchantApi.post.mockResolvedValue({ data: { data: { ...client, status: 'REVOKED' } } });
  render(<MemoryRouter initialEntries={['/admin/merchants/business-1/oauth-clients']}><Routes>
    <Route path="/admin/merchants/:merchantId/oauth-clients" element={<AdminMerchantOAuthClients />} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Revoke client' }));
  expect(screen.queryByRole('button', { name: 'Rotate secret' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Create OAuth client' })).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm client revocation' }));
  await screen.findByText('OAuth client revoked. Its secret and access tokens can no longer be used.');
  expect(merchantApi.post).toHaveBeenCalledWith('/merchants/admin/applications/business-1/oauth-clients/client-1/revoke');
});
