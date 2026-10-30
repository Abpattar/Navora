'use client';

import { useMemo, useState } from 'react';
import { ArrowDownToLine, CircleHelp, Search, Trash2 } from 'lucide-react';
import ShipmentTable from '@/components/ShipmentTable';
import { CARRIERS } from '@/lib/carriers';
import { exportToCsv } from '@/lib/storage';
import { useShipmentHistory } from '@/lib/useShipmentHistory';
import type { ShipmentResult } from '@/lib/types';

export default function HistoryPage() {
  const { history, removeResult, clearHistory, addResult } = useShipmentHistory();
  const [query, setQuery] = useState('');
  const [carrier, setCarrier] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const filtered = useMemo(() => history.filter((item) => {
    const matchesQuery = `${item.trackingNumber} ${item.carrierName} ${item.status ?? ''}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (carrier === 'all' || item.carrier === carrier) && (outcome === 'all' || item.lookupStatus === outcome);
  }), [history, query, carrier, outcome]);

  async function refresh(item: ShipmentResult) {
    try {
      const response = await fetch('/api/shipments/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carrier: item.carrier, trackingNumber: item.trackingNumber }) });
      const body = await response.json() as { result?: ShipmentResult; error?: string };
      if (body.result) addResult(body.result);
      else window.alert(body.error ?? 'Refresh failed.');
    } catch { window.alert('Could not reach the backend.'); }
  }

  function clear() {
    if (window.confirm('Clear all locally saved shipment history from this browser? This cannot be undone.')) clearHistory();
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> LOCAL OBSERVATION LOG</div><h1>Tracking history<span className="heading-period">.</span></h1><p>Review prior observations. Saved results are snapshots, not automatically refreshed current status.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={() => exportToCsv(filtered)} disabled={!filtered.length}><ArrowDownToLine size={16} /> Export CSV</button><button className="button button-danger" onClick={clear} disabled={!history.length}><Trash2 size={16} /> Clear history</button></div></div>
    <section className="content-panel history-panel"><div className="history-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search carrier, status, or reference" aria-label="Search history" /></div><select value={carrier} onChange={(event) => setCarrier(event.target.value)} aria-label="Filter by carrier"><option value="all">All carriers</option>{CARRIERS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={outcome} onChange={(event) => setOutcome(event.target.value)} aria-label="Filter by outcome"><option value="all">All outcomes</option><option value="success">Retrieved</option><option value="not_found">Not found</option><option value="needs_login">Login required</option><option value="blocked">Restricted</option><option value="error">Error</option></select><span className="count-pill">{filtered.length} results</span></div>
      <ShipmentTable items={filtered} onRefresh={refresh} onRemove={(id) => { if (window.confirm('Remove this observation from local history?')) removeResult(id); }} emptyTitle={history.length ? 'No matching observations' : 'History is empty'} emptyCopy={history.length ? 'Try changing the search or filters.' : 'Your real carrier lookups will appear here after you run a search.'} />
      <div className="note-strip"><CircleHelp size={16} /><span>History is stored in this browser&apos;s localStorage and is not shared automatically with teammates. Each teammate must run their own lookups unless a shared database is added.</span></div>
    </section>
  </>;
}
