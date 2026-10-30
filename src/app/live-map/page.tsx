'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe2, LoaderCircle, Plus, RefreshCw, Upload } from 'lucide-react';
import ShipmentMap from '@/components/map/ShipmentMap';
import type { EnrichedShipment } from '@/lib/types';

export default function LiveMapPage() {
  const [shipments, setShipments] = useState<EnrichedShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMapData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/shipments/enriched', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load shipment coordinates');
      }
      setShipments(data.shipments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not contact map endpoint');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMapData();
  }, []);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> GEOSPATIAL INTELLIGENCE
          </div>
          <h1>
            Global Live Container Map<span className="heading-period">.</span>
          </h1>
          <p>
            Real-time visual tracking of maritime transit lanes, transshipment hubs, and inland logistics corridors.
          </p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={loadMapData}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Map
          </button>
          <Link href="/batch" className="button button-primary">
            <Upload size={16} /> Import Manifest
          </Link>
        </div>
      </div>

      {loading && !shipments.length ? (
        <div className="content-panel map-empty-state">
          <LoaderCircle size={32} className="spin" />
          <p>Resolving container coordinates and transit corridors…</p>
        </div>
      ) : error ? (
        <div className="inline-alert inline-alert-error">
          <p>{error}</p>
        </div>
      ) : shipments.length === 0 ? (
        <div className="content-panel map-empty-state">
          <Globe2 size={40} className="empty-icon-subtle" />
          <h3>No shipments on the map yet</h3>
          <p>Import a shipment manifest from Excel (XLSX, XLS, CSV) to visualize real container journeys.</p>
          <div className="empty-state-actions">
            <Link href="/batch" className="button button-primary">
              <Upload size={16} /> Go to Manifest Import
            </Link>
            <Link href="/track" className="button button-secondary">
              <Plus size={16} /> Track Single Reference
            </Link>
          </div>
        </div>
      ) : (
        <section className="map-view-wrapper">
          <ShipmentMap shipments={shipments} />
        </section>
      )}
    </>
  );
}
