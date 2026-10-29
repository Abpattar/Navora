'use client';

import { ArrowUpRight, CalendarClock, Copy, ExternalLink, Eye, MapPin, RefreshCw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { ShipmentResult } from '@/lib/types';
import { displayValue, formatDate, formatDateOnly } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';

export default function ShipmentTable({
  items,
  onRefresh,
  onRemove,
  emptyTitle = 'No shipment lookups yet',
  emptyCopy = 'Run a live tracking lookup to see shipment information here.',
}: {
  items: ShipmentResult[];
  onRefresh?: (item: ShipmentResult) => void;
  onRemove?: (id: string) => void;
  emptyTitle?: string;
  emptyCopy?: string;
}) {
  const [selected, setSelected] = useState<ShipmentResult | null>(null);

  async function copyReference(reference: string) {
    try { await navigator.clipboard.writeText(reference); } catch { /* clipboard may be unavailable */ }
  }

  if (!items.length) return <div className="empty-state"><div className="empty-icon"><ArrowUpRight size={22} /></div><p className="empty-title">{emptyTitle}</p><p className="empty-copy">{emptyCopy}</p></div>;

  return <><div className="table-scroll"><table className="data-table">
    <thead><tr><th>Carrier / reference</th><th>Latest status</th><th>Location</th><th>Est. arrival</th><th>Last checked</th><th className="action-heading">Actions</th></tr></thead>
    <tbody>{items.map((item) => <tr key={item.id}>
      <td><div className="table-carrier">{item.carrierName}</div><div className="table-reference">{item.trackingNumber}</div></td>
      <td><StatusBadge status={item.lookupStatus} /><div className="table-secondary">{displayValue(item.latestEvent)}</div></td>
      <td><span className="table-primary">{displayValue(item.location)}</span><div className="table-secondary">{item.eventDate ? formatDateOnly(item.eventDate) : 'Latest event date unavailable'}</div></td>
      <td><span className="table-primary">{formatDateOnly(item.estimatedArrival)}</span></td>
      <td><span className="table-primary">{formatDate(item.retrievedAt)}</span></td>
      <td><div className="row-actions">
        <button className="row-action" onClick={() => setSelected(item)} title="View details" aria-label="View details"><Eye size={15} /></button>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="row-action" title="Open official tracking source" aria-label="Open source"><ExternalLink size={15} /></a>
        <button className="row-action" onClick={() => void copyReference(item.trackingNumber)} title="Copy reference" aria-label="Copy reference"><Copy size={15} /></button>
        {onRefresh && <button className="row-action" onClick={() => onRefresh(item)} title="Refresh lookup" aria-label="Refresh lookup"><RefreshCw size={15} /></button>}
        {onRemove && <button className="row-action danger-action" onClick={() => onRemove(item.id)} title="Remove from history" aria-label="Remove from history"><Trash2 size={15} /></button>}
      </div></td>
    </tr>)}</tbody>
  </table></div>
    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="shipment-modal" role="dialog" aria-modal="true" aria-labelledby="shipment-modal-title"><div className="modal-header"><div><div className="eyebrow">SAVED OBSERVATION</div><h2 id="shipment-modal-title">{selected.carrierName} <span className="result-reference">/ {selected.trackingNumber}</span></h2></div><button className="row-action" onClick={() => setSelected(null)} aria-label="Close details"><X size={18} /></button></div><div className="modal-body"><div className="modal-status-line"><StatusBadge status={selected.lookupStatus} /><span>Retrieved {formatDate(selected.retrievedAt)}</span></div><div className="result-facts modal-facts"><div className="result-fact"><MapPin size={16} /><div><span>Latest event location</span><strong>{displayValue(selected.location)}</strong></div></div><div className="result-fact"><CalendarClock size={16} /><div><span>Estimated arrival</span><strong>{formatDateOnly(selected.estimatedArrival)}</strong></div></div><div className="result-fact"><div><span>Latest status</span><strong>{displayValue(selected.status)}</strong></div></div><div className="result-fact"><div><span>Latest event</span><strong>{displayValue(selected.latestEvent)}</strong></div></div><div className="result-fact"><div><span>Origin → destination</span><strong>{displayValue(selected.origin)} → {displayValue(selected.destination)}</strong></div></div></div>{selected.warnings.length > 0 && <div className="warnings-list modal-warnings">{selected.warnings.map((warning) => <div className="warning-row" key={warning}><span>{warning}</span></div>)}</div>}{selected.milestones.length > 0 && <div className="milestone-section"><h4>Milestones</h4><div className="milestone-list">{selected.milestones.map((item, index) => <div className="milestone-item" key={`${item.description}-${index}`}><span className="milestone-dot" /><div><strong>{item.description}</strong><p>{[item.location, item.eventDate].filter(Boolean).join(' · ') || 'Details unavailable'}</p></div></div>)}</div></div>}</div><div className="modal-footer"><button className="button button-secondary" onClick={() => setSelected(null)}>Close</button><a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="button button-primary">Verify at source <ExternalLink size={14} /></a></div></section></div>}
  </>;
}
