'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, Container, Plus, RadioTower } from 'lucide-react';
import TrackForm from '@/components/TrackForm';
import ShipmentTable from '@/components/ShipmentTable';
import StatCard from '@/components/StatCard';
import { useShipmentHistory } from '@/lib/useShipmentHistory';
import type { ShipmentResult } from '@/lib/types';

export default function DashboardPage() {
  const { history, addResult, removeResult } = useShipmentHistory();
  const successful = history.filter((item) => item.lookupStatus === 'success').length;
  const alerts = history.filter((item) => item.warnings.length > 0 || ['blocked', 'needs_login', 'not_found', 'error'].includes(item.lookupStatus)).length;
  const carriers = new Set(history.map((item) => item.carrier)).size;
  const recent = history.slice(0, 6);

  async function refresh(item: ShipmentResult) {
    try {
      const response = await fetch('/api/shipments/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carrier: item.carrier, trackingNumber: item.trackingNumber }) });
      const body = await response.json() as { result?: ShipmentResult };
      if (body.result) addResult(body.result);
    } catch { /* refresh failures are visible in the history's timestamp; the user can open the source */ }
  }

  return <>
    <div className="page-heading page-heading-dashboard"><div><div className="eyebrow"><span className="eyebrow-line" /> OPERATIONS OVERVIEW</div><h1>Good to see you, team<span className="heading-period">.</span></h1><p>Your shipment visibility desk. Run live checks and keep the important exceptions in view.</p></div><div className="heading-actions"><Link className="button button-primary" href="/track"><Plus size={17} /> New tracking lookup</Link></div></div>

    <div className="stats-grid">
      <StatCard label="Total lookups" value={history.length} note="Saved in this browser" icon={Container} tone="neutral" />
      <StatCard label="Successful lookups" value={successful} note={history.length ? `${Math.round(successful / history.length * 100)}% of saved results` : 'No completed lookups yet'} icon={CheckCircle2} tone="green" />
      <StatCard label="Needs attention" value={alerts} note="Warnings or unsuccessful lookups" icon={AlertTriangle} tone="amber" />
      <StatCard label="Carriers searched" value={carriers} note="Distinct carriers in history" icon={RadioTower} tone="neutral" />
    </div>

    <div className="dashboard-main-grid">
      <div className="dashboard-main-column"><TrackForm onResult={addResult} compact /><section className="content-panel recent-panel"><div className="section-heading"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>Shipment lookups</h2><p>Latest observations retrieved from carrier websites.</p></div><Link className="text-link" href="/history">View history <ArrowRight size={15} /></Link></div><ShipmentTable items={recent} onRefresh={refresh} onRemove={(id) => { if (window.confirm("Remove this observation from local history?")) removeResult(id); }} /></section></div>
      <aside className="dashboard-side-column">
        <section className="side-card"><div className="side-card-heading"><span className="side-card-icon amber-icon"><Activity size={18} /></span><span className="side-card-overline">WORKFLOW</span></div><h3>From tracking to clarity.</h3><p>Run a lookup against a real carrier site, review the latest reported event, and keep the source one click away.</p><div className="workflow-steps"><div className="workflow-step"><span>01</span><div><strong>Choose carrier</strong><p>Use its official tracking page.</p></div></div><div className="workflow-step"><span>02</span><div><strong>Retrieve evidence</strong><p>TinyFish checks the public page.</p></div></div><div className="workflow-step"><span>03</span><div><strong>Review result</strong><p>Verify details at the source.</p></div></div></div><Link className="button button-secondary button-full" href="/track">Start a lookup <ArrowRight size={16} /></Link></section>
        <section className="side-card subtle-side-card"><div className="side-card-heading"><span className="side-card-icon green-icon"><Clock3 size={18} /></span><span className="side-card-overline">DATA NOTE</span></div><h3>Observe, don't assume.</h3><p>Tracking is a snapshot from the carrier at the time of retrieval. A missing event or an old timestamp is not automatically proof of a delay.</p><div className="side-note"><span className="live-dot" /> Every saved observation includes a retrieval timestamp.</div></section>
      </aside>
    </div>
  </>;
}
