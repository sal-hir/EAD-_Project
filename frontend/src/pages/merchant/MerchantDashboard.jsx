import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { Store, Key, Globe, Copy, Check, RefreshCw, AlertCircle, Eye, EyeOff, Code } from 'lucide-react';

export const MerchantDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, ordersRes] = await Promise.all([
        api.get('/merchants/dashboard'),
        api.get('/merchants/orders'),
      ]);

      if (dashRes.data.success) {
        setDashboard(dashRes.data.data);
        setWebhookUrl(dashRes.data.data.merchant.webhookUrl || '');
      }
      if (ordersRes.data.success) {
        setOrders(ordersRes.data.data.parcels);
      }
    } catch (err) {
      console.error('Failed to load merchant data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCopyKey = () => {
    if (dashboard?.merchant?.apiKey) {
      navigator.clipboard.writeText(dashboard.merchant.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm('Are you sure you want to regenerate your API Key? Any existing integrations using this key will break.')) {
      return;
    }
    try {
      const res = await api.post('/merchants/api-key/regenerate');
      if (res.data.success) {
        setDashboard({
          ...dashboard,
          merchant: { ...dashboard.merchant, apiKey: res.data.data.apiKey },
        });
        alert('API key regenerated successfully');
      }
    } catch (err) {
      alert('Failed to regenerate API key');
    }
  };

  const handleSaveWebhook = async (e) => {
    e.preventDefault();
    setSavingWebhook(true);
    setWebhookMessage('');
    try {
      const res = await api.patch('/merchants/webhook', { webhookUrl });
      if (res.data.success) {
        setWebhookMessage('Webhook endpoint updated successfully!');
      }
    } catch (err) {
      setWebhookMessage('Failed to update webhook URL');
    } finally {
      setSavingWebhook(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-r-transparent mb-3" />
        <p className="text-slate-500 font-semibold text-sm">Loading merchant portal...</p>
      </div>
    );
  }

  const merchant = dashboard?.merchant;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {merchant?.businessName || 'Merchant Portal'}
            </h1>
            <p className="text-xs text-slate-500">
              Registered business email: <span className="font-semibold text-slate-700">{merchant?.businessEmail}</span>
            </p>
          </div>
        </div>

        {/* Approval Status Chip */}
        <div>
          {merchant?.isApproved ? (
            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              <span>Merchant Account Approved</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Pending Admin Approval</span>
            </span>
          )}
        </div>
      </div>

      {/* API Key & Webhook Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* API Key Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2 text-indigo-600 font-bold text-sm">
              <Key className="w-4 h-4" />
              <span>API Key Authentication</span>
            </div>
            <button
              onClick={handleRegenerateKey}
              className="text-xs text-slate-500 hover:text-rose-600 font-semibold transition"
            >
              Regenerate
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Include this key in the <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">X-API-Key</code> HTTP header when calling our B2B order dispatch API.
          </p>

          <div className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <input
              type={showApiKey ? 'text' : 'password'}
              readOnly
              value={merchant?.apiKey || ''}
              className="bg-transparent flex-1 font-mono text-xs text-slate-800 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="p-1 text-slate-400 hover:text-slate-600 transition"
              title={showApiKey ? 'Hide' : 'Show'}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleCopyKey}
              className="p-1 text-slate-400 hover:text-indigo-600 transition"
              title="Copy"
            >
              {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Webhooks Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-blue-600 font-bold text-sm border-b border-slate-100 pb-3">
            <Globe className="w-4 h-4" />
            <span>Webhook Notification Endpoint</span>
          </div>

          <p className="text-xs text-slate-500">
            We will dispatch HTTP POST events to this endpoint with HMAC-SHA256 signatures whenever any of your parcels change status.
          </p>

          <form onSubmit={handleSaveWebhook} className="space-y-3">
            <input
              type="url"
              placeholder="https://yourstore.com/webhooks/swiftdrop"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />

            <div className="flex justify-between items-center pt-1">
              {webhookMessage && (
                <span className="text-xs font-semibold text-emerald-600">{webhookMessage}</span>
              )}
              <button
                type="submit"
                disabled={savingWebhook}
                className="ml-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition disabled:opacity-50"
              >
                {savingWebhook ? 'Saving...' : 'Save Webhook URL'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-900">Merchant Delivery Orders</h2>
          <span className="text-xs font-semibold text-slate-500">{orders.length} total orders</span>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">No merchant orders placed yet</p>
            <p className="text-xs text-slate-400 mt-1">Use the API endpoint below to automatically create parcel orders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Tracking</th>
                  <th className="px-6 py-3">Recipient</th>
                  <th className="px-6 py-3">City</th>
                  <th className="px-6 py-3">Weight</th>
                  <th className="px-6 py-3">Fee</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{ord.trackingNumber}</td>
                    <td className="px-6 py-4 text-slate-800">{ord.recipientName}</td>
                    <td className="px-6 py-4 text-slate-600">{ord.dropoffCity}</td>
                    <td className="px-6 py-4 text-slate-600">{ord.weightKg} kg</td>
                    <td className="px-6 py-4 font-bold text-slate-900">LKR {ord.estimatedFee}</td>
                    <td className="px-6 py-4"><StatusBadge status={ord.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Developer API Quick Reference */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-2">
          <Code className="w-4 h-4" />
          <span>B2B Developer API Quick Integration</span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          To create deliveries programmatically from your e-commerce platform (Shopify, WooCommerce, custom backend):
        </p>

        <div className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-slate-300 overflow-x-auto">
          <code>
{`curl -X POST http://localhost:4000/api/v1/parcels/merchant \\
  -H "X-API-Key: ${merchant?.apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "zoneId": "ZONE_UUID",
    "pickupAddress": "Warehouse 4, Port Road",
    "pickupCity": "Colombo",
    "dropoffAddress": "No 12, Highlevel Rd",
    "dropoffCity": "Maharagama",
    "recipientName": "Customer Name",
    "recipientPhone": "+94771234567",
    "weightKg": 1.5,
    "size": "MEDIUM"
  }'`}
          </code>
        </div>
      </div>
    </div>
  );
};
