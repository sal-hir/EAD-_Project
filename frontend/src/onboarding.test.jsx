import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api, merchantApi } from './api/client';
import { ForgotPassword, ResetPassword } from './pages/PasswordRecovery';
import { MerchantApply, MerchantStatus } from './pages/MerchantOnboarding';
import { AdminMerchants } from './pages/AdminMerchants';

vi.mock('./api/client', () => ({ api: { post: vi.fn() }, merchantApi: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, authError: (e, fallback) => e.response?.data?.message || e.message || fallback }));
const business = { businessName: 'Colombo Trading', category: 'Retail', contactName: 'Kamal', businessEmail: 'business@example.lk', phone: '+94 77 123 4567', address: '1 Example Road', district: 'Colombo' };
let application;
const wrap = element => render(<MemoryRouter>{element}</MemoryRouter>);
beforeEach(() => {
  vi.resetAllMocks(); window.history.replaceState(null, '', '/');
  application = { id: 'application-test', userId: 'owner', business, status: 'PENDING', version: 0, submittedAt: '2026-10-31T10:00:00Z' };
  api.post.mockResolvedValue({});
  merchantApi.get.mockImplementation(path => Promise.resolve({ data: { data: path.endsWith('/audit') ? [] : path === '/merchants/admin/applications' ? { applications: [application], page: 0, pages: 1 } : application } }));
  merchantApi.post.mockResolvedValue({ data: { data: application } });
});
afterEach(cleanup);
it('requests password recovery and shows only the generic confirmation', async () => {
  wrap(<ForgotPassword />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.lk' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset instructions' }));
  expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('If an eligible account exists'));
  expect(api.post).toHaveBeenCalledWith('/auth/password/forgot', { email: 'person@example.lk' });
});
it('shows a recovery network failure without revealing account existence', async () => {
  api.post.mockRejectedValue(new Error('Network unavailable')); wrap(<ForgotPassword />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'person@example.lk' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset instructions' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Network unavailable');
});
it('resets once from a cleared fragment without automatically logging in', async () => {
  const token = 't'.repeat(43); window.history.replaceState(null, '', '/reset-password#token=' + token);
  wrap(<React.StrictMode><ResetPassword /></React.StrictMode>);
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Replacement@123!' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Replacement@123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
  expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Password changed. Sign in again with your new password.');
  expect(window.location.hash).toBe('');
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/auth/password/reset', { token, newPassword: 'Replacement@123!' });
});
it('handles an expired link and mismatched reset passwords', async () => {
  window.history.replaceState(null, '', '/reset-password#token=' + 't'.repeat(43));
  api.post.mockRejectedValue({ response: { data: { message: 'Reset link expired' } } }); wrap(<ResetPassword />);
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Replacement@123!' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different@123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
  expect(screen.getByRole('alert').textContent).toBe('Passwords must match'); expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Replacement@123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Reset link expired'));
});
it('submits a new merchant business without sending an identity or role', async () => {
  merchantApi.get.mockRejectedValue({ response: { status: 404 } }); wrap(<MerchantApply />);
  await screen.findByRole('button', { name: 'Submit application' });
  for (const [label, value] of [['Registered business name *', business.businessName], ['Business category *', business.category], ['Contact person *', business.contactName], ['Business email *', business.businessEmail], ['Business phone *', business.phone], ['Business address *', business.address], ['City / district *', business.district]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
  await waitFor(() => expect(merchantApi.post).toHaveBeenCalled());
  const body = merchantApi.post.mock.calls[0][1]; expect(body.businessName).toBe(business.businessName); expect(body).not.toHaveProperty('userId'); expect(body).not.toHaveProperty('role');
});
it('shows pending status without granting merchant access', async () => {
  wrap(<MerchantStatus />);
  expect(await screen.findByText('Your merchant application has been submitted and is awaiting administrator approval.')).toBeTruthy();
  expect(screen.queryByText(/Delivery order APIs/)).toBeNull();
});
it('shows rejection reason and allows controlled resubmission', async () => {
  application = { ...application, status: 'REJECTED', rejectionReason: 'Correct the address', version: 2 };
  merchantApi.post.mockResolvedValue({ data: { data: { ...application, status: 'PENDING' } } }); wrap(<MerchantStatus />);
  expect(await screen.findByText('Reason: Correct the address')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Resubmit application' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Status: PENDING'));
  expect(merchantApi.post).toHaveBeenCalledWith('/merchants/applications/me/resubmit', { version: 2 });
});
it('blocks new forms while approval is processing', async () => {
  application = { ...application, status: 'APPROVING' }; wrap(<MerchantApply />);
  await screen.findByText('View your application status'); expect(screen.queryByRole('button', { name: 'Submit application' })).toBeNull();
});
it('shows application service failure and a retry action', async () => {
  merchantApi.get.mockRejectedValue(new Error('Service unavailable')); wrap(<MerchantStatus />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Service unavailable'); expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
});
it('requires confirmation and reason for administrator rejection', async () => {
  wrap(<AdminMerchants />); fireEvent.click(await screen.findByRole('button', { name: 'View details' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reject', exact: true }));
  expect(merchantApi.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Rejection reason'), { target: { value: 'Correct the address' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }));
  await waitFor(() => expect(merchantApi.post).toHaveBeenCalledWith('/merchants/admin/applications/application-test/reject', { version: 0, reason: 'Correct the address' }));
});
it('keeps a failed approval sync visible for safe administrator retry', async () => {
  merchantApi.post.mockImplementation(async () => { application = { ...application, status: 'APPROVING', version: 1 }; return { data: { data: application } }; });
  wrap(<AdminMerchants />); fireEvent.click(await screen.findByRole('button', { name: 'View details' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Approve', exact: true })); fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));
  expect(await screen.findByRole('button', { name: 'Retry approval' })).toBeTruthy();
  expect(screen.getByText(/Approval is waiting for account permissions/)).toBeTruthy();
});
