'use client';

import React from 'react';
import { CheckCircle2, Clock, Key, ShieldCheck, Warehouse } from 'lucide-react';
import type { DockBooking } from '@/lib/types';

interface BookingConfirmationProps {
  booking: DockBooking;
  onDone?: () => void;
}

export default function BookingConfirmation({ booking, onDone }: BookingConfirmationProps) {
  return (
    <div className="booking-confirmation-modal">
      <div className="confirmation-header">
        <div className="confirmation-icon-halo">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <h3>Dock Reservation Confirmed</h3>
        <p>Server-issued authorization key generated and synchronized with terminal gate.</p>
      </div>

      <div className="confirmation-key-display">
        <span className="key-caption">Official Confirmation ID</span>
        <div className="key-code-pill">
          <Key size={16} />
          <code>{booking.confirmationId}</code>
        </div>
      </div>

      <div className="confirmation-details-list">
        <div className="conf-detail-row">
          <span>Assigned Berth:</span>
          <strong>{booking.dockId}</strong>
        </div>
        <div className="conf-detail-row">
          <span>Scheduled Window:</span>
          <strong>{new Date(booking.slotTime).toLocaleString()}</strong>
        </div>
        <div className="conf-detail-row">
          <span>Tracking Reference:</span>
          <code>{booking.trackingNumber}</code>
        </div>
        <div className="conf-detail-row">
          <span>Carrier:</span>
          <span>{booking.carrierName}</span>
        </div>
        {booking.originalBookingId && (
          <div className="conf-detail-row">
            <span>Prior Booking:</span>
            <span>{booking.originalBookingId}</span>
          </div>
        )}
      </div>

      <div className="confirmation-footer">
        <div className="safety-rule-badge">
          <ShieldCheck size={14} />
          <span>Failsafe Verified: Replacement confirmed before prior reservation transition.</span>
        </div>
        {onDone && (
          <button type="button" className="button button-primary" onClick={onDone}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
