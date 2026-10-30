'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock,
  Container,
  Download,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Warehouse,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { displayValue, formatDate } from '@/lib/format';
import type { EnrichedShipment } from '@/lib/types';

export default function ShipmentsRosterPage() {
  const [shipments, setShipments] = useState<EnrichedShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  async function loadShipments() {
    setLoading(true);
    try {
      const res = await fetch('/api/shipments/enriched', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setShipments(data.shipments || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShipments();
  }, []);

  const filtered = shipments.filter((item) => {
    const { shipment: s, tracking: t } = item;
    const q = query.toLowerCase().trim();
    const matchesQuery =
      !q ||
      s.shipmentId.toLowerCase().includes(q) ||
      s.trackingNumber.toLowerCase().includes(q) ||
      s.carrierName.toLowerCase().includes(q) ||
      (s.origin && s.origin.toLowerCase().includes(q)) ||
      (s.destination && s.destination.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'DELAYED' && (item.sla?.isBreached || t?.currentStatus === 'DELAYED')) ||
      (statusFilter === 'CUSTOMS' && t?.currentStatus === 'CUSTOMS_HOLD') ||
      (statusFilter === 'IN_TRANSIT' && t?.currentStatus === 'IN_TRANSIT') ||
      (statusFilter === 'DELIVERED' && t?.currentStatus === 'DELIVERED');

    return matchesQuery && matchesStatus;
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> CENTRAL SHIPMENT REGISTRY
          </div>
          <h1>
            Shipments Roster<span className="heading-period">.</span>
          </h1>
          <p>
            Unified inventory of imported freight, carrier observations, SLA compliance, and terminal allocations.
          </p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button button-secondary" onClick={loadShipments} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <a href="/api/manifest/export?format=xlsx" className="button button-secondary">
            <Download size={16} /> Enriched Excel
          </a>
          <Link href="/batch" className="button button-primary">
            <Upload size={16} /> Import Manifest
          </Link>
        </div>
      </div>

      <section className="content-panel">
        <div className="manifest-table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search shipment ID, container reference, carrier, port…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="filter-group-inline">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELAYED">Delayed / SLA Breached</option>
              <option value="CUSTOMS">Customs Hold</option>
              <option value="DELIVERED">Delivered</option>
            </select>
            <span className="count-pill">{filtered.length} Shipments</span>
          </div>
        </div>

        {loading ? (
          <div className="map-empty-state">
            <LoaderCircle size={28} className="spin" />
            <p>Loading shipment records from persistent storage…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="map-empty-state">
            <Container size={36} className="empty-icon-subtle" />
            <h3>No Shipments Found</h3>
            <p>Upload a shipment manifest or run a manual lookup to track active shipments.</p>
            <div className="empty-state-actions">
              <Link href="/batch" className="button button-primary">
                <Upload size={16} /> Go to Manifest Upload
              </Link>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shipment / Carrier</th>
                  <th>Current Status</th>
                  <th>Current Location</th>
                  <th>Live vs Promised ETA</th>
                  <th>SLA / Demurrage Risk</th>
                  <th>Assigned Dock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const { shipment: s, tracking: t, sla, demurrage, booking } = item;

                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="table-carrier">{s.shipmentId}</div>
                        <div className="table-reference">
                          <code>{s.trackingNumber}</code>
                        </div>
                        <div className="table-sub-carrier">{s.carrierName}</div>
                      </td>
                      <td>
                        <StatusBadge status={t?.lookupStatus || 'pending'} />
                        {t?.currentStatus && (
                          <div className="table-secondary">{t.currentStatus}</div>
                        )}
                      </td>
                      <td>
                        <strong>{t?.currentLocation || s.origin || 'In Transit'}</strong>
                        <div className="table-secondary">
                          {s.origin || 'Origin'} → {s.destination || 'Destination'}
                        </div>
                      </td>
                      <td>
                        {t?.liveEta ? (
                          <div>
                            <span className="live-eta-val">{formatDate(t.liveEta)}</span>
                            {sla?.isBreached && (
                              <div className="delay-badge-sm">
                                <AlertTriangle size={11} /> +{sla.delayHours}h delay
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="table-secondary">Pending live check</span>
                        )}
                        {s.promisedEta && (
                          <div className="table-secondary">Promised: {formatDate(s.promisedEta)}</div>
                        )}
                      </td>
                      <td>
                        {sla?.isBreached ? (
                          <div className="risk-pill-danger">
                            <span>SLA Breached ({sla.riskLevel})</span>
                          </div>
                        ) : sla?.isAtRisk ? (
                          <div className="risk-pill-warning">
                            <span>At Risk ({sla.riskLevel})</span>
                          </div>
                        ) : (
                          <span className="table-secondary">On schedule</span>
                        )}
                        {demurrage && demurrage.totalExposure > 0 && (
                          <div className="demurrage-exp-tag">
                            {demurrage.currency} {demurrage.totalExposure}
                          </div>
                        )}
                      </td>
                      <td>
                        {booking ? (
                          <div className="dock-cell-confirmed">
                            <strong>{booking.dockId}</strong>
                            <div className="table-secondary">{booking.confirmationId}</div>
                          </div>
                        ) : s.assignedDock ? (
                          <span>{s.assignedDock}</span>
                        ) : (
                          <span className="table-secondary">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions-inline">
                          <Link
                            href={`/agent-console?shipmentId=${s.id}`}
                            className="row-link-btn"
                            title="Inspect Agent Run"
                          >
                            <Bot size={14} />
                          </Link>
                          <Link
                            href="/live-map"
                            className="row-link-btn"
                            title="Locate on Map"
                          >
                            <Globe2 size={14} />
                          </Link>
                          {t?.sourceUrl && (
                            <a
                              href={t.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="row-link-btn"
                              title="Carrier Portal"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
