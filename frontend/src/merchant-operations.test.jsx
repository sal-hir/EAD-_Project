import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MerchantOperations } from './pages/merchant/MerchantOperations';
import { merchantApi } from './api/client';
vi.mock('./api/client', () => ({ merchantApi: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, authError: (e, fallback) => e.message || fallback }));
const base = '/merchants/operations';
const order = { id: 'order-1', merchantOrderId: 'SHOP-123', status: 'PENDING_BOOKING', createdAt: '2026-11-14T10:00:00Z', trackingNumber: null,
  request: { pickup: { name: 'Shop', phone: '+94771234567', address: 'Main Road', district: 'Colombo' }, recipient: { name: 'Kamal', phone: '+94771234568', address: 'Lake Road', district: 'Galle' }, parcel: { description: 'Books', weightKg: 1.5 }, serviceType: 'STANDARD' } };
const settings = { url: 'https://shop.example/hook', enabled: true, configured: true };
const log = { id: 'delivery-123', eventType: 'webhook.test', state: 'RETRY', attempts: 1, nextAttemptAt: '2026-11-14T10:01:00Z' };
beforeEach(() => {
  vi.resetAllMocks();
  merchantApi.get.mockImplementation(async path => ({ data: { data: path === `${base}/orders` ? { orders: [order], total: 1 }
    : path === `${base}/orders/order-1` ? order : path === `${base}/webhook` ? settings
    : path.endsWith('/delivery-123') ? { delivery: log, attempts: [{ attemptNumber: 1, responseStatus: 500, outcome: 'HTTP_500', createdAt: '2026-11-14T10:00:00Z' }] }
    : { deliveries: [log], total: 1 } } }));
  merchantApi.put.mockResolvedValue({ data: { data: { settings, signingSecret: 'whsec_once' } } });
  merchantApi.post.mockResolvedValue({ data: { data: { deliveryId: 'delivery-123' } } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('renders orders, filters on the server and opens details', async () => {
  render(<MerchantOperations />); expect(screen.getByText(/Loading orders/)).toBeTruthy();
  await screen.findByText('SHOP-123');
  fireEvent.change(screen.getByLabelText('Order status'), { target: { value: 'PENDING_BOOKING' } });
  await waitFor(() => expect(merchantApi.get).toHaveBeenCalledWith(`${base}/orders`, { params: { page: 0, size: 20, status: 'PENDING_BOOKING' } }));
  fireEvent.click(await screen.findByRole('button', { name: 'View SHOP-123' }));
  expect(await screen.findByRole('dialog', { name: 'Order details' })).toBeTruthy();
  expect(screen.getByText(/Kamal/)).toBeTruthy();
});
it('shows a load failure and recovers on retry', async () => {
  merchantApi.get.mockRejectedValueOnce(new Error('Network unavailable')); render(<MerchantOperations />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Network unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading' })); expect(await screen.findByText('SHOP-123')).toBeTruthy();
});
it('saves settings, enables/disables delivery and dismisses the one-time secret', async () => {
  render(<MerchantOperations />); await screen.findByText('SHOP-123');
  fireEvent.change(screen.getByLabelText('Webhook URL'), { target: { value: 'https://new.example/hook' } });
  fireEvent.click(screen.getByLabelText('Enable webhook delivery'));
  fireEvent.click(screen.getByRole('button', { name: 'Save webhook settings' }));
  expect(await screen.findByText('whsec_once')).toBeTruthy();
  expect(merchantApi.put).toHaveBeenCalledWith(`${base}/webhook`, { url: 'https://new.example/hook', enabled: false });
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss signing secret' })); expect(screen.queryByText('whsec_once')).toBeNull();
});
it('queues a test and shows failed attempt information', async () => {
  render(<MerchantOperations />); await screen.findByText('SHOP-123');
  fireEvent.click(screen.getByRole('button', { name: 'Send test webhook' }));
  expect(await screen.findByText(/Test webhook queued/)).toBeTruthy();expect(merchantApi.post).toHaveBeenCalledWith(`${base}/webhook/test`);
  fireEvent.click(screen.getByRole('button', { name: 'View attempts delivery' }));
  expect(await screen.findByRole('dialog', { name: 'Delivery attempts' })).toHaveProperty('textContent', expect.stringContaining('HTTP_500'));
});
it('shows settings errors without reporting success', async () => {
  merchantApi.put.mockRejectedValueOnce(new Error('Webhook URL rejected'));render(<MerchantOperations />);await screen.findByText('SHOP-123');
  fireEvent.click(screen.getByRole('button', { name: 'Save webhook settings' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Webhook URL rejected'));
  expect(screen.queryByText('Webhook settings saved.')).toBeNull();
});
it('handles empty orders and prevents testing a disabled webhook', async () => {
  merchantApi.get.mockImplementation(async path => ({ data: { data: path === `${base}/orders` ? { orders: [], total: 0 } : path === `${base}/webhook` ? { ...settings, enabled: false } : { deliveries: [], total: 0 } } }));
  render(<MerchantOperations />);expect(await screen.findByText('No orders match this filter.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send test webhook' }).disabled).toBe(true);
});
it('rotates a signing secret only after confirmation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  merchantApi.post.mockResolvedValue({ data: { data: { settings, signingSecret: 'whsec_rotated' } } });
  render(<MerchantOperations />); await screen.findByText('SHOP-123');
  fireEvent.click(screen.getByRole('button', { name: 'Rotate signing secret' })); expect(merchantApi.post).not.toHaveBeenCalled();
  confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Rotate signing secret' }));
  expect(await screen.findByText('whsec_rotated')).toBeTruthy();
  expect(merchantApi.post).toHaveBeenCalledWith(`${base}/webhook/rotate`);
});
it('paginates orders through the browser API', async () => {
  const original = merchantApi.get.getMockImplementation();
  merchantApi.get.mockImplementation(async (path, config) => path === `${base}/orders`
    ? { data: { data: { orders: [order], total: 25 } } } : original(path, config));
  render(<MerchantOperations />);await screen.findByText('SHOP-123');
  fireEvent.click(screen.getByRole('button', { name: 'Next orders' }));
  await waitFor(() => expect(merchantApi.get).toHaveBeenCalledWith(`${base}/orders`, { params: { page: 1, size: 20, status: '' } }));
  expect(await screen.findByText('Page 2 · 25 orders')).toBeTruthy();
});
