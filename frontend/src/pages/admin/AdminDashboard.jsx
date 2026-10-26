import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import {
  Shield, Truck, Package, Users, BarChart3, Store, Check,
  AlertTriangle, RefreshCw, PlusCircle, CheckCircle2
} from 'lucide-react';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dispatch');
  const [loading, setLoading] = useState(true);

  // Data states
  const [unassignedParcels, setUnassignedParcels] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [reports, setReports] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [zones, setZones] = useState([]);

  // Assignment action state
  const [assigningParcel, setAssigningParcel] = useState(null);
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [parcelsRes, couriersRes, reportsRes, merchantsRes, zonesRes] = await Promise.all([
        api.get('/parcels', { params: { unassignedOnly: 'true' } }),
        api.get('/couriers'),
        api.get('/admin/reports'),
        api.get('/admin/merchants'),
        api.get('/zones'),
      ]);

      if (parcelsRes.data.success) setUnassignedParcels(parcelsRes.data.data.parcels);
      if (couriersRes.data.success) setCouriers(couriersRes.data.data);
      if (reportsRes.data.success) setReports(reportsRes.data.data);
      if (merchantsRes.data.success) setMerchants(merchantsRes.data.data.merchants);
      if (zonesRes.data.success) setZones(zonesRes.data.data);
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assigningParcel || !selectedCourierId) return;

    setSubmittingAssign(true);
    try {
      const res = await api.patch(`/parcels/${assigningParcel.id}/assign`, {
        courierId: selectedCourierId,
      });
      if (res.data.success) {
        setAssigningParcel(null);
        setSelectedCourierId('');
        fetchAllData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign courier');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleApproveMerchant = async (merchantId) => {
    try {
      const res = await api.patch(`/admin/merchants/${merchantId}/approve`);
      if (res.data.success) {
        setMerchants(
          merchants.map((m) => (m.id === merchantId ? { ...m, isApproved: true } : m))
        );
      }
    } catch (err) {
      alert('Failed to approve merchant');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Dispatcher & Operations Control Center
            </h1>
            <p className="text-xs text-slate-500">
              Real-time island-wide dispatching, fleet management, and business intelligence
            </p>
          </div>
        </div>

        <button
          onClick={fetchAllData}
          className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh All</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold uppercase tracking-wider">
        <button
          onClick={() => setActiveTab('dispatch')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'dispatch'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Dispatch Queue ({unassignedParcels.length})
        </button>

        <button
          onClick={() => setActiveTab('workload')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'workload'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Courier Workloads ({couriers.length})
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'analytics'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Reports & KPI Analytics
        </button>

        <button
          onClick={() => setActiveTab('merchants')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'merchants'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Merchant Approvals
        </button>

        <button
          onClick={() => setActiveTab('zones')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'zones'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Delivery Zones & Pricing
        </button>
      </div>

      {/* Tab 1: Dispatch Queue */}
      {activeTab === 'dispatch' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900">Unassigned Parcels Awaiting Courier</h2>
            <span className="text-xs font-semibold text-slate-500">{unassignedParcels.length} pending</span>
          </div>

          {unassignedParcels.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">Dispatch Queue is Clear</p>
              <p className="text-xs text-slate-400 mt-1">All orders have been assigned to couriers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Tracking</th>
                    <th className="px-6 py-3">Pickup Location</th>
                    <th className="px-6 py-3">Drop-off Destination</th>
                    <th className="px-6 py-3">Recipient</th>
                    <th className="px-6 py-3">Weight</th>
                    <th className="px-6 py-3">Zone</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unassignedParcels.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">{p.trackingNumber}</td>
                      <td className="px-6 py-4 text-slate-700">{p.pickupCity}</td>
                      <td className="px-6 py-4 text-slate-700">{p.dropoffCity}</td>
                      <td className="px-6 py-4 text-slate-700">{p.recipientName}</td>
                      <td className="px-6 py-4 text-slate-600">{p.weightKg} kg</td>
                      <td className="px-6 py-4 text-slate-600">{p.zone?.name}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setAssigningParcel(p);
                            setSelectedCourierId(couriers[0]?.id || '');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm"
                        >
                          Assign Courier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Courier Workload Monitor */}
      {activeTab === 'workload' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {couriers.map((c) => (
              <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{c.user.name}</h3>
                      <p className="text-xs text-slate-500">{c.user.phone || c.user.email}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.isAvailable ? 'Available' : 'Off Duty'}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-600 py-2 border-y border-slate-100">
                    <p>Vehicle: <span className="font-semibold text-slate-800">{c.vehicleType || 'Motorcycle'} ({c.licenseNo || 'WP-0000'})</span></p>
                    <p>Zone: <span className="font-semibold text-slate-800">{c.zone || 'Colombo Metro'}</span></p>
                  </div>
                </div>

                <div className="mt-4 pt-2 flex justify-between items-center">
                  <span className="text-xs text-slate-500">Active Deliveries:</span>
                  <span className={`text-base font-black px-2 py-0.5 rounded-lg ${
                    c.activeDeliveries > 5 ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {c.activeDeliveries || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: KPI Reports & Analytics */}
      {activeTab === 'analytics' && reports && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Total Parcels</span>
              <span className="text-2xl font-black text-slate-900">{reports.totalParcels}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Booked Today</span>
              <span className="text-2xl font-black text-blue-600">{reports.todayParcels}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Delivered Today</span>
              <span className="text-2xl font-black text-emerald-600">{reports.deliveredToday}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Delivery Success Rate</span>
              <span className="text-2xl font-black text-indigo-600">{reports.successRate}%</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Status Distribution Breakdown
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              {reports.statusBreakdown?.map((item) => (
                <div key={item.status} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                  <span className="font-semibold text-slate-700">{item.status}</span>
                  <span className="font-bold text-slate-900 text-sm">{item._count.id}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Merchant Approvals */}
      {activeTab === 'merchants' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Merchant Account Verification</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Business Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Webhook Configured</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {merchants.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">{m.businessName}</td>
                    <td className="px-6 py-4 text-slate-700">{m.businessEmail}</td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{m.webhookUrl || 'Not configured'}</td>
                    <td className="px-6 py-4">
                      {m.isApproved ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Approved
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Pending Approval
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!m.isApproved && (
                        <button
                          onClick={() => handleApproveMerchant(m.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Zones & Pricing */}
      {activeTab === 'zones' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900">Delivery Zones & Rate Card</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Zone Name</th>
                  <th className="px-6 py-3">Base Fee</th>
                  <th className="px-6 py-3">Rate per KG</th>
                  <th className="px-6 py-3">Estimated SLA</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {zones.map((z) => (
                  <tr key={z.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">{z.name}</td>
                    <td className="px-6 py-4 text-slate-700">LKR {z.baseFee.toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-700">LKR {z.feePerKg.toFixed(2)} / kg</td>
                    <td className="px-6 py-4 text-slate-600">{z.estimatedDays} business day(s)</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Courier Assign Modal */}
      {assigningParcel && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-fadeIn">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Assign Courier to {assigningParcel.trackingNumber}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Destination: {assigningParcel.dropoffCity} • Weight: {assigningParcel.weightKg} kg
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Choose Available Courier
                </label>
                <select
                  required
                  value={selectedCourierId}
                  onChange={(e) => setSelectedCourierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.user.name} ({c.vehicleType || 'Motorcycle'}) — {c.activeDeliveries || 0} active orders
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningParcel(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {submittingAssign ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
