'use client';

import React, { useState } from 'react';
import { Calendar, CheckCircle2, Clock, LoaderCircle, Send, Warehouse } from 'lucide-react';
import type { DockBooking, DockId, Shipment } from '@/lib/types';

interface BookingFormProps {
  shipments: Shipment[];
  onBookingCreated: (booking: DockBooking) => void;
}

export default function BookingForm({ shipments, onBookingCreated }: BookingFormProps) {
  const [selectedShipmentId, setSelectedShipmentId] = useState(shipments[0]?.id || '');
  const [dockId, setDockId] = useState<DockId>('Dock A');
  const [slotDate, setSlotDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [slotHour, setSlotHour] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedShipment = shipments.find((s) => s.id === selectedShipmentId) || shipments[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    setSubmitting(true);
    setError(null);

    const [hour] = slotHour.split(':');
    const slotTimeDate = new Date(slotDate);
    slotTimeDate.setHours(Number(hour), 0, 0, 0);

    try {
      const res = await fetch('/api/warehouse/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: selectedShipment.id,
          trackingNumber: selectedShipment.trackingNumber,
          carrierName: selectedShipment.carrierName,
          dockId,
          slotTime: slotTimeDate.toISOString(),
          notes: 'Standard warehouse unloading reservation',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit reservation');
      }

      onBookingCreated(data.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="warehouse-booking-form">
      <div className="form-title">
        <Warehouse size={18} />
        <h4>Reserve Unloading Dock</h4>
      </div>

      {error && <div className="inline-alert inline-alert-error"><p>{error}</p></div>}

      <div className="form-fields-grid">
        <div className="form-group">
          <label htmlFor="wh-shipment">Shipment Reference</label>
          <select
            id="wh-shipment"
            value={selectedShipmentId}
            onChange={(e) => setSelectedShipmentId(e.target.value)}
            disabled={submitting}
          >
            {shipments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shipmentId} — {s.trackingNumber} ({s.carrierName})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="wh-dock">Assigned Berth / Dock</label>
          <select
            id="wh-dock"
            value={dockId}
            onChange={(e) => setDockId(e.target.value as DockId)}
            disabled={submitting}
          >
            <option value="Dock A">Dock A (Heavy Container Unloading)</option>
            <option value="Dock B">Dock B (Standard Drayage)</option>
            <option value="Dock C">Dock C (Express Cross-dock)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="wh-date">Arrival Date</label>
          <input
            id="wh-date"
            type="date"
            value={slotDate}
            onChange={(e) => setSlotDate(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="wh-time">Time Window</label>
          <select
            id="wh-time"
            value={slotHour}
            onChange={(e) => setSlotHour(e.target.value)}
            disabled={submitting}
          >
            <option value="08:00">08:00 - 10:00 (Morning Priority)</option>
            <option value="10:00">10:00 - 12:00</option>
            <option value="12:00">12:00 - 14:00 (Midday Shift)</option>
            <option value="14:00">14:00 - 16:00</option>
            <option value="16:00">16:00 - 18:00 (Evening Discharge)</option>
            <option value="18:00">18:00 - 20:00</option>
          </select>
        </div>
      </div>

      <button type="submit" className="button button-primary" disabled={submitting}>
        {submitting ? (
          <>
            <LoaderCircle size={16} className="spin" /> Confirming Reservation…
          </>
        ) : (
          <>
            <Send size={16} /> Confirm Dock Reservation
          </>
        )}
      </button>
    </form>
  );
}
