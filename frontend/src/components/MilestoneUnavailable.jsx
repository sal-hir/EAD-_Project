import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Truck } from 'lucide-react';
import { PageHeader } from './ui';

export const MilestoneUnavailable = ({ title = 'Delivery operations' }) => {
  const { user } = useAuth();
  return (
    <section className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <Truck className="w-10 h-10 text-blue-600 mb-4" />
        <PageHeader title={title} />
        {user && <p className="mt-3 text-slate-700">Signed in as {user.name} ({user.role}).</p>}
        <p className="mt-3 text-slate-600" role="status">Coming soon. Account management and merchant onboarding are available. Parcel bookings, tracking, courier assignments and dispatch operations will become available as their services are implemented.</p>
      </div>
    </section>
  );
};
