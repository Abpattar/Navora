'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Calendar, Clock, Key, LoaderCircle, Plus, RefreshCw, ShieldCheck, Warehouse } from 'lucide-react';
import DockCalendar from './components/DockCalendar';
import BookingForm from './components/BookingForm';
import BookingConfirmation from './components/BookingConfirmation';
import type { DockBooking, EnrichedShipment, Shipment } from '@/lib/types';

export default function WarehousePortalPage() {
  const [bookings, setBookings] = useState<DockBooking[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestBooking, setLatestBooking] = useState<DockBooking | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [bookingsRes, shipmentsRes] = await Promise.all([
        fetch('/api/warehouse/bookings', { cache: 'no-store' }),
        fetch('/api/shipments/enriched', { cache: 'no-store' }),
      ]);

      if (bookingsRes.ok) {
        const bData = await bookingsRes.json();
        setBookings(bData.bookings || []);
      }
      if (shipmentsRes.ok) {
        const sData = await shipmentsRes.json();
        const extracted = (sData.shipments || []).map((e: EnrichedShipment) => e.shipment);
        setShipments(extracted);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> INLAND LOGISTICS DOCK DISPATCH
          </div>
          <h1>
            Autonomous Warehouse Portal<span className="heading-period">.</span>
          </h1>
          <p>
            Target terminal application for autonomous rescheduling agents. Manages Berth A, B, and C reservations.
          </p>
        </div>
        <div className="heading-actions">
          <Link href="/warehouse-portal/bookings" className="button button-secondary">
            View All Reservations ({bookings.length})
          </Link>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setShowForm((prev) => !prev)}
          >
            <Plus size={16} /> New Dock Reservation
          </button>
        </div>
      </div>

      {latestBooking && (
        <BookingConfirmation
          booking={latestBooking}
          onDone={() => setLatestBooking(null)}
        />
      )}

      {showForm && (
        <section className="content-panel mb-6">
          <BookingForm
            shipments={shipments}
            onBookingCreated={(b) => {
              setBookings((prev) => [b, ...prev]);
              setLatestBooking(b);
              setShowForm(false);
            }}
          />
        </section>
      )}

      {loading ? (
        <div className="content-panel map-empty-state">
          <LoaderCircle size={28} className="spin" />
          <p>Loading dock reservation schedule…</p>
        </div>
      ) : (
        <div className="warehouse-dashboard-grid">
          <div className="calendar-main-col">
            <DockCalendar bookings={bookings} />
          </div>

          <aside className="warehouse-sidebar-col">
            <div className="side-card">
              <div className="side-card-heading">
                <span className="side-card-icon amber-icon"><Bot size={18} /></span>
                <span className="side-card-overline">AUTONOMOUS DISPATCH</span>
              </div>
              <h3>Rescheduling Failsafe</h3>
              <p>
                When a shipment ETA changes, TinyFish&apos;s Warehouse Agent reserves a replacement dock slot, secures the server confirmation key, and only then marks the prior reservation as rescheduled.
              </p>
              <div className="safety-checklist">
                <div className="safety-item">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Never drops original reservation prematurely</span>
                </div>
                <div className="safety-item">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Server-side cryptographic confirmation keys</span>
                </div>
                <div className="safety-item">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Strict idempotency keys to prevent duplicates</span>
                </div>
              </div>
              <Link href="/agent-console" className="button button-secondary button-full">
                Open Agent Console <ArrowRight size={15} />
              </Link>
            </div>

            <div className="side-card subtle-side-card">
              <div className="side-card-heading">
                <span className="side-card-icon green-icon"><Warehouse size={18} /></span>
                <span className="side-card-overline">BERTH CAPACITIES</span>
              </div>
              <ul className="dock-capacities-list">
                <li>
                  <strong>Dock A</strong>
                  <span>Heavy container unloader / gantry hoist (120T)</span>
                </li>
                <li>
                  <strong>Dock B</strong>
                  <span>Standard multimodal container drayage bay</span>
                </li>
                <li>
                  <strong>Dock C</strong>
                  <span>Express cross-dock LTL sortation facility</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
