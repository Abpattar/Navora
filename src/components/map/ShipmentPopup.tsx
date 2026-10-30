'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, Clock, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';
import type { EnrichedShipment } from '@/lib/types';

interface ShipmentPopupProps {
  shipment: EnrichedShipment;
  pointType: 'origin' | 'current' | 'destination';
}

export default function ShipmentPopup({ shipment, pointType }: ShipmentPopupProps) {
  const { shipment: s, tracking: t, sla } = shipment;

  const locationText = pointType === 'origin'
    ? (s.origin || 'Origin Terminal')
    : pointType === 'destination'
    ? (s.destination || 'Destination Port')
    : (t?.currentLocation || 'In Transit');

  const accuracy = pointType === 'current'
    ? shipment.currentLocation?.accuracy || 'PORT_APPROXIMATE'
    : 'PORT_APPROXIMATE';

  return (
    <div className="map-popup-card">
      <div className="map-popup-header">
        <div>
          <span className="map-popup-carrier">{s.carrierName}</span>
          <h4 className="map-popup-title">{s.shipmentId}</h4>
        </div>
        <span className={`map-popup-badge status-${t?.currentStatus?.toLowerCase() || 'in_transit'}`}>
          {t?.currentStatus || 'IN_TRANSIT'}
        </span>
      </div>

      <div className="map-popup-ref">
        <span className="map-popup-label">Ref / Container:</span>
        <code>{s.trackingNumber}</code>
      </div>

      <div className="map-popup-row">
        <MapPin size={14} className="map-popup-icon" />
        <div>
          <strong>{locationText}</strong>
          <div className="map-accuracy-label">
            <ShieldCheck size={11} /> {accuracy}
          </div>
        </div>
      </div>

      {t?.liveEta && (
        <div className="map-popup-row">
          <Clock size={14} className="map-popup-icon" />
          <div>
            <span>Live ETA: {new Date(t.liveEta).toLocaleDateString()}</span>
            {sla?.isBreached && (
              <span className="map-delay-tag">
                <AlertTriangle size={11} /> +{sla.delayHours}h delay
              </span>
            )}
          </div>
        </div>
      )}

      <div className="map-popup-footer">
        {t?.sourceUrl && (
          <a
            href={t.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="map-popup-link"
          >
            Carrier Source <ExternalLink size={12} />
          </a>
        )}
        <Link href={`/agent-console?shipmentId=${s.id}`} className="map-popup-btn">
          Inspect Agent
        </Link>
      </div>
    </div>
  );
}
