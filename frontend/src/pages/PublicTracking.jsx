import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MapPin, Clock, PackageSearch, Radio } from 'lucide-react';
import { TrackingSearch } from '../components/PublicWebsite';
import { PageHeader, Button, EmptyState, ErrorState, LoadingSkeleton } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';
import {
  publicServices,
  normalizeTrackingNumber,
  validTrackingNumber,
  getTrackingStreamUrl
} from '../api/publicServices';

const demoParcel = {
  trackingNumber: 'DEMO-ONLY',
  status: 'IN_TRANSIT',
  originCity: 'Colombo',
  destinationCity: 'Kandy',
  updatedAt: '2026-01-15T10:00:00Z',
  events: [
    { status: 'CREATED', timestamp: '2026-01-15T08:00:00Z', city: 'Colombo' },
    { status: 'PICKED_UP', timestamp: '2026-01-15T09:00:00Z', city: 'Colombo' },
    { status: 'IN_TRANSIT', timestamp: '2026-01-15T10:00:00Z', city: 'Colombo Central Hub' },
  ]
};

const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not provided';

export function PublicTrackingResult({ parcel, demonstration = false, isLive = false }) {
  // Render only this explicit public projection. Never spread an API object or show
  // names, addresses, phone numbers, courier details or free-text internal notes.
  return (
    <article className="ui-card space-y-6 p-5 sm:p-8" aria-label={demonstration ? 'Demonstration tracking result' : 'Tracking result'}>
      {demonstration && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          Demonstration only — not a real shipment or a live lookup.
        </p>
      )}

      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tracking number</p>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync Active
              </span>
            )}
          </div>
          <h2 className="mt-2 break-all font-mono text-xl font-bold tracking-wider text-slate-900">{parcel.trackingNumber}</h2>
        </div>
        <div>
          <StatusBadge status={parcel.status} />
        </div>
      </div>

      <dl className="grid gap-5 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <MapPin size={16} /> Pickup city
          </dt>
          <dd className="mt-2 font-medium text-slate-900">{parcel.originCity || 'Not provided'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Delivery city</dt>
          <dd className="mt-2 font-medium text-slate-900">{parcel.destinationCity || 'Not provided'}</dd>
        </div>
        {parcel.estimatedDelivery && (
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Estimated delivery</dt>
            <dd className="mt-2 font-medium text-slate-900">{date(parcel.estimatedDelivery)}</dd>
          </div>
        )}
      </dl>

      <div>
        <h3 className="mb-5 text-lg font-bold text-slate-900">Delivery progress</h3>
        {parcel.events?.length ? (
          <ol className="space-y-0" aria-label="Parcel event timeline">
            {parcel.events.map((event, index) => (
              <li className="relative flex gap-4 pb-6 last:pb-0" key={index}>
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <Clock size={16} aria-hidden="true" />
                  {index < parcel.events.length - 1 && (
                    <span className="absolute left-1/2 top-8 h-full border-l border-blue-200" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <StatusBadge status={event.status} />
                  <p className="mt-2 text-sm text-slate-600">{event.city || event.description || 'Location not provided'}</p>
                  <p className="mt-1 text-xs text-slate-500">{date(event.timestamp)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">No public tracking events supplied.</p>
        )}
      </div>

      <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">
        Last updated: {date(parcel.updatedAt)}. Public tracking shows city-level information only.
      </p>
    </article>
  );
}

export const PublicTracking = () => {
  const { trackingNumber } = useParams();
  const navigate = useNavigate();
  const generation = useRef(0);
  const [state, setState] = useState({ kind: 'idle' });
  const [example, setExample] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);

  const load = useCallback(async raw => {
    const operation = ++generation.current;
    setExample(false);
    setLiveConnected(false);

    if (!validTrackingNumber(raw)) {
      setState({ kind: 'invalid' });
      return;
    }

    setState({ kind: 'loading' });
    try {
      const parcel = await publicServices.track(normalizeTrackingNumber(raw));
      if (operation === generation.current) {
        setState(parcel ? { kind: 'result', parcel } : { kind: 'not-found' });
      }
    } catch (error) {
      if (operation === generation.current) {
        setState({ kind: ['unavailable', 'not-found'].includes(error.kind) ? error.kind : 'network' });
      }
    }
  }, []);

  useEffect(() => {
    if (trackingNumber) {
      load(trackingNumber);
    } else {
      setState({ kind: 'idle' });
      setExample(false);
      setLiveConnected(false);
    }
    return () => {
      generation.current++;
    };
  }, [trackingNumber, load]);

  // Real-Time Push Stream via Server-Sent Events (SSE)
  useEffect(() => {
    if (state.kind !== 'result' || !state.parcel?.trackingNumber || state.parcel.trackingNumber === 'DEMO-ONLY') {
      return;
    }

    const streamUrl = getTrackingStreamUrl(state.parcel.trackingNumber);
    let eventSource = null;

    try {
      eventSource = new EventSource(streamUrl);

      eventSource.addEventListener('connected', () => {
        setLiveConnected(true);
      });

      eventSource.addEventListener('status_update', (event) => {
        try {
          const updatedParcel = JSON.parse(event.data);
          setState(prev => prev.kind === 'result' ? { ...prev, parcel: updatedParcel } : prev);
          setLiveConnected(true);
        } catch (err) {
          console.error('Failed to parse live tracking update', err);
        }
      });

      eventSource.onerror = () => {
        setLiveConnected(false);
      };
    } catch (err) {
      setLiveConnected(false);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      setLiveConnected(false);
    };
  }, [state.kind, state.parcel?.trackingNumber]);

  return (
    <section className="public-container max-w-4xl space-y-7 py-10 sm:py-14">
      <PageHeader
        title="Track your parcel"
        description="Enter the reference supplied with your delivery. Public tracking keeps personal contact details private."
      />

      <div className="ui-card p-5">
        <TrackingSearch
          key={trackingNumber || 'search'}
          initialValue={trackingNumber || ''}
          busy={state.kind === 'loading'}
          onSearch={code => (code === trackingNumber ? load(code) : navigate(`/track/${encodeURIComponent(code)}`))}
        />
      </div>

      {state.kind === 'idle' && (
        <EmptyState
          title="Your parcel journey, in one place"
          description="Enter your tracking number (e.g. SWIFT-1001-LK) above to track your parcel live."
        />
      )}

      {state.kind === 'loading' && <LoadingSkeleton label="Looking up your parcel..." />}
      {state.kind === 'invalid' && <ErrorState message="This tracking reference is invalid. Enter 4–64 letters, numbers or hyphens." />}
      {state.kind === 'unavailable' && (
        <EmptyState
          title="Tracking is not connected yet"
          description="No parcel lookup was performed. Live status, delivery dates and tracking events will appear when the tracking service is available."
          action={<Link className="ui-button ui-button-secondary" to="/help">Tracking help</Link>}
        />
      )}
      {state.kind === 'not-found' && (
        <EmptyState
          title="No parcel found"
          description="Check the reference you were given and try again. Try example: SWIFT-1001-LK."
        />
      )}
      {state.kind === 'network' && (
        <ErrorState
          message="Tracking service could not be reached. Check your connection or local service status."
          onRetry={() => load(trackingNumber)}
        />
      )}

      {state.kind === 'result' && (
        <PublicTrackingResult parcel={state.parcel} isLive={liveConnected} />
      )}

      <div className="rounded-xl border border-dashed border-slate-300 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-slate-800">Want to test sample tracking references?</p>
            <p className="text-xs text-slate-500">Try pre-seeded reference <span className="font-mono font-semibold text-blue-600">SWIFT-1001-LK</span> or <span className="font-mono font-semibold text-blue-600">SWIFT-1002-LK</span>.</p>
          </div>
          <Button variant="secondary" onClick={() => setExample(!example)}>
            {example ? 'Hide example' : 'View demonstration'}
          </Button>
        </div>
      </div>

      {example && <PublicTrackingResult parcel={demoParcel} demonstration />}

      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <PackageSearch size={18} className="shrink-0 text-slate-400" />
        We never show recipient addresses, phone numbers or private delivery notes on public tracking.
      </p>
    </section>
  );
};
