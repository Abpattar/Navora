'use client';

import React from 'react';
import { Check, Clock, Warehouse } from 'lucide-react';
import type { DockId } from '@/lib/types';

interface AvailableSlotsProps {
  slots: Array<{
    dockId: DockId;
    slotTime: string;
    formattedTime: string;
    isAvailable: boolean;
  }>;
  selectedSlotTime?: string;
  selectedDockId?: DockId;
  onSelect: (dockId: DockId, slotTime: string) => void;
}

export default function AvailableSlots({
  slots,
  selectedSlotTime,
  selectedDockId,
  onSelect,
}: AvailableSlotsProps) {
  const availableOnly = slots.filter((s) => s.isAvailable);

  return (
    <div className="available-slots-selector">
      <div className="selector-title">
        <Clock size={16} />
        <h4>Select Replacement Dock Slot</h4>
      </div>

      {availableOnly.length === 0 ? (
        <p className="no-slots-note">All slots fully reserved for this window.</p>
      ) : (
        <div className="slots-pills-grid">
          {availableOnly.map((slot) => {
            const isSelected = selectedDockId === slot.dockId && selectedSlotTime === slot.slotTime;

            return (
              <button
                type="button"
                key={`${slot.dockId}-${slot.slotTime}`}
                className={`slot-pill-btn ${isSelected ? 'slot-pill-selected' : ''}`}
                onClick={() => onSelect(slot.dockId, slot.slotTime)}
              >
                <div className="slot-pill-dock">{slot.dockId}</div>
                <div className="slot-pill-time">{slot.formattedTime}</div>
                {isSelected && <Check size={14} className="slot-check-icon" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
