'use client';

import React from 'react';
import { Crosshair, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
  onToggleUserLocation: () => void;
  hasUserLocation: boolean;
  locatingUser: boolean;
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onFitAll,
  onToggleUserLocation,
  hasUserLocation,
  locatingUser,
}: MapControlsProps) {
  return (
    <div className="map-custom-controls">
      <div className="map-control-group">
        <button
          type="button"
          onClick={onZoomIn}
          className="map-control-btn"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="map-control-btn"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
      </div>

      <div className="map-control-group">
        <button
          type="button"
          onClick={onFitAll}
          className="map-control-btn"
          title="Fit all shipments"
          aria-label="Fit all shipments"
        >
          <Maximize2 size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleUserLocation}
          className={`map-control-btn ${hasUserLocation ? 'map-control-active' : ''}`}
          title={hasUserLocation ? 'User location active' : 'Show my location'}
          aria-label="Show my device location"
          disabled={locatingUser}
        >
          <Crosshair size={16} className={locatingUser ? 'spin' : ''} />
        </button>
      </div>
    </div>
  );
}
