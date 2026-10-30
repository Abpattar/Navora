'use client';

import React from 'react';
import { Info } from 'lucide-react';

export default function MapLegend() {
  return (
    <div className="map-legend-panel">
      <div className="map-legend-title">
        <span>Map Key & Telemetry</span>
      </div>
      <div className="map-legend-items">
        <div className="map-legend-item">
          <span className="legend-dot legend-origin" />
          <span>Origin Terminal</span>
        </div>
        <div className="map-legend-item">
          <span className="legend-dot legend-current" />
          <span>Reported Location</span>
        </div>
        <div className="map-legend-item">
          <span className="legend-dot legend-delayed" />
          <span>Delayed / SLA Breach</span>
        </div>
        <div className="map-legend-item">
          <span className="legend-dot legend-destination" />
          <span>Destination Port</span>
        </div>
        <div className="map-legend-item">
          <span className="legend-dot legend-user" />
          <span>My Device Location</span>
        </div>
      </div>
      <div className="map-legend-disclaimer">
        <Info size={12} />
        <span>Route lines are schematic transit corridors, not verified vessel GPS tracks.</span>
      </div>
    </div>
  );
}
