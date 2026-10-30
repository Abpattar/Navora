'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EnrichedShipment } from '@/lib/types';
import ShipmentPopup from './ShipmentPopup';
import MapControls from './MapControls';
import MapLegend from './MapLegend';
import { generateCurvedRoutePoints } from '@/lib/geo/coordinate-utils';

interface MapClientProps {
  shipments: EnrichedShipment[];
  selectedShipmentId?: string | null;
  onSelectShipment?: (shipment: EnrichedShipment) => void;
}

function createHtmlIcon(color: string, type: 'origin' | 'current' | 'destination' | 'delayed') {
  return L.divIcon({
    className: 'leaflet-custom-marker-wrapper',
    html: `
      <div class="custom-leaflet-marker marker-${type}" style="--marker-color: ${color};">
        <div class="marker-inner-circle"></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: 'leaflet-custom-marker-wrapper',
    html: `
      <div class="user-gps-pulse-marker">
        <div class="user-gps-ring"></div>
        <div class="user-gps-core"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Subcomponent to programmatically control the map instance
function MapController({
  userLocation,
  shipments,
  triggerFitAll,
  onMapReady,
}: {
  userLocation: { lat: number; lng: number } | null;
  shipments: EnrichedShipment[];
  triggerFitAll: number;
  onMapReady: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  // Fit bounds when triggerFitAll changes
  useEffect(() => {
    const latLngs: L.LatLngTuple[] = [];

    shipments.forEach((item) => {
      if (item.originLocation?.latitude && item.originLocation?.longitude) {
        latLngs.push([item.originLocation.latitude, item.originLocation.longitude]);
      }
      if (item.currentLocation?.latitude && item.currentLocation?.longitude) {
        latLngs.push([item.currentLocation.latitude, item.currentLocation.longitude]);
      }
      if (item.destinationLocation?.latitude && item.destinationLocation?.longitude) {
        latLngs.push([item.destinationLocation.latitude, item.destinationLocation.longitude]);
      }
    });

    if (userLocation) {
      latLngs.push([userLocation.lat, userLocation.lng]);
    }

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    }
  }, [triggerFitAll, shipments, userLocation, map]);

  return null;
}

export default function MapClient({
  shipments,
  selectedShipmentId,
  onSelectShipment,
}: MapClientProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [triggerFitAll, setTriggerFitAll] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Memoize marker icons
  const originIcon = useMemo(() => createHtmlIcon('#10b981', 'origin'), []);
  const currentIcon = useMemo(() => createHtmlIcon('#f59e0b', 'current'), []);
  const delayedIcon = useMemo(() => createHtmlIcon('#ef4444', 'delayed'), []);
  const destinationIcon = useMemo(() => createHtmlIcon('#3b82f6', 'destination'), []);
  const userIcon = useMemo(() => createUserIcon(), []);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleFitAll = () => setTriggerFitAll((prev) => prev + 1);

  const handleToggleUserLocation = () => {
    if (userLocation) {
      setUserLocation(null);
      return;
    }

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocatingUser(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        mapRef.current?.flyTo([coords.lat, coords.lng], 6);
      },
      (err) => {
        setLocatingUser(false);
        setLocationError(`Location request failed: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="live-map-container">
      <MapContainer
        center={[20, 77]} // Default centered on Indian Ocean / Global shipping lanes
        zoom={3}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom={true}
        className="leaflet-full-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-styled"
        />

        <MapController
          userLocation={userLocation}
          shipments={shipments}
          triggerFitAll={triggerFitAll}
          onMapReady={(map) => { mapRef.current = map; }}
        />

        {/* User GPS Location Marker */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>
              <div className="map-popup-user">
                <strong>Your Device Location</strong>
                <p>Telemetry reference only. Not associated with container tracking coordinates.</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Shipment Markers and Route Lines */}
        {shipments.map((item) => {
          const { shipment, tracking, originLocation, currentLocation, destinationLocation, sla } = item;
          const isSelected = shipment.id === selectedShipmentId;

          // Compute schematic route line
          let routeCoordinates: [number, number][] = [];
          if (
            originLocation?.latitude && originLocation?.longitude &&
            destinationLocation?.latitude && destinationLocation?.longitude
          ) {
            routeCoordinates = generateCurvedRoutePoints(
              { latitude: originLocation.latitude, longitude: originLocation.longitude },
              { latitude: destinationLocation.latitude, longitude: destinationLocation.longitude }
            );
          }

          const isDelayed = sla?.isBreached || tracking?.currentStatus === 'DELAYED';

          return (
            <React.Fragment key={shipment.id}>
              {/* Route Line */}
              {routeCoordinates.length > 0 && (
                <Polyline
                  positions={routeCoordinates}
                  pathOptions={{
                    color: isDelayed ? '#ef4444' : isSelected ? '#38bdf8' : '#0ea5e9',
                    weight: isSelected ? 3.5 : 2,
                    dashArray: '6, 8',
                    opacity: isSelected ? 0.9 : 0.6,
                  }}
                />
              )}

              {/* Origin Marker */}
              {originLocation?.latitude && originLocation?.longitude && (
                <Marker
                  position={[originLocation.latitude, originLocation.longitude]}
                  icon={originIcon}
                  eventHandlers={{
                    click: () => onSelectShipment?.(item),
                  }}
                >
                  <Popup>
                    <ShipmentPopup shipment={item} pointType="origin" />
                  </Popup>
                </Marker>
              )}

              {/* Current Reported Location Marker */}
              {currentLocation?.latitude && currentLocation?.longitude && (
                <Marker
                  position={[currentLocation.latitude, currentLocation.longitude]}
                  icon={isDelayed ? delayedIcon : currentIcon}
                  eventHandlers={{
                    click: () => onSelectShipment?.(item),
                  }}
                >
                  <Popup>
                    <ShipmentPopup shipment={item} pointType="current" />
                  </Popup>
                </Marker>
              )}

              {/* Destination Marker */}
              {destinationLocation?.latitude && destinationLocation?.longitude && (
                <Marker
                  position={[destinationLocation.latitude, destinationLocation.longitude]}
                  icon={destinationIcon}
                  eventHandlers={{
                    click: () => onSelectShipment?.(item),
                  }}
                >
                  <Popup>
                    <ShipmentPopup shipment={item} pointType="destination" />
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Map Floating UI */}
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitAll={handleFitAll}
        onToggleUserLocation={handleToggleUserLocation}
        hasUserLocation={Boolean(userLocation)}
        locatingUser={locatingUser}
      />

      <MapLegend />

      {locationError && (
        <div className="map-error-toast">
          {locationError}
          <button type="button" onClick={() => setLocationError(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
