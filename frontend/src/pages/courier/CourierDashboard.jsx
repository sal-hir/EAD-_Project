import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { Truck, CheckCircle2, Clock, AlertTriangle, Upload, Camera, RefreshCw, Check } from 'lucide-react';

export const CourierDashboard = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [courier, setCourier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

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
      if (res.data.success) {
        setDeliveries(res.data.data.parcels);
        setCourier(res.data.data.courier);
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
      if (res.data.success) {
        setCourier({ ...courier, isAvailable: !courier.isAvailable });
      }
    } catch (err) {
      alert('Failed to update availability status');
    }
  };

  const openUpdateModal = (parcel) => {
    setSelectedParcel(parcel);
    setNewStatus('');
    setNote('');
    setFailureReason('');
    setProofUrl('');
    setModalError('');

    // Preselect next logical status
    const transitions = {
      PENDING_PICKUP: 'PICKED_UP',
      PICKED_UP: 'IN_TRANSIT',
      IN_TRANSIT: 'OUT_FOR_DELIVERY',
      OUT_FOR_DELIVERY: 'DELIVERED',
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
      if (res.data.success) {
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

      if (res.data.success) {
        setSelectedParcel(null);
        fetchDeliveries();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner with Courier Profile & Status Toggle */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Courier Dispatch Console
            </h1>
            <p className="text-xs text-slate-500">
              Vehicle: <span className="font-semibold text-slate-700">{courier?.vehicleType || 'Motorcycle'} ({courier?.licenseNo || 'N/A'})</span> • Zone: <span className="font-semibold text-slate-700">{courier?.zone || 'All Zones'}</span>
            </p>
          </div>
        </div>

        {/* Duty Status Switch */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold uppercase text-slate-500">Duty Status:</span>
          <button
            onClick={toggleAvailability}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center space-x-1.5 ${
              courier?.isAvailable
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${courier?.isAvailable ? 'bg-emerald-600' : 'bg-slate-400'}`} />
            <span>{courier?.isAvailable ? 'Available for Orders' : 'Off Duty'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Refresh Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Assigned Parcels</option>
            <option value="PENDING_PICKUP">Pending Pickup</option>
            <option value="PICKED_UP">Picked Up</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <button
          onClick={fetchDeliveries}
          className="p-2 text-slate-500 hover:text-amber-600 rounded-xl border border-slate-200 transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Deliveries List */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-r-transparent mb-2" />
          <p className="text-sm font-semibold text-slate-500">Loading deliveries...</p>
        </div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No deliveries assigned</h3>
          <p className="text-slate-500 text-sm mt-1">Check back later or wait for dispatch assignments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {deliveries.map((parcel) => (
            <div
              key={parcel.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tracking
                    </span>
                    <p className="font-mono font-bold text-slate-900 text-sm">{parcel.trackingNumber}</p>
                  </div>
                  <StatusBadge status={parcel.status} />
                </div>

                <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Pickup:</span>
                    <p className="font-semibold text-slate-800">{parcel.pickupAddress}, {parcel.pickupCity}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-semibold">Delivery To:</span>
                    <p className="font-semibold text-slate-800">{parcel.dropoffAddress}, {parcel.dropoffCity}</p>
                    <p className="text-slate-500">{parcel.recipientName} ({parcel.recipientPhone})</p>
                  </div>

                  <div className="flex justify-between text-slate-500 pt-1">
                    <span>Weight: {parcel.weightKg} kg</span>
                    <span className="font-bold text-slate-800">Fee: LKR {parcel.estimatedFee}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-2">
                {parcel.status !== 'DELIVERED' && parcel.status !== 'CANCELLED' ? (
                  <button
                    onClick={() => openUpdateModal(parcel)}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition shadow-sm flex items-center justify-center space-x-1.5"
                  >
                    <span>Update Delivery Progress</span>
                  </button>
                ) : (
                  <div className="text-center text-xs font-semibold text-slate-400 py-1">
                    Delivery Completed
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status Update Modal */}
      {selectedParcel && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Update Parcel: {selectedParcel.trackingNumber}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Current Status: <span className="font-semibold text-slate-800">{selectedParcel.status}</span>
            </p>

            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Select New Status *
                </label>
                <select
                  required
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="PICKED_UP">Picked Up</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                  <option value="DELIVERED">Delivered (Success)</option>
                  <option value="FAILED">Delivery Failed</option>
                </select>
              </div>

              {/* Failed Reason if marked FAILED */}
              {newStatus === 'FAILED' && (
                <div>
                  <label className="block text-xs font-bold text-rose-700 uppercase mb-1">
                    Failure Reason *
                  </label>
                  <select
                    required
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/50 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    <option value="">Select reason...</option>
                    <option value="Recipient not available">Recipient not available / unreachable</option>
                    <option value="Incorrect or incomplete address">Incorrect or incomplete address</option>
                    <option value="Customer refused package">Customer refused package</option>
                    <option value="Premises closed / inaccessible">Premises closed / inaccessible</option>
                  </select>
                </div>
              )}

              {/* Delivery Note / Proof note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Delivery Note / Recipient Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received by security guard / Mrs. Perera"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Proof Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Proof of Delivery Photo (Optional)
                </label>
                <div className="flex items-center space-x-3">
                  <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-700 transition">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>{uploadingPhoto ? 'Uploading...' : 'Take / Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  {proofUrl && (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Photo Attached</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedParcel(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {updating ? 'Saving...' : 'Confirm Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
