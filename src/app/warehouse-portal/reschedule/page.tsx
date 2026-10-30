'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Key,
  LoaderCircle,
  RotateCw,
  Send,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';
import type { DockBooking, DockId, EnrichedShipment, Shipment } from '@/lib/types';

function RescheduleContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryShipmentId = searchParams.get('shipmentId') || '';
  const queryDock = (searchParams.get('dock') as DockId) || 'Dock B';
  const queryDate = searchParams.get('date') || '';
  const queryTime = searchParams.get('time') || '10:00';
  const queryReason = searchParams.get('reason') || '';

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState(queryShipmentId);
  const [replacementDock, setReplacementDock] = useState<DockId>(queryDock);
  const [slotDate, setSlotDate] = useState(() => queryDate || new Date().toISOString().split('T')[0]);
  const [slotHour, setSlotHour] = useState(queryTime);
  const [reason, setReason] = useState(queryReason || 'Mitigating carrier transit delay');

  const [loadingShipments, setLoadingShipments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<DockBooking | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchShipments() {
      try {
        const res = await fetch('/api/shipments/enriched', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const items: Shipment[] = (data.shipments || []).map((e: EnrichedShipment) => e.shipment);
          setShipments(items);
          if (!queryShipmentId && items.length > 0) {
            setSelectedShipmentId(items[0].id);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoadingShipments(false);
      }
    }
    void fetchShipments();
  }, [queryShipmentId]);

  useEffect(() => {
    if (queryShipmentId) setSelectedShipmentId(queryShipmentId);
    if (queryDock) setReplacementDock(queryDock);
    if (queryDate) setSlotDate(queryDate);
    if (queryTime) setSlotHour(queryTime);
    if (queryReason) setReason(queryReason);
  }, [queryShipmentId, queryDock, queryDate, queryTime, queryReason]);

  const activeShipment = shipments.find((s) => s.id === selectedShipmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentId) {
      setError('Please select a shipment to reschedule');
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatusMessage('Negotiating berth authorization with warehouse terminal…');

    const [hour] = slotHour.split(':');
    const targetDate = new Date(slotDate);
    targetDate.setHours(Number(hour || 10), 0, 0, 0);

    try {
      const res = await fetch('/api/warehouse/reschedule-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentId: selectedShipmentId,
          replacementDockId: replacementDock,
          replacementSlotTime: targetDate.toISOString(),
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to authorize dock rescheduling');
      }

      setConfirmedBooking(data.booking);
      setStatusMessage('Rescheduling confirmed. Replacement reservation issued and active.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reschedule submission failed');
      setStatusMessage(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/warehouse-portal" className="button button-secondary text-xs mb-3 inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Terminal Calendar
          </Link>
          <div className="eyebrow">
            <span className="eyebrow-line" /> INLAND LOGISTICS BERTH DISPATCH
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Autonomous Dock Rescheduling Portal<span className="heading-period">.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dedicated target terminal for TinyFish WRITE automation agents and human logistics gatekeepers.
          </p>
        </div>
      </div>

      {/* Confirmation Card (Targetable by TinyFish extraction) */}
      {confirmedBooking && (
        <div id="confirmation-card" className="content-panel mb-8 border border-emerald-500/40 bg-emerald-950/20 p-6 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-emerald-300">Replacement Dock Booking Confirmed</h3>
                <span id="badge-failsafe-verified" className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck size={12} /> Failsafe Verified
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Authoritative confirmation token generated. Prior booking safely transitioned to RESCHEDULED.
              </p>

              <div className="mt-4 p-4 rounded-lg bg-card/80 border border-border flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Confirmation ID Token</div>
                  <div id="confirmation-id" className="text-xl font-mono font-bold text-emerald-400 mt-0.5">
                    {confirmedBooking.confirmationId}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Berth / Slot</div>
                  <div className="font-medium text-foreground">
                    {confirmedBooking.dockId} • {new Date(confirmedBooking.slotTime).toLocaleDateString()} {new Date(confirmedBooking.slotTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <Link href="/dashboard" className="button button-primary text-xs">
                  View Command Dashboard
                </Link>
                <Link href="/warehouse-portal" className="button button-secondary text-xs">
                  Terminal Overview
                </Link>
                <button
                  type="button"
                  className="button button-secondary text-xs"
                  onClick={() => {
                    setConfirmedBooking(null);
                    setStatusMessage(null);
                  }}
                >
                  Schedule Another
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status or Error Alerts */}
      {statusMessage && !confirmedBooking && (
        <div id="reschedule-status-alert" className="p-3 mb-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm flex items-center gap-2">
          <LoaderCircle size={16} className="spin" />
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div id="reschedule-status-alert" className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Main Interactive Form with Explicit Accessible Element IDs */}
      <div className="content-panel p-6 rounded-xl border border-border bg-card">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shipment Selection */}
            <div>
              <label htmlFor="select-shipment-id" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Target Shipment Reference
              </label>
              <select
                id="select-shipment-id"
                value={selectedShipmentId}
                onChange={(e) => setSelectedShipmentId(e.target.value)}
                disabled={submitting || loadingShipments}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shipmentId} — {s.trackingNumber} ({s.carrierName})
                  </option>
                ))}
              </select>

              {activeShipment && (
                <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Assigned Berth:</span>
                    <strong id="display-original-dock" className="text-foreground">{activeShipment.assignedDock || 'Dock A'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Slot Window:</span>
                    <span id="display-original-slot" className="text-foreground">
                      {activeShipment.assignedDockSlot ? new Date(activeShipment.assignedDockSlot).toLocaleString() : activeShipment.promisedEta || 'Unscheduled'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Carrier Live ETA:</span>
                    <span className="text-amber-400 font-mono">
                      {(activeShipment as unknown as { liveEta?: string }).liveEta ? new Date((activeShipment as unknown as { liveEta: string }).liveEta).toLocaleString() : (activeShipment.promisedEta ? new Date(activeShipment.promisedEta).toLocaleString() : 'Pending carrier sync')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Rescheduling Form Controls */}
            <div className="space-y-4">
              <div>
                <label htmlFor="select-replacement-dock" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Replacement Berth / Dock
                </label>
                <select
                  id="select-replacement-dock"
                  value={replacementDock}
                  onChange={(e) => setReplacementDock(e.target.value as DockId)}
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Dock A">Dock A — Heavy Container Unloading Berth</option>
                  <option value="Dock B">Dock B — Standard Drayage Transfer</option>
                  <option value="Dock C">Dock C — Express Cross-dock Hub</option>
                  <option value="Dock D">Dock D — Overflow & Cold Chain Berth</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="input-slot-date" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Slot Date
                  </label>
                  <input
                    id="input-slot-date"
                    type="date"
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    disabled={submitting}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="select-slot-time" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Time Window
                  </label>
                  <select
                    id="select-slot-time"
                    value={slotHour}
                    onChange={(e) => setSlotHour(e.target.value)}
                    disabled={submitting}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="08:00">08:00 - 10:00 (Morning Shift)</option>
                    <option value="10:00">10:00 - 12:00 (Mid-morning)</option>
                    <option value="12:00">12:00 - 14:00 (Midday Transfer)</option>
                    <option value="14:00">14:00 - 16:00 (Afternoon Priority)</option>
                    <option value="16:00">16:00 - 18:00 (Evening Discharge)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="input-reschedule-reason" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Reason for Berth Adjustment
                </label>
                <input
                  id="input-reschedule-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Carrier transit delay mitigation"
                  disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Atomic safety gate active: original booking preserved until server verification.</span>
            </div>

            <button
              id="btn-submit-reschedule"
              type="submit"
              disabled={submitting || loadingShipments}
              className="button button-primary px-5 py-2.5 text-sm flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <LoaderCircle size={16} className="spin" /> Executing Reschedule…
                </>
              ) : (
                <>
                  <RotateCw size={16} /> Authorize & Reschedule Berth
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReschedulePage() {
  return (
    <Suspense
      fallback={
        <div className="content-panel p-8 text-center">
          <LoaderCircle size={24} className="spin mx-auto text-emerald-400" />
          <p className="mt-2 text-xs text-muted-foreground">Loading terminal reschedule gateway…</p>
        </div>
      }
    >
      <RescheduleContent />
    </Suspense>
  );
}
