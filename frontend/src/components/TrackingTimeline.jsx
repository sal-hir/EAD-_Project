import React from 'react';
import { CheckCircle2, Clock, Truck, PackageCheck, AlertTriangle } from 'lucide-react';

const STEPS = [
  { key: 'CREATED', label: 'Order Confirmed', icon: Clock },
  { key: 'PENDING_PICKUP', label: 'Courier Assigned', icon: Clock },
  { key: 'PICKED_UP', label: 'Picked Up', icon: Truck },
  { key: 'IN_TRANSIT', label: 'In Transit', icon: Truck },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: PackageCheck },
];

export const TrackingTimeline = ({ status, history = [] }) => {
  const isFailed = status === 'FAILED';
  const isCancelled = status === 'CANCELLED';

  const getStepIndex = (st) => STEPS.findIndex((s) => s.key === st);
  const currentStepIndex = getStepIndex(status);

  // Map history events by status
  const historyMap = history.reduce((acc, item) => {
    acc[item.status] = item;
    return acc;
  }, {});

  return (
    <div className="py-6">
      {/* Alert banner if Failed or Cancelled */}
      {isFailed && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-rose-900">Delivery Attempt Failed</h4>
            <p className="text-xs text-rose-700 mt-0.5">
              {historyMap.FAILED?.failureReason || historyMap.FAILED?.note || 'Our courier could not complete the delivery. We will contact you shortly.'}
            </p>
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="mb-6 p-4 bg-slate-100 border border-slate-300 rounded-xl flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-slate-900">Delivery Cancelled</h4>
            <p className="text-xs text-slate-700 mt-0.5">
              {historyMap.CANCELLED?.note || 'This parcel delivery order was cancelled.'}
            </p>
          </div>
        </div>
      )}

      {/* Stepper Timeline */}
      <div className="relative">
        <div className="overflow-hidden">
          <ul className="relative space-y-6">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isPast = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex && !isFailed && !isCancelled;
              const historyItem = historyMap[step.key];

              return (
                <li key={step.key} className="relative flex items-start">
                  {/* Connecting line */}
                  {index < STEPS.length - 1 && (
                    <div
                      className={`absolute left-4 top-8 -ml-px w-0.5 h-full ${
                        index < currentStepIndex ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                      aria-hidden="true"
                    />
                  )}

                  {/* Icon Node */}
                  <div className="relative flex items-center justify-center">
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white ${
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/40 animate-pulse'
                          : isPast
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isPast && !isCurrent ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </span>
                  </div>

                  {/* Label & Details */}
                  <div className="ml-4 min-w-0 flex-1">
                    <div className="flex justify-between items-baseline">
                      <p
                        className={`text-sm font-semibold ${
                          isCurrent
                            ? 'text-blue-600 font-bold'
                            : isPast
                            ? 'text-slate-900'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </p>
                      {historyItem && (
                        <span className="text-xs text-slate-400">
                          {new Date(historyItem.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </div>
                    {historyItem?.note && (
                      <p className="text-xs text-slate-500 mt-0.5">{historyItem.note}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};
