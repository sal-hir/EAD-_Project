import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Truck, MapPin, Calculator, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const CreateParcel = () => {
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [zoneId, setZoneId] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffCity, setDropoffCity] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [weightKg, setWeightKg] = useState('1');
  const [size, setSize] = useState('SMALL');
  const [description, setDescription] = useState('');

  // Fee calculation state (Strategy pattern preview)
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    api.get('/zones')
      .then((res) => {
        if (res.data.success && res.data.data.length > 0) {
          setZones(res.data.data);
          setZoneId(res.data.data[0].id);
        }
      })
      .catch((err) => console.error('Failed to load delivery zones', err))
      .finally(() => setLoadingZones(false));
  }, []);

  // Recalculate fee whenever zone, weight, or size changes
  useEffect(() => {
    if (!zoneId || !weightKg) return;

    setEstimating(true);
    const weight = parseFloat(weightKg) || 1;

    api.get('/parcels/estimate', {
      params: { zoneId, weightKg: weight, size },
    })
      .then((res) => {
        if (res.data.success) {
          setEstimate(res.data.data);
        }
      })
      .catch((err) => console.error('Estimate failed', err))
      .finally(() => setEstimating(false));
  }, [zoneId, weightKg, size]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await api.post('/parcels', {
        zoneId,
        pickupAddress,
        pickupCity,
        dropoffAddress,
        dropoffCity,
        recipientName,
        recipientPhone,
        recipientEmail: recipientEmail || undefined,
        weightKg: parseFloat(weightKg),
        size,
        description: description || undefined,
      });

      if (res.data.success) {
        navigate(`/parcels/${res.data.data.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create parcel request. Please verify details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Create Delivery Request
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Specify pickup and destination details. Delivery fee is computed automatically.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Pickup & Delivery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pickup Address */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-sm border-b border-slate-100 pb-3">
              <MapPin className="w-4 h-4" />
              <span>1. Pickup Details</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Pickup Address *
              </label>
              <input
                type="text"
                required
                placeholder="No 25, Duplication Road"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Pickup City *
              </label>
              <input
                type="text"
                required
                placeholder="Colombo 03"
                value={pickupCity}
                onChange={(e) => setPickupCity(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Drop-off Address & Recipient */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-indigo-600 font-bold text-sm border-b border-slate-100 pb-3">
              <MapPin className="w-4 h-4" />
              <span>2. Delivery & Recipient</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Recipient Name *
              </label>
              <input
                type="text"
                required
                placeholder="Sunil Shantha"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Recipient Phone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+94771234567"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  placeholder="name@email.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Drop-off Address *
              </label>
              <input
                type="text"
                required
                placeholder="No 108, Peradeniya Road"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Drop-off City *
              </label>
              <input
                type="text"
                required
                placeholder="Kandy"
                value={dropoffCity}
                onChange={(e) => setDropoffCity(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Parcel Spec & Pricing Preview */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
            <Calculator className="w-4 h-4 text-blue-600" />
            <span>3. Parcel Specification & Estimated Fee</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Delivery Zone *
              </label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} (est. {z.estimatedDays} day{z.estimatedDays > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Weight in KG *
              </label>
              <input
                type="number"
                min="0.1"
                max="200"
                step="0.1"
                required
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Package Size *
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="SMALL">Small (Envelope / Pouch)</option>
                <option value="MEDIUM">Medium (Shoebox / Carton)</option>
                <option value="LARGE">Large (Crate / Big Box)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Contents Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Fragile glassware, documents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Estimated Fee Callout */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Live Pricing Calculation (Strategy Pattern)
              </span>
              <p className="text-sm text-slate-600 mt-0.5">
                Calculated dynamically from Zone base rate, weight multiplier, and package volume.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">Estimated Delivery Fee</span>
              <span className="text-2xl font-black text-blue-700">
                {estimating ? 'Calculating...' : estimate ? `LKR ${estimate.estimatedFee.toFixed(2)}` : 'LKR —'}
              </span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/customer')}
            className="px-5 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 transition text-sm"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition text-sm shadow-md shadow-blue-500/20 flex items-center space-x-2 disabled:opacity-50"
          >
            <span>{submitting ? 'Confirming Order...' : 'Confirm Delivery Request'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
