import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { PlusCircle, Package, ArrowRight, Download, Search, RefreshCw } from 'lucide-react';

export const CustomerDashboard = () => {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const fetchParcels = async () => {
    setLoading(true);
    try {
      const res = await api.get('/parcels/my', {
        params: { status: filterStatus || undefined },
      });
      if (res.data.success) {
        setParcels(res.data.data.parcels);
      }
    } catch (err) {
      console.error('Failed to load parcels', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, [filterStatus]);

  const handleDownloadReceipt = async (parcelId, trackingNumber) => {
    try {
      const res = await api.get(`/parcels/${parcelId}/receipt`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${trackingNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Could not download receipt. Only delivered parcels have receipts available.');
    }
  };

  const filtered = parcels.filter((p) =>
    p.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
    p.dropoffCity.toLowerCase().includes(search.toLowerCase()) ||
    p.recipientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Deliveries
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage your outgoing parcel requests and track shipments
          </p>
        </div>

        <Link
          to="/customer/new"
          className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm shadow-blue-500/20 transition self-start sm:self-auto text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Delivery</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by tracking, city, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="CREATED">Created</option>
            <option value="PENDING_PICKUP">Pending Pickup</option>
            <option value="PICKED_UP">Picked Up</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="FAILED">Failed</option>
          </select>

          <button
            onClick={fetchParcels}
            title="Refresh list"
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Parcel Cards List */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-r-transparent mb-2" />
          <p className="text-sm font-semibold text-slate-500">Loading your deliveries...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No deliveries found</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
            You haven't requested any deliveries matching your filter yet.
          </p>
          <Link
            to="/customer/new"
            className="mt-4 inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:underline"
          >
            <span>Create your first delivery request</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((parcel) => (
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

                <div className="space-y-1.5 py-3 border-y border-slate-100 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recipient:</span>
                    <span className="font-semibold text-slate-800">{parcel.recipientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination:</span>
                    <span className="font-semibold text-slate-800">{parcel.dropoffCity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Weight & Size:</span>
                    <span className="font-semibold text-slate-800">{parcel.weightKg} kg ({parcel.size})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Estimated Fee:</span>
                    <span className="font-bold text-blue-600">LKR {parcel.estimatedFee.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 flex items-center justify-between">
                <Link
                  to={`/parcels/${parcel.id}`}
                  className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                {parcel.status === 'DELIVERED' && (
                  <button
                    onClick={() => handleDownloadReceipt(parcel.id, parcel.trackingNumber)}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Receipt</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
