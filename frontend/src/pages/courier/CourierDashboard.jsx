import React, { useState, useEffect, useMemo } from 'react';
import { courierApi as api } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import {
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Camera,
  RefreshCw,
  Check,
  Search,
  MapPin,
  Phone,
  Package,
  Calendar,
  ChevronRight,
  X,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Navigation
} from 'lucide-react';

export const CourierDashboard = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [courier, setCourier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Status update modal state
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [note, setNote] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [updating, setUpdating] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/couriers/my-deliveries', {
        params: { status: filterStatus || undefined },
      });
      if (res.data?.success) {
        setDeliveries(res.data.data.parcels || []);
        setCourier(res.data.data.courier || null);
      }
    } catch (err) {
      console.error('Failed to load courier deliveries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [filterStatus]);

  const toggleAvailability = async () => {
    if (!courier) return;
    try {
      const res = await api.patch('/couriers/availability', {
        isAvailable: !courier.isAvailable,
      });
      if (res.data?.success) {
        setCourier({ ...courier, isAvailable: !courier.isAvailable });
      }
    } catch (err) {
      alert('Failed to update availability status');
    }
  };

  const openUpdateModal = (parcel) => {
    setSelectedParcel(parcel);
    setNote(parcel.note || '');
    setFailureReason('');
    setProofUrl(parcel.proofImageUrl || '');
    setModalError('');

    // Preselect next logical status in State Machine
    const transitions = {
      PENDING_PICKUP: 'PICKED_UP',
      PICKED_UP: 'IN_TRANSIT',
      IN_TRANSIT: 'OUT_FOR_DELIVERY',
      OUT_FOR_DELIVERY: 'DELIVERED',
      FAILED: 'OUT_FOR_DELIVERY',
    };
    setNewStatus(transitions[parcel.status] || 'DELIVERED');
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    setModalError('');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await api.post('/uploads/proof', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setProofUrl(res.data.data.url);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to upload proof photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParcel || !newStatus) return;

    setUpdating(true);
    setModalError('');

    try {
      const res = await api.patch(`/parcels/${selectedParcel.id}/status`, {
        status: newStatus,
        note: note || undefined,
        proofImageUrl: proofUrl || undefined,
        failureReason: newStatus === 'FAILED' ? failureReason : undefined,
      });

      if (res.data?.success) {
        setSelectedParcel(null);
        fetchDeliveries();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to update delivery status');
    } finally {
      setUpdating(false);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = deliveries.length;
    const delivered = deliveries.filter((d) => d.status === 'DELIVERED').length;
    const inTransit = deliveries.filter(
      (d) => d.status === 'IN_TRANSIT' || d.status === 'OUT_FOR_DELIVERY' || d.status === 'PICKED_UP'
    ).length;
    const failed = deliveries.filter((d) => d.status === 'FAILED').length;
    const successRate = total > 0 ? Math.round((delivered / (total - (total - delivered - failed || 0) || 1)) * 100) : 100;

    return { total, delivered, inTransit, failed, successRate };
  }, [deliveries]);

  // Client-side search filtering
  const filteredDeliveries = useMemo(() => {
    if (!searchQuery.trim()) return deliveries;
    const q = searchQuery.toLowerCase();
    return deliveries.filter(
      (d) =>
        d.trackingNumber?.toLowerCase().includes(q) ||
        d.recipientName?.toLowerCase().includes(q) ||
        d.dropoffCity?.toLowerCase().includes(q) ||
        d.dropoffAddress?.toLowerCase().includes(q)
    );
  }, [deliveries, searchQuery]);

  // Stepper Stage Calculator
  const getStageIndex = (status) => {
    switch (status) {
      case 'PENDING_PICKUP':
        return 0;
      case 'PICKED_UP':
        return 1;
      case 'IN_TRANSIT':
        return 2;
      case 'OUT_FOR_DELIVERY':
        return 3;
      case 'DELIVERED':
        return 4;
      default:
        return 0;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Hero Courier Card (Lovable SaaS Aesthetic) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/20">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                    <Truck className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400" />
                  </div>
                </div>
                <span
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    courier?.isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {courier?.name || 'Assigned Courier'}
                  </h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Active Driver
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-300">
                  <span className="flex items-center space-x-1">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <span>{courier?.vehicleType || 'Motorcycle'} ({courier?.licenseNo || 'WP-AB-1234'})</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{courier?.zone || 'Western Province'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Duty Availability Toggle & Action Button */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={toggleAvailability}
                className={`relative px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 border shadow-sm ${
                  courier?.isAvailable
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    courier?.isAvailable ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-500'
                  }`}
                />
                <span>{courier?.isAvailable ? 'On Duty • Accepting Tasks' : 'Off Duty'}</span>
              </button>

              <button
                onClick={fetchDeliveries}
                disabled={loading}
                className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 transition flex items-center justify-center"
                title="Refresh Deliveries"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 space-y-6">
        {/* KPI Stats Grid (Lovable SaaS Metric Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Assigned</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Parcels on taskboard</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Package className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">In Transit</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">{stats.inTransit}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Active on road</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Truck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivered Today</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{stats.delivered}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Completed success</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Failed / Retrying</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">{stats.failed}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Requires attention</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter & Live Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: '', label: 'All' },
              { id: 'PENDING_PICKUP', label: 'Pending' },
              { id: 'PICKED_UP', label: 'Picked Up' },
              { id: 'IN_TRANSIT', label: 'In Transit' },
              { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
              { id: 'DELIVERED', label: 'Delivered' },
              { id: 'FAILED', label: 'Failed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  filterStatus === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tracking, recipient, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Deliveries Grid */}
        {loading ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="inline-block animate-spin rounded-full h-9 w-9 border-4 border-amber-500 border-r-transparent mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading delivery taskboard...</p>
            <p className="text-xs text-slate-400 mt-1">Connecting to courier service cluster...</p>
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Truck className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No deliveries found</h3>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'No assigned packages match your search filter. Try clearing the search query.'
                : 'There are currently no deliveries in this category assigned to your route.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDeliveries.map((parcel) => {
              const stageIdx = getStageIndex(parcel.status);
              const isTerminal = parcel.status === 'DELIVERED';
              const isFailed = parcel.status === 'FAILED';

              return (
                <div
                  key={parcel.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                    isTerminal
                      ? 'border-emerald-200/80'
                      : isFailed
                      ? 'border-rose-200/80'
                      : 'border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div className="p-5">
                    {/* Top Header: Tracking & Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Tracking No
                        </span>
                        <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                          {parcel.trackingNumber}
                        </p>
                      </div>
                      <StatusBadge status={parcel.status} />
                    </div>

                    {/* Progress Stepper Line */}
                    <div className="py-2 mb-4">
                      <div className="flex items-center justify-between relative">
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0" />
                        <div
                          className="absolute top-1/2 left-0 h-1 bg-amber-500 -translate-y-1/2 z-0 transition-all duration-300"
                          style={{
                            width:
                              parcel.status === 'DELIVERED'
                                ? '100%'
                                : parcel.status === 'OUT_FOR_DELIVERY'
                                ? '75%'
                                : parcel.status === 'IN_TRANSIT'
                                ? '50%'
                                : parcel.status === 'PICKED_UP'
                                ? '25%'
                                : '5%',
                          }}
                        />

                        {['Pickup', 'In Transit', 'Out', 'Delivered'].map((step, idx) => {
                          const active = stageIdx >= idx + 1;
                          return (
                            <div key={step} className="relative z-10 flex flex-col items-center">
                              <div
                                className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                                  isTerminal
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : active
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'bg-white border-slate-300 text-transparent'
                                }`}
                              >
                                <Check className="w-2.5 h-2.5" />
                              </div>
                              <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                                {step}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                      {/* Dropoff Destination (Primary) */}
                      <div className="flex items-start space-x-2.5">
                        <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Deliver To</span>
                          <p className="font-semibold text-slate-900 truncate">
                            {parcel.dropoffAddress}, {parcel.dropoffCity}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-slate-600 font-medium">{parcel.recipientName}</span>
                            {parcel.recipientPhone && (
                              <a
                                href={`tel:${parcel.recipientPhone}`}
                                className="inline-flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 font-bold text-[11px]"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{parcel.recipientPhone}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Pickup Hub */}
                      <div className="flex items-start space-x-2.5 text-slate-500">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Pickup Hub</span>
                          <p className="truncate text-slate-700">{parcel.pickupAddress}, {parcel.pickupCity}</p>
                        </div>
                      </div>

                      {/* Specs Badge Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                          Weight: {parcel.weightKg || '1.0'} kg • {parcel.size || 'MEDIUM'}
                        </span>
                        {parcel.proofImageUrl && (
                          <span className="inline-flex items-center space-x-1 text-emerald-600 font-bold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Proof Attached</span>
                          </span>
                        )}
                      </div>

                      {/* Failure Banner if FAILED */}
                      {isFailed && parcel.failureReason && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start space-x-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <span><strong>Reason:</strong> {parcel.failureReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100">
                    {!isTerminal ? (
                      <button
                        onClick={() => openUpdateModal(parcel)}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center space-x-2 group"
                      >
                        <span>Update Delivery Progress</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ) : (
                      <div className="flex items-center justify-center space-x-1.5 py-1 text-emerald-600 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Completed Successfully</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Status Update Modal (Modern Lovable Modal Dialog) */}
        {selectedParcel && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                    Status Stepper
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-0.5">
                    Update #{selectedParcel.trackingNumber}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Current stage: <span className="font-bold text-slate-800">{selectedParcel.status}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedParcel(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleStatusSubmit} className="space-y-4 mt-5">
                {/* Status Selection Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Advance Delivery Stage *
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      { id: 'PICKED_UP', label: 'Picked Up', icon: Package },
                      { id: 'IN_TRANSIT', label: 'In Transit', icon: Truck },
                      { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Navigation },
                      { id: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
                      { id: 'FAILED', label: 'Failed', icon: AlertCircle },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = newStatus === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setNewStatus(item.id)}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                            isSelected
                              ? item.id === 'FAILED'
                                ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-sm'
                                : 'bg-amber-50/80 border-amber-500 text-slate-900 shadow-sm'
                              : 'border-slate-200/80 hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 mb-2 ${
                              isSelected
                                ? item.id === 'FAILED'
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                                : 'text-slate-400'
                            }`}
                          />
                          <span className="text-xs font-bold leading-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mandatory Failure Reason if FAILED */}
                {newStatus === 'FAILED' && (
                  <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-2xl space-y-1.5 animate-in fade-in">
                    <label className="block text-xs font-bold text-rose-800 uppercase tracking-wider">
                      Failure Reason (Mandatory) *
                    </label>
                    <select
                      required
                      value={failureReason}
                      onChange={(e) => setFailureReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    >
                      <option value="">Select mandatory reason...</option>
                      <option value="Recipient not available / unreachable">Recipient not available / unreachable</option>
                      <option value="Incorrect or incomplete dropoff address">Incorrect or incomplete dropoff address</option>
                      <option value="Customer refused package / cancelled">Customer refused package / cancelled</option>
                      <option value="Premises closed or gated inaccessible">Premises closed or gated inaccessible</option>
                      <option value="Extreme weather or vehicle breakdown">Extreme weather or vehicle breakdown</option>
                    </select>
                  </div>
                )}

                {/* Delivery Note / Recipient Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Delivery Note / Handed Over To
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Handed to recipient / Received by security guard"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-slate-50/50"
                  />
                </div>

                {/* Photo Proof Upload Area */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Proof of Delivery Photo
                  </label>
                  <div className="flex items-center space-x-3">
                    <label className="cursor-pointer inline-flex items-center space-x-2 px-4 py-2.5 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 transition">
                      <Camera className="w-4 h-4 text-slate-500" />
                      <span>{uploadingPhoto ? 'Uploading Image...' : 'Upload / Snap Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>

                    {proofUrl && (
                      <span className="text-xs text-emerald-600 font-bold flex items-center space-x-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        <Check className="w-3.5 h-3.5" />
                        <span>Photo Attached</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedParcel(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    <span>{updating ? 'Saving Changes...' : 'Confirm Status Update'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
