import React from 'react';
import { CheckCircle2, Clock, Truck, Package, XCircle, AlertCircle } from 'lucide-react';

const STATUS_CONFIG = {
  CREATED: {
    label: 'Order Placed',
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Package,
  },
  PENDING_PICKUP: {
    label: 'Pending Pickup',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock,
  },
  PICKED_UP: {
    label: 'Picked Up',
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Truck,
  },
  IN_TRANSIT: {
    label: 'In Transit',
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Truck,
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    bg: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: Truck,
  },
  DELIVERED: {
    label: 'Delivered',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  FAILED: {
    label: 'Delivery Failed',
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: AlertCircle,
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: XCircle,
  },
};

export const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || {
    label: status,
    bg: 'bg-gray-100 text-gray-700 border-gray-300',
    icon: Clock,
  };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
    </span>
  );
};
