'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, CircleAlert, ExternalLink, LoaderCircle, MapPin, Search, Ship, Sparkles } from 'lucide-react';
import { CARRIERS } from '@/lib/carriers';
import type { CarrierId, ShipmentResult, TrackApiResponse } from '@/lib/types';
import { displayValue, formatDateOnly, formatDate } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';

export default function TrackForm({ onResult, compact = false }: {
  onResult?: (result: ShipmentResult) => void;
  compact?: boolean;
}) {
  const [carrier, setCarrier] = useState<CarrierId>('maersk');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ShipmentResult | null>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('carrier');
    if (requested && CARRIERS.some((item) => item.id === requested)) setCarrier(requested as CarrierId);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch('/api/shipments/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, trackingNumber: trackingNumber.trim() }),
      });
      const payload = await response.json() as TrackApiResponse;
      if (payload.result) {
        setResult(payload.result);
        onResult?.(payload.result);
      } else {
        setError(payload.error ?? 'The tracking request could not be completed.');
      }
    } catch {
      setError('Could not reach the application backend. Check that the dev server is running and try again.');
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setTrackingNumber('');
    setError('');
    setResult(null);
  }

  return <div className={`track-panel ${compact ? 'track-panel-compact' : ''}`}>
    <div className="panel-heading">
      <div><div className="eyebrow"><span className="eyebrow-line" /> LIVE CARRIER LOOKUP</div><h2>{compact ? 'Track a shipment' : 'Investigate a shipment'}</h2><p>Retrieve publicly available tracking information from the carrier&apos;s official website.</p></div>
      <div className="panel-heading-icon"><Search size={20} /></div>
    </div>
    <form className="tracking-form" onSubmit={submit}>
      <label className="form-field"><span>Shipping carrier</span><div className="select-wrap"><Ship size={16} /><select value={carrier} onChange={(event) => setCarrier(event.target.value as CarrierId)}>{CARRIERS.map((item) => <option key={item.id} value={item.id}>{item.name}{item.integrationStatus === 'candidate' ? ' · candidate' : ' · priority'}</option>)}</select></div><small>{CARRIERS.find((item) => item.id === carrier)?.referenceHint}</small></label>
      <label className="form-field tracking-reference-field"><span>Container / Bill of Lading reference</span><input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} minLength={3} maxLength={80} placeholder="Enter your shipment reference" autoComplete="off" required /><small>Use a valid reference you are authorized to access.</small></label>
      <div className="form-actions"><button className="button button-primary" type="submit" disabled={loading || trackingNumber.trim().length < 3}>{loading ? <><LoaderCircle className="spin" size={17} /> Checking carrier…</> : <><Search size={17} /> Track shipment <ArrowUpRight size={16} /></>}</button><button className="button button-secondary" type="button" onClick={clear} disabled={loading}>Clear</button></div>
    </form>
    {loading && <div className="lookup-progress"><span className="progress-spinner"><LoaderCircle className="spin" size={19} /></span><div><strong>Live lookup in progress</strong><p>TinyFish is investigating the official carrier page. This can take some time and may fail if the carrier restricts access.</p></div><span className="progress-pulse" /></div>}
    {error && <div className="inline-alert inline-alert-error"><CircleAlert size={18} /><div><strong>Lookup could not be completed</strong><p>{error}</p>{error.includes('TINYFISH_API_KEY') && <span>Add the key to <code>.env.local</code> and restart the dev server.</span>}</div></div>}
    {result && <ResultCard result={result} />}
    {!result && !error && !loading && <div className="lookup-hint"><Sparkles size={16} /><span>Results are fetched on demand. No shipment data is invented or pre-filled.</span></div>}
  </div>;
}

function ResultCard({ result }: { result: ShipmentResult }) {
  const delivered = /delivered|completed/i.test(result.status ?? '');
  return <section className="result-card" aria-live="polite">
    <div className="result-header"><div><div className="eyebrow">LOOKUP RESULT</div><h3>{result.carrierName} <span className="result-reference">/ {result.trackingNumber}</span></h3></div><StatusBadge status={result.lookupStatus} /></div>
    {result.lookupStatus === 'success' ? <>
      <div className={`result-status-block ${delivered ? 'result-status-green' : ''}`}><div className="result-status-icon">{delivered ? <CheckCircle2 size={22} /> : <Ship size={22} />}</div><div><span className="result-label">LATEST REPORTED STATUS</span><strong>{displayValue(result.status)}</strong><p>{displayValue(result.latestEvent)}</p></div></div>
      <div className="result-facts"><div className="result-fact"><MapPin size={16} /><div><span>Latest event location</span><strong>{displayValue(result.location)}</strong></div></div><div className="result-fact"><CalendarClock size={16} /><div><span>Estimated arrival</span><strong>{formatDateOnly(result.estimatedArrival)}</strong></div></div><div className="result-fact"><CalendarClock size={16} /><div><span>Last recorded event</span><strong>{formatDate(result.eventDate)}</strong></div></div><div className="result-fact"><Ship size={16} /><div><span>Route</span><strong>{displayValue(result.origin)} → {displayValue(result.destination)}</strong></div></div></div>
      {result.milestones.length > 0 && <div className="milestone-section"><h4>Shipment milestones</h4><div className="milestone-list">{result.milestones.map((item, index) => <div key={`${item.description}-${index}`} className="milestone-item"><span className="milestone-dot" /><div><strong>{item.description}</strong><p>{[item.location, item.eventDate].filter(Boolean).join(' · ') || 'Additional details unavailable'}</p></div></div>)}</div></div>}
    </> : <div className="lookup-outcome-note"><AlertTriangle size={18} /><div><strong>{result.lookupStatus === 'not_found' ? 'No matching shipment was returned' : result.lookupStatus === 'needs_login' ? 'The carrier requires additional access' : result.lookupStatus === 'blocked' ? 'The carrier restricted automated access' : 'The lookup did not return usable tracking details'}</strong><p>Open the official tracking page to verify the reference or try another supported carrier. No result has been fabricated.</p></div></div>}
    {result.warnings.length > 0 && <div className="warnings-list">{result.warnings.map((warning) => <div className="warning-row" key={warning}><AlertTriangle size={15} /><span>{warning}</span></div>)}</div>}
    <div className="result-footer"><span>Retrieved {formatDate(result.retrievedAt)}</span><a className="source-link" href={result.sourceUrl} target="_blank" rel="noreferrer">Open official source <ExternalLink size={14} /></a></div>
  </section>;
}
