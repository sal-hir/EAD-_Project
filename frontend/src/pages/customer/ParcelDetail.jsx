import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { StatusBadge } from '../../components/StatusBadge';
import { TrackingTimeline } from '../../components/TrackingTimeline';
import { ArrowLeft, Download, MapPin, Package, User, Clock, AlertCircle } from 'lucide-react';

export const ParcelDetail = () => {
  const { id } = useParams();
  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveUpdated, setLiveUpdated] = useState(false);

  const { socket, joinParcelRoom, leaveParcelRoom } = useSocket();

  const fetchParcel = async () => {
    try {
      const res = await api.get(`/parcels/${id}`);
      if (res.data.success) {
        setParcel(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load parcel details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParcel();
  }, [id]);

  useEffect(() => {
    if (!parcel?.trackingNumber) return;

    joinParcelRoom(parcel.trackingNumber);

    const handleUpdate = (data) => {
      if (data.trackingNumber === parcel.trackingNumber) {
        setLiveUpdated(true);
        fetchParcel();
      }
    };

    if (socket) {
      socket.on('status:update', handleUpdate);
    }

    return () => {
      leaveParcelRoom(parcel.trackingNumber);
      if (socket) {
        socket.off('status:update', handleUpdate);
      }
    };
  }, [parcel?.trackingNumber, socket]);

  const handleDownloadReceipt = async () => {
    try {
      const res = await api.get(`/parcels/${parcel.id}/receipt`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${parcel.trackingNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Could not download receipt. Only delivered parcels have receipts available.');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-r-transparent mb-3" />
        <p className="text-slate-500 font-semibold text-sm">Loading parcel details...</p>
      </div>
    );
  }

  if (error || !parcel) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error || 'Parcel not found'}</span>
        </div>
        <Link to="/customer" className="mt-4 inline-flex items-center space-x-2 text-sm text-blue-600 font-bold hover:underline">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Deliveries</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/customer"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Deliveries</span>
        </Link>
      </div>

      {/* Real-time Indicator banner */}
      <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Real-Time Tracking Room Connected
          </span>
        </div>
        {liveUpdated && (
          <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-semibold animate-pulse">
            Status Updated!
          </span>
        )}
      </div>

      {/* Main Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-6 border-b border-slate-100 gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tracking Number
            </span>
            <h2 className="text-2xl font-black font-mono text-slate-900 tracking-tight">
              {parcel.trackingNumber}
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <StatusBadge status={parcel.status} />

            {parcel.status === 'DELIVERED' && (
              <button
                onClick={handleDownloadReceipt}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-xl shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF Receipt</span>
              </button>
            )}
          </div>
        </div>

        {/* Addresses & Recipient */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl text-sm">
          <div>
            <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Pickup Location</span>
            <p className="font-semibold text-slate-900">{parcel.pickupAddress}</p>
            <p className="text-slate-500 text-xs">{parcel.pickupCity}</p>
          </div>

          <div>
            <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Delivery Destination</span>
            <p className="font-semibold text-slate-900">{parcel.dropoffAddress}</p>
            <p className="text-slate-500 text-xs">{parcel.dropoffCity}</p>
            <p className="text-slate-700 text-xs mt-2">
              <span className="text-slate-400">Recipient:</span> {parcel.recipientName} ({parcel.recipientPhone})
            </p>
          </div>
        </div>

        {/* Parcel Spec Table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border border-slate-100 rounded-xl text-xs">
          <div>
            <span className="text-slate-400 block">Weight</span>
            <span className="font-bold text-slate-900 text-sm">{parcel.weightKg} kg</span>
          </div>
          <div>
            <span className="text-slate-400 block">Size</span>
            <span className="font-bold text-slate-900 text-sm">{parcel.size}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Delivery Zone</span>
            <span className="font-bold text-slate-900 text-sm">{parcel.zone?.name}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Delivery Fee</span>
            <span className="font-bold text-blue-600 text-sm">LKR {parcel.estimatedFee.toFixed(2)}</span>
          </div>
        </div>

        {/* Visual Progress Stepper */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
            Status History
          </h3>
          <TrackingTimeline status={parcel.status} history={parcel.statusHistory} />
        </div>
      </div>
    </div>
  );
};
