'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AlertTriangle,
  Anchor,
  Clock,
  ExternalLink,
  Filter,
  LoaderCircle,
  MapPin,
  Search,
  ShieldAlert,
  Ship,
  X,
} from 'lucide-react';
import type { EnrichedShipment } from '@/lib/types';
import { CARRIERS } from '@/lib/carriers';

// Dynamically import MapClient to prevent SSR Leaflet errors
const DynamicMapClient = dynamic(() => import('./MapClient'), {
  ssr: false,
  loading: () => (
    <div className="map-loading-placeholder">
      <LoaderCircle className="spin" size={32} />
      <p>Initializing OpenStreetMap satellite lanes & coordinate engine…</p>
    </div>
  ),
});

interface ShipmentMapProps {
  shipments: EnrichedShipment[];
  initialSelectedId?: string | null;
}

export default function ShipmentMap({ shipments, initialSelectedId }: ShipmentMapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedShipment, setSelectedShipment] = useState<EnrichedShipment | null>(() => {
    if (initialSelectedId) {
      return shipments.find((s) => s.shipment.id === initialSelectedId) || null;
    }
    return null;
  });

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter((item) => {
      const { shipment: s, tracking: t } = item;
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !q ||
        s.shipmentId.toLowerCase().includes(q) ||
        s.trackingNumber.toLowerCase().includes(q) ||
        s.carrierName.toLowerCase().includes(q) ||
        (s.origin && s.origin.toLowerCase().includes(q)) ||
        (s.destination && s.destination.toLowerCase().includes(q)) ||
        (t?.currentLocation && t.currentLocation.toLowerCase().includes(q));

      const matchesCarrier = carrierFilter === 'ALL' || s.carrier === carrierFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'DELAYED' && (item.sla?.isBreached || t?.currentStatus === 'DELAYED')) ||
        (statusFilter === 'CUSTOMS' && t?.currentStatus === 'CUSTOMS_HOLD') ||
        (statusFilter === 'IN_TRANSIT' && t?.currentStatus === 'IN_TRANSIT') ||
        (statusFilter === 'ARRIVED' && t?.currentStatus === 'ARRIVED_AT_TERMINAL');

      return matchesSearch && matchesCarrier && matchesStatus;
    });
  }, [shipments, searchQuery, carrierFilter, statusFilter]);

  // Count shipments with unresolved coordinates
  const unresolvedLocations = useMemo(() => {
    return filteredShipments.filter((item) => {
      const hasOrigin = Boolean(item.originLocation?.latitude);
      const hasCurrent = Boolean(item.currentLocation?.latitude);
      const hasDest = Boolean(item.destinationLocation?.latitude);
      return !hasOrigin && !hasCurrent && !hasDest;
    });
  }, [filteredShipments]);

  return (
    <div className="shipment-map-shell">
      {/* Top Map Toolbar */}
      <div className="map-toolbar">
        <div className="map-search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search Shipment ID, container ref, port, city…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search map shipments"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="map-filter-group">
          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            aria-label="Filter by carrier"
          >
            <option value="ALL">All Carriers ({CARRIERS.length})</option>
            {CARRIERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELAYED">Delayed / SLA Breached</option>
            <option value="CUSTOMS">Customs Hold</option>
            <option value="ARRIVED">Arrived at Terminal</option>
          </select>

          <span className="map-count-badge">
            {filteredShipments.length} Active Shipments
          </span>
        </div>
      </div>

      {/* Unresolved Coordinates Warning Banner */}
      {unresolvedLocations.length > 0 && (
        <div className="unresolved-locations-notice">
          <ShieldAlert size={16} />
          <span>
            <strong>{unresolvedLocations.length} shipment(s)</strong> have unmapped port/city names
            ({unresolvedLocations.map((u) => u.shipment.shipmentId).slice(0, 3).join(', ')}
            {unresolvedLocations.length > 3 ? '…' : ''}). Coordinates are never guessed or fabricated.
          </span>
        </div>
      )}

      {/* Main Map + Side Drawer Layout */}
      <div className="map-main-area">
        <DynamicMapClient
          shipments={filteredShipments}
          selectedShipmentId={selectedShipment?.shipment.id}
          onSelectShipment={(item) => setSelectedShipment(item)}
        />

        {/* Selected Shipment Detail Side Panel */}
        {selectedShipment && (
          <aside className="map-detail-drawer">
            <div className="drawer-header">
              <div>
                <span className="drawer-sub">{selectedShipment.shipment.carrierName}</span>
                <h3>{selectedShipment.shipment.shipmentId}</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedShipment(null)}
                aria-label="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-section">
                <span className="drawer-label">Tracking / Container Reference</span>
                <div className="drawer-ref-pill">
                  <code>{selectedShipment.shipment.trackingNumber}</code>
                </div>
              </div>

              <div className="drawer-section">
                <span className="drawer-label">Transit Nodes</span>
                <div className="transit-flow">
                  <div className="transit-node">
                    <span className="node-marker node-green" />
                    <div>
                      <strong>Origin: {selectedShipment.shipment.origin || 'Unspecified'}</strong>
                      <span className="node-source">
                        {selectedShipment.originLocation?.source || 'No coordinates'}
                      </span>
                    </div>
                  </div>
                  <div className="transit-node">
                    <span className={`node-marker ${selectedShipment.sla?.isBreached ? 'node-red' : 'node-amber'}`} />
                    <div>
                      <strong>
                        Current: {selectedShipment.tracking?.currentLocation || 'In Transit'}
                      </strong>
                      <span className="node-source">
                        {selectedShipment.currentLocation?.source || 'No coordinates'}
                      </span>
                    </div>
                  </div>
                  <div className="transit-node">
                    <span className="node-marker node-blue" />
                    <div>
                      <strong>Destination: {selectedShipment.shipment.destination || 'Unspecified'}</strong>
                      <span className="node-source">
                        {selectedShipment.destinationLocation?.source || 'No coordinates'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedShipment.sla && (
                <div className={`drawer-alert ${selectedShipment.sla.isBreached ? 'drawer-alert-danger' : 'drawer-alert-ok'}`}>
                  <AlertTriangle size={16} />
                  <div>
                    <strong>SLA Status: {selectedShipment.sla.riskLevel}</strong>
                    <p>{selectedShipment.sla.reason}</p>
                  </div>
                </div>
              )}

              {selectedShipment.demurrage && selectedShipment.demurrage.totalExposure > 0 && (
                <div className="drawer-alert drawer-alert-amber">
                  <Clock size={16} />
                  <div>
                    <strong>Financial Exposure: {selectedShipment.demurrage.currency} {selectedShipment.demurrage.totalExposure}</strong>
                    <p>{selectedShipment.demurrage.notes}</p>
                  </div>
                </div>
              )}

              {selectedShipment.booking && (
                <div className="drawer-section">
                  <span className="drawer-label">Warehouse Reservation</span>
                  <div className="drawer-booking-card">
                    <div>
                      <strong>{selectedShipment.booking.dockId}</strong>
                      <p>{new Date(selectedShipment.booking.slotTime).toLocaleString()}</p>
                    </div>
                    <code>{selectedShipment.booking.confirmationId}</code>
                  </div>
                </div>
              )}

              <div className="drawer-actions">
                <Link
                  href={`/agent-console?shipmentId=${selectedShipment.shipment.id}`}
                  className="button button-primary button-full"
                >
                  Open Live Agent Inspector
                </Link>
                {selectedShipment.tracking?.sourceUrl && (
                  <a
                    href={selectedShipment.tracking.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-secondary button-full"
                  >
                    Open Carrier Portal <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
