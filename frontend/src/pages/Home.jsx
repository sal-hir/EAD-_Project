import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, Shield, Clock, Zap, ArrowRight, Search, CheckCircle, Store, UserCheck } from 'lucide-react';

export const Home = () => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const navigate = useNavigate();

  const handleTrack = (e) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      navigate(`/track/${trackingNumber.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-white to-transparent pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-800 text-xs font-bold px-3.5 py-1.5 rounded-full mb-6 uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 fill-blue-600" />
            <span>Next-Generation Island-wide Courier Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Fast, Reliable & Transparent <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Parcel Delivery
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            Book island-wide deliveries, track status in real-time, automate merchant e-commerce dispatches via secured APIs, and empower couriers on the go.
          </p>

          {/* Quick Tracking Search Bar */}
          <div className="mt-10 max-w-xl mx-auto">
            <form onSubmit={handleTrack} className="flex shadow-xl shadow-blue-500/10 rounded-2xl overflow-hidden border-2 border-blue-500 bg-white p-1.5 focus-within:ring-4 focus-within:ring-blue-500/20 transition">
              <div className="flex items-center pl-3 flex-1">
                <Search className="w-5 h-5 text-slate-400 mr-2" />
                <input
                  type="text"
                  placeholder="Enter tracking number (e.g. SD...)"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full text-slate-900 placeholder-slate-400 focus:outline-none text-base font-medium font-mono"
                  required
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center space-x-2"
              >
                <span>Track</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <p className="mt-8 text-sm text-slate-500">Authentication is available. Delivery operations and tracking are coming in a later milestone.</p>
        </div>
      </section>

      {/* 4 Actors / Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">Built for the Entire Courier Ecosystem</h2>
          <p className="text-slate-500 mt-2">Every stakeholder has dedicated capabilities designed for speed and clarity.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Customer */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Customers</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Instant fee calculator</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Live WebSocket tracking</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Download PDF receipts</span>
              </li>
            </ul>
          </div>

          {/* Merchant */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Merchants (B2B)</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Secured REST API & keys</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Webhooks with retry</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Order management portal</span>
              </li>
            </ul>
          </div>

          {/* Courier */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Couriers</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Daily assigned deliveries</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Photo proof & notes</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Failed delivery logging</span>
              </li>
            </ul>
          </div>

          {/* Dispatcher/Admin */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Dispatchers & Admin</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Smart courier dispatching</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Workload balancing</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Pricing zones & reports</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
