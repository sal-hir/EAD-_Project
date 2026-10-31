import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Truck } from 'lucide-react';

export const MilestoneUnavailable = ({ title = 'Delivery operations' }) => {
  const { user } = useAuth();
  return (
    <section className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <Truck className="w-10 h-10 text-blue-600 mb-4" />
        <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        {user && <p className="mt-3 text-slate-700">Signed in as {user.name} ({user.role}).</p>}
        <p className="mt-3 text-slate-600" role="status">Coming soon. Authentication is available in this submission. Parcel bookings, tracking, merchant onboarding, courier assignments and administration will become available as their services are migrated.</p>
      </div>
    </section>
  );
};
