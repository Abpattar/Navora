'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Key, LoaderCircle, RefreshCw, Warehouse } from 'lucide-react';
import type { DockBooking } from '@/lib/types';

export default function BookingsLedgerPage() {
  const [bookings, setBookings] = useState<DockBooking[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadBookings() {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/bookings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> TERMINAL DISPATCH LEDGER
          </div>
          <h1>
            Warehouse Reservations<span className="heading-period">.</span>
          </h1>
          <p>Complete historical log of all server-issued dock reservation keys and transition states.</p>
        </div>
        <div className="heading-actions">
          <Link href="/warehouse-portal" className="button button-secondary">
            <ArrowLeft size={16} /> Back to Terminal Calendar
          </Link>
          <button type="button" className="button button-secondary" onClick={loadBookings} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Ledger
          </button>
        </div>
      </div>

      <section className="content-panel">
        {loading ? (
          <div className="map-empty-state">
            <LoaderCircle size={28} className="spin" />
            <p>Loading dock reservation ledger…</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="map-empty-state">
            <Warehouse size={36} className="empty-icon-subtle" />
            <p>No dock reservations created yet.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation ID</th>
                  <th>Dock Berth</th>
                  <th>Scheduled Slot</th>
                  <th>Container / Ref</th>
                  <th>Carrier</th>
                  <th>Status</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <div className="confirmation-pill">
                        <Key size={13} />
                        <code>{booking.confirmationId}</code>
                      </div>
                    </td>
                    <td>
                      <strong>{booking.dockId}</strong>
                    </td>
                    <td>
                      <div className="table-time-cell">
                        <Clock size={13} />
                        <span>{new Date(booking.slotTime).toLocaleString()}</span>
                      </div>
                    </td>
                    <td>
                      <code>{booking.trackingNumber}</code>
                    </td>
                    <td>{booking.carrierName}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          booking.status === 'CONFIRMED'
                            ? 'status-success'
                            : booking.status === 'RESCHEDULED'
                            ? 'status-needs_login'
                            : 'status-error'
                        }`}
                      >
                        <span className="status-dot" />
                        {booking.status}
                      </span>
                    </td>
                    <td className="table-secondary">{new Date(booking.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
