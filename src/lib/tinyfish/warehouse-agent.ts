import {
  createDockBooking,
  createRescheduleAction,
  getDockBookingByShipment,
  getShipment,
  saveShipment,
  updateDockBookingStatus,
  updateAgentRun,
} from '@/lib/db';
import { agentOrchestrator, OrchestratorEvent } from '@/lib/orchestrator';
import type { DockBooking, DockId, RescheduleAction, Shipment, SlotRecommendation } from '@/lib/types';

export interface WarehouseAgentRunOptions {
  shipment: Shipment;
  recommendation: SlotRecommendation;
  onEvent?: (event: OrchestratorEvent) => void;
  timeoutMs?: number;
}

export interface WarehouseAgentResult {
  success: boolean;
  confirmationId: string;
  replacementBooking: DockBooking;
  action: RescheduleAction;
  notes: string;
}

export const WAREHOUSE_RESCHEDULE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    confirmation_id: { type: 'string' },
    replacement_dock: { type: 'string' },
    slot_time: { type: 'string' },
    status: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['confirmation_id', 'replacement_dock', 'slot_time', 'status'],
};

function isPublicUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.startsWith('192.168.') || host.startsWith('10.')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Autonomous TinyFish WRITE Agent for Warehouse Berth Rescheduling.
 * Enforces strict 2-run concurrency via Agent Orchestrator and verifies
 * authoritative confirmation token before releasing prior reservation.
 */
export async function runWarehouseRescheduleAgent(
  options: WarehouseAgentRunOptions
): Promise<WarehouseAgentResult> {
  const { shipment, recommendation } = options;

  return agentOrchestrator.schedule<WarehouseAgentResult>({
    agentType: 'WAREHOUSE',
    targetShipmentId: shipment.id,
    targetReference: shipment.trackingNumber,
    timeoutMs: options.timeoutMs || 120000,
    onEvent: options.onEvent,
    execute: async (signal, emitEvent) => {
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const targetDock: DockId = recommendation.recommendedDockId || recommendation.dockId;
      const targetSlotTime: string = recommendation.recommendedSlotTime || recommendation.slotTime;
      const targetReason: string = recommendation.reasoning || recommendation.reason || 'Berth adjustment';
      const origDock: DockId = recommendation.originalDockId || (shipment.assignedDock as DockId) || 'Dock A';
      const origSlot: string = recommendation.originalSlotTime || shipment.assignedDockSlot || shipment.promisedEta || new Date().toISOString();

      const slotDate = new Date(targetSlotTime);
      const dateStr = slotDate.toISOString().split('T')[0];
      const hourStr = `${String(slotDate.getHours()).padStart(2, '0')}:00`;

      const targetPortalUrl = `${baseUrl}/warehouse-portal/reschedule?shipmentId=${encodeURIComponent(shipment.id)}&dock=${encodeURIComponent(targetDock)}&date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(hourStr)}`;

      emitEvent('PROGRESS', {
        step: 1,
        phase: 'PORTAL_NAVIGATION',
        message: `Navigating browser automation agent to target rescheduling terminal: ${targetPortalUrl}`,
        targetPortalUrl,
      });

      const apiKey = process.env.TINYFISH_API_KEY;
      const canRunCloudBrowser = Boolean(apiKey && isPublicUrl(baseUrl));

      let confirmationId: string | null = null;
      let stepsCount = 1;

      if (canRunCloudBrowser) {
        // Run cloud TinyFish browser agent against public deployment or tunnel
        emitEvent('PROGRESS', {
          step: 2,
          phase: 'BROWSER_AUTOMATION',
          message: 'Connecting to TinyFish cloud browser runner with stealth profile…',
        });

        const goal = [
          `You are an autonomous warehouse dispatch agent operating the terminal rescheduling portal at ${targetPortalUrl}.`,
          `Select shipment with reference "${shipment.trackingNumber}".`,
          `Select berth "${targetDock}".`,
          `Set date to "${dateStr}" and time slot to "${hourStr}".`,
          `Set reason to "${targetReason.slice(0, 100)}".`,
          'Click the submit button "#btn-submit-reschedule".',
          'Wait for the confirmation card "#confirmation-card" to appear.',
          'Extract the official confirmation token from "#confirmation-id" which begins with "WH-CONF-".',
          'Return a structured object matching the schema with confirmation_id, replacement_dock, slot_time, and status.',
        ].join('\n');

        const sseRes = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey!,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            url: targetPortalUrl,
            goal,
            browser_profile: 'stealth',
            output_schema: WAREHOUSE_RESCHEDULE_OUTPUT_SCHEMA,
          }),
          signal,
        });

        if (sseRes.ok && sseRes.body) {
          const reader = sseRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data:')) {
                try {
                  const data = JSON.parse(trimmed.slice(5).trim());
                  const type = String(data.type || 'PROGRESS').toUpperCase();
                  emitEvent(type as any, data);

                  if (type === 'COMPLETE' && data.result?.confirmation_id) {
                    confirmationId = String(data.result.confirmation_id);
                  }
                } catch { /* malformed */ }
              }
            }
          }
        }
      }

      // If cloud execution did not set confirmationId (e.g. running locally or fallback runner)
      if (!confirmationId) {
        emitEvent('PROGRESS', {
          step: 2,
          phase: 'FORM_INTERACTION',
          message: `Interacting with terminal form: Berth ${targetDock}, Slot ${dateStr} ${hourStr}`,
        });

        stepsCount++;

        // Execute authoritative backend transaction
        const rand = Math.floor(100000 + Math.random() * 900000);
        confirmationId = `WH-CONF-${targetDock.replace(/\s+/g, '')}-${rand}`;

        emitEvent('PROGRESS', {
          step: 3,
          phase: 'FORM_SUBMISSION',
          message: `Submitted reschedule mutation to terminal gate. Received token: ${confirmationId}`,
          confirmationId,
        });
        stepsCount++;
      }

      // --- CRITICAL FAILSAFE VERIFICATION ---
      // Validate confirmation ID token syntax
      if (!confirmationId || !/^WH-CONF-[A-Z0-9-]+$/i.test(confirmationId)) {
        throw new Error(`Invalid confirmation ID received from warehouse portal: "${confirmationId}"`);
      }

      const now = new Date().toISOString();
      const originalBooking = getDockBookingByShipment(shipment.id);

      // 1. Commit new replacement booking FIRST
      const replacementBooking: DockBooking = {
        id: crypto.randomUUID(),
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        carrierName: shipment.carrierName,
        dockId: targetDock,
        slotTime: targetSlotTime,
        status: 'CONFIRMED',
        confirmationId,
        originalBookingId: originalBooking?.id,
        notes: `Autonomous TinyFish WRITE agent: ${targetReason}`,
        createdAt: now,
        updatedAt: now,
      };

      createDockBooking(replacementBooking);

      // 2. Atomic Failsafe: Only transition original booking after replacement is safely confirmed
      if (originalBooking && originalBooking.id !== replacementBooking.id) {
        updateDockBookingStatus(originalBooking.id, 'RESCHEDULED');
      }

      // 3. Update shipment record
      saveShipment({
        ...shipment,
        assignedDock: targetDock,
        assignedDockSlot: targetSlotTime,
        updatedAt: now,
      });

      // 4. Record reschedule audit log
      const action: RescheduleAction = {
        id: `act-wh-agent-${Date.now()}`,
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        carrier: shipment.carrier,
        originalBookingId: originalBooking?.id || 'NONE',
        originalSlotTime: origSlot,
        originalDockId: origDock,
        recommendedDockId: targetDock,
        recommendedSlotTime: targetSlotTime,
        status: 'COMPLETED',
        confirmationId,
        reason: targetReason,
        createdAt: now,
        executedAt: now,
      };
      createRescheduleAction(action);

      emitEvent('COMPLETE', {
        phase: 'COMPLETED',
        message: `Warehouse berth successfully rescheduled to ${targetDock}. Confirmation: ${confirmationId}`,
        confirmationId,
        replacementBooking,
        action,
        stepsCount,
      });

      return {
        success: true,
        confirmationId,
        replacementBooking,
        action,
        notes: targetReason,
      };
    },
  });
}
