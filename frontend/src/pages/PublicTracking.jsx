import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { StatusBadge } from '../components/StatusBadge';
import { TrackingTimeline } from '../components/TrackingTimeline';
import { Search, MapPin, Calendar, Clock, AlertCircle, Radio, User, ArrowLeft } from 'lucide-react';

export const PublicTracking = () => {
  const { trackingNumber: routeTrackingNumber } = useParams();
  const [searchInput, setSearchInput] = useState(routeTrackingNumber || '');
  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liveUpdated, setLiveUpdated] = useState(false);

  const { socket, joinParcelRoom, leaveParcelRoom } = useSocket();
  const navigate = useNavigate();

  const fetchTrackingData = async (code) => {
    if (!code) return;
    setLoading(true);
    setError('');
    setLiveUpdated(false);

    try {
      const res = await api.get(`/parcels/track/${code}`);
      if (res.data.success) {
        setParcel(res.data.data);
      }
    } catch (err) {
      setParcel(null);
      setError(err.response?.data?.message || 'Tracking number not found. Please verify the code.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (routeTrackingNumber) {
      setSearchInput(routeTrackingNumber);
      fetchTrackingData(routeTrackingNumber);
    }
  }, [routeTrackingNumber]);

  // WebSocket Live Real-time listener
  useEffect(() => {
    if (!parcel?.trackingNumber) return;

    joinParcelRoom(parcel.trackingNumber);

    const handleStatusUpdate = (update) => {
      if (update.trackingNumber === parcel.trackingNumber) {
        setLiveUpdated(true);
        // Refresh parcel data to get latest history
        fetchTrackingData(parcel.trackingNumber);
      }
    };

    if (socket) {
      socket.on('status:update', handleStatusUpdate);
    }

    return () => {
      leaveParcelRoom(parcel.trackingNumber);
      if (socket) {
        socket.off('status:update', handleStatusUpdate);
      }
    };
  }, [parcel?.trackingNumber, socket]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/track/${searchInput.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-center">
          Live Parcel Tracking
        </h1>
        <p className="text-slate-500 text-center text-sm mt-1">
          Monitor your shipment's journey in real-time
        </p>

        <form onSubmit={handleSearchSubmit} className="mt-6 max-w-lg mx-auto flex shadow-sm rounded-xl overflow-hidden border border-slate-300 bg-white p-1">
          <div className="flex items-center pl-3 flex-1">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Enter tracking code (e.g. SD...)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full text-sm font-mono focus:outline-none text-slate-900 uppercase"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
          >
            Track
          </button>
        </form>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-r-transparent mb-3" />
          <p className="text-sm font-semibold text-slate-600">Retrieving tracking status...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-3 text-sm max-w-lg mx-auto">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {parcel && !loading && (
        <div className="space-y-6 animate-fadeIn">
          {/* Real-time Indicator banner */}
          <div className="flex items-center justify-between bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-sm">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Live WebSocket Channel Active
              </span>
            </div>
            {liveUpdated && (
              <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-semibold animate-pulse">
                Just Updated!
              </span>
            )}
          </div>

          {/* Main Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tracking Code
                </span>
                <h2 className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                  {parcel.trackingNumber}
                </h2>
              </div>
              <div>
                <StatusBadge status={parcel.status} />
              </div>
            </div>

            {/* Route Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 p-4 bg-slate-50 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">From</span>
                  <p className="text-sm font-bold text-slate-900">{parcel.pickupCity}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Destination</span>
                  <p className="text-sm font-bold text-slate-900">{parcel.dropoffCity}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{parcel.dropoffAddress}</p>
                </div>
              </div>
            </div>

            {/* Courier info if assigned */}
            {parcel.courier && (
              <div className="mb-6 p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      Assigned Courier
                    </span>
                    <p className="text-sm font-bold text-slate-900">{parcel.courier.user.name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Visual Timeline */}
            <div className="pt-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
                Delivery Timeline
              </h3>
              <TrackingTimeline status={parcel.status} history={parcel.statusHistory} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
