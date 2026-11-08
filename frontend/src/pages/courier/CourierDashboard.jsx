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
  AlertCircle,
  Navigation,
  Image as ImageIcon
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
    const successRate = total > 0 ? Math.round((delivered / (total || 1)) * 100) : 100;

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
    <div className="space-y-6">
      {/* Page Header (Lovable SaaS Dashboard Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Today's Deliveries
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                courier?.isAvailable
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  courier?.isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              {courier?.isAvailable ? 'On Duty Courier' : 'Off Duty'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {courier?.name || 'Assigned Courier'} • {courier?.vehicleType || 'Motorcycle'} ({courier?.licenseNo || 'WP-AB-1234'}) • {courier?.zone || 'Western Province'}
          </p>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleAvailability}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border shadow-sm ${
              courier?.isAvailable
                ? 'bg-white border-[#EBE7DF] text-slate-700 hover:bg-slate-50'
                : 'bg-[#F95716] border-[#F95716] text-white hover:bg-[#E0480C]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                courier?.isAvailable ? 'bg-emerald-500' : 'bg-white'
              }`}
            />
            <span>{courier?.isAvailable ? 'Go Off Duty' : 'Go On Duty'}</span>
          </button>

          <button
            onClick={fetchDeliveries}
            disabled={loading}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-[#EBE7DF] transition shadow-sm flex items-center justify-center"
            title="Refresh Deliveries"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#F95716]' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid (Exact Merchant Orders Style from Lovable Screenshot) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#EBE7DF] shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            ORDERS TODAY
          </p>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.total}</h3>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#EBE7DF] shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            IN TRANSIT
          </p>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.inTransit}</h3>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#EBE7DF] shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            DELIVERED
          </p>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.delivered}</h3>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#EBE7DF] shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            SUCCESS RATE
          </p>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.successRate}%</h3>
        </div>
      </div>

      {/* Filter Tabs & Search Bar (Exact Lovable Screenshot Style) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Segmented Pill Tabs */}
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
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-[#EBE7DF]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live Search Bar */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tracking #, city, recipient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-full bg-white border border-[#EBE7DF] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95716] focus:border-[#F95716] transition shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Deliveries Grid */}
      {loading ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-[#EBE7DF] shadow-sm">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-[#F95716] border-r-transparent mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading delivery task board...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to courier service...</p>
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-[#EBE7DF] shadow-sm px-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#F95716] flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Truck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No deliveries found</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'No packages match your search filter. Try clearing your search query.'
              : 'There are currently no parcels assigned in this category.'}
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
                className="bg-white rounded-2xl border border-[#EBE7DF] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-5">
                  {/* Card Header: Tracking Number & Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        TRACKING #
                      </span>
                      <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                        {parcel.trackingNumber}
                      </p>
                    </div>
                    <StatusBadge status={parcel.status} />
                  </div>

                  {/* Progress Journey Stepper (Lovable Hero Card Aesthetic) */}
                  <div className="py-2.5 mb-4 px-1">
                    <div className="flex items-center justify-between relative">
                      <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0" />
                      <div
                        className="absolute top-1/2 left-0 h-1 bg-[#F95716] -translate-y-1/2 z-0 transition-all duration-300"
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

                      {['Pickup', 'Transit', 'Out', 'Delivered'].map((step, idx) => {
                        const active = stageIdx >= idx + 1;
                        return (
                          <div key={step} className="relative z-10 flex flex-col items-center">
                            <div
                              className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                                isTerminal
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : active
                                  ? 'bg-[#F95716] border-[#F95716] text-white'
                                  : 'bg-white border-slate-300 text-transparent'
                              }`}
                            >
                              <Check className="w-2.5 h-2.5" />
                            </div>
                            <span className="text-[9px] font-semibold text-slate-400 mt-1 uppercase">
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Route & Delivery Details */}
                  <div className="space-y-3 pt-3 border-t border-[#EBE7DF]/60 text-xs">
                    {/* Dropoff Destination */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-orange-50 text-[#F95716] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Deliver To
                        </span>
                        <p className="font-semibold text-slate-900 truncate">
                          {parcel.dropoffAddress}, {parcel.dropoffCity}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-slate-600 font-medium truncate">
                            {parcel.recipientName}
                          </span>
                          {parcel.recipientPhone && (
                            <a
                              href={`tel:${parcel.recipientPhone}`}
                              className="inline-flex items-center gap-1 text-[#F95716] hover:text-[#E0480C] font-semibold text-[11px]"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{parcel.recipientPhone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pickup Hub */}
                    <div className="flex items-start gap-2.5 text-slate-500">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Package className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Pickup Hub
                        </span>
                        <p className="truncate text-slate-700">
                          {parcel.pickupAddress}, {parcel.pickupCity}
                        </p>
                      </div>
                    </div>

                    {/* Parcel Specs */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#EBE7DF]/60 text-[11px]">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FBF9F4] text-slate-700 font-semibold border border-[#EBE7DF]">
                        {parcel.weightKg || '1.0'} kg • {parcel.size || 'MEDIUM'}
                      </span>
                      {parcel.proofImageUrl && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Proof Attached</span>
                        </span>
                      )}
                    </div>

                    {/* Failure Note if Failed */}
                    {isFailed && parcel.failureReason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span><strong>Reason:</strong> {parcel.failureReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 bg-[#FBF9F4]/70 border-t border-[#EBE7DF]">
                  {!isTerminal ? (
                    <button
                      onClick={() => openUpdateModal(parcel)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#F95716] hover:bg-[#E0480C] text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 group"
                    >
                      <span>Update Delivery Progress</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 py-1 text-emerald-600 text-xs font-bold">
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

      {/* Status Update Modal (Lovable Dialog Aesthetic) */}
      {selectedParcel && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#EBE7DF] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#EBE7DF]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F95716]">
                  STATUS STEPPER
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
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
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4 mt-5">
              {/* Advance Delivery Stage Cards */}
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
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? item.id === 'FAILED'
                              ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-sm'
                              : 'bg-orange-50 border-[#F95716] text-slate-900 shadow-sm'
                            : 'border-[#EBE7DF] hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 mb-2 ${
                            isSelected
                              ? item.id === 'FAILED'
                                ? 'text-rose-600'
                                : 'text-[#F95716]'
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

              {/* Delivery Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Delivery Note / Handed Over To
                </label>
                <input
                  type="text"
                  placeholder="e.g. Handed to recipient / Received by security guard"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#EBE7DF] text-xs text-slate-800 focus:ring-2 focus:ring-[#F95716] focus:border-[#F95716] focus:outline-none bg-white"
                />
              </div>

              {/* Photo Proof Upload Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Proof of Delivery Photo
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 border border-dashed border-[#EBE7DF] rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 transition">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>{uploadingPhoto ? 'Uploading...' : 'Upload / Snap Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  {proofUrl && (
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <Check className="w-3.5 h-3.5" />
                      <span>Photo Attached</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EBE7DF]">
                <button
                  type="button"
                  onClick={() => setSelectedParcel(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#EBE7DF] text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2.5 rounded-xl bg-[#F95716] hover:bg-[#E0480C] text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>{updating ? 'Saving...' : 'Confirm Status Update'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
