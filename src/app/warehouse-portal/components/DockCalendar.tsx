'use client';

import React from 'react';
import { Calendar, Clock, Warehouse, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { DockBooking, DockId } from '@/lib/types';

interface DockCalendarProps {
  bookings: DockBooking[];
  onSelectSlot?: (dockId: DockId, time: string) => void;
}

const DOCKS: DockId[] = ['Dock A', 'Dock B', 'Dock C'];
const HOURS = [8, 10, 12, 14, 16, 18];

export default function DockCalendar({ bookings, onSelectSlot }: DockCalendarProps) {
  const today = new Date();

  return (
    <div className="dock-calendar-card">
      <div className="calendar-header">
        <div className="calendar-title">
          <Warehouse size={18} />
          <div>
            <h3>Autonomous Terminal Schedule</h3>
            <p>Real-time dock allocation across active container berths</p>
          </div>
        </div>
        <div className="calendar-date-pill">
          <Calendar size={14} />
          <span>{today.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="dock-grid-table">
        <div className="dock-grid-header">
          <span className="dock-col-time">Time Slot</span>
          {DOCKS.map((dock) => (
            <span key={dock} className="dock-col-dock">
              {dock}
            </span>
          ))}
        </div>

        <div className="dock-grid-body">
          {HOURS.map((hour) => {
            const timeLabel = `${hour.toString().padStart(2, '0')}:00`;

            return (
              <div key={hour} className="dock-time-row">
                <span className="dock-row-label">
                  <Clock size={12} /> {timeLabel}
                </span>

                {DOCKS.map((dock) => {
                  const match = bookings.find((b) => {
                    if (b.status === 'CANCELLED') return false;
                    if (b.dockId !== dock) return false;
                    const d = new Date(b.slotTime);
                    return d.getHours() === hour;
                  });

                  return (
                    <div
                      key={dock}
                      className={`dock-slot-cell ${
                        match ? 'slot-occupied' : 'slot-available'
                      }`}
                      onClick={() => !match && onSelectSlot?.(dock, timeLabel)}
                    >
                      {match ? (
                        <div className="dock-booking-pill">
                          <span className="booking-ref">{match.trackingNumber}</span>
                          <span className="booking-conf">{match.confirmationId}</span>
                        </div>
                      ) : (
                        <span className="slot-empty-label">Open Slot</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
