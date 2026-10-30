import { getCarrier } from '@/lib/carriers';
import {
  getShipment,
  getLatestTracking,
  getShipmentWorkflow,
  saveShipmentWorkflow,
  saveTrackingObservation,
} from '@/lib/db';
import { evaluateRescheduleDecision } from '@/lib/logistics/reschedule-decision-engine';
import { runTrackingAgentSSE } from '@/lib/tinyfish/client';
import { runWarehouseRescheduleAgent } from '@/lib/tinyfish/warehouse-agent';
import { parseIsoOrDate } from '@/lib/logistics/eta-calculator';
import type {
  DockId,
  Shipment,
  ShipmentStatus,
  ShipmentTracking,
  ShipmentWorkflowRecord,
  SlotRecommendation,
} from '@/lib/types';

export interface WorkflowExecutionResult {
  shipmentId: string;
  workflow: ShipmentWorkflowRecord;
  trackingObservation?: ShipmentTracking | null;
  recommendation?: SlotRecommendation | null;
  message: string;
}

/**
 * Initiates or advances the autonomous workflow for a shipment:
 * READ -> DETECT -> DECIDE -> (AWAITING APPROVAL) -> WRITE -> VERIFY
 */
export async function executeShipmentWorkflow(
  shipmentId: string,
  options?: { skipTrackingIfFreshMinutes?: number }
): Promise<WorkflowExecutionResult> {
  const shipment = getShipment(shipmentId);
  if (!shipment) {
    throw new Error(`Shipment "${shipmentId}" not found`);
  }

  const now = new Date().toISOString();
  const existingWf = getShipmentWorkflow(shipmentId);
  const workflowRecord: ShipmentWorkflowRecord = existingWf || {
    id: crypto.randomUUID(),
    shipmentId,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    currentState: 'IMPORTED',
    currentStep: 'READ',
    approvalStatus: 'PENDING',
    status: 'IMPORTED',
    createdAt: now,
    updatedAt: now,
  };

  if (!existingWf) {
    saveShipmentWorkflow(workflowRecord);
  }

  // --- STEP 1: READ ---
  let tracking = getLatestTracking(shipmentId);
  const skipWindowMs = (options?.skipTrackingIfFreshMinutes ?? 10) * 60 * 1000;
  const isFresh = tracking && (Date.now() - new Date(tracking.retrievedAt).getTime() < skipWindowMs);

  if (!isFresh) {
    workflowRecord.currentStep = 'READ';
    workflowRecord.currentState = 'TRACKING';
    workflowRecord.status = 'TRACKING';
    workflowRecord.updatedAt = new Date().toISOString();
    saveShipmentWorkflow(workflowRecord);

    const carrier = getCarrier(shipment.carrier);
    if (carrier) {
      try {
        const result = await runTrackingAgentSSE({
          carrier,
          trackingNumber: shipment.trackingNumber,
          shipmentId: shipment.id,
        });

        const rawStatus = result.status || result.latestEvent || '';
        let currentStatus: ShipmentStatus = 'UNKNOWN';
        if (/delivered/i.test(rawStatus)) currentStatus = 'DELIVERED';
        else if (/customs/i.test(rawStatus)) currentStatus = 'CUSTOMS_HOLD';
        else if (/terminal|discharged|arrived/i.test(rawStatus)) currentStatus = 'ARRIVED_AT_TERMINAL';
        else if (/delayed|held|exception/i.test(rawStatus)) currentStatus = 'DELAYED';
        else if (result.lookupStatus === 'success') currentStatus = 'IN_TRANSIT';

        const obs: ShipmentTracking = {
          id: crypto.randomUUID(),
          shipmentId: shipment.id,
          trackingNumber: shipment.trackingNumber,
          carrier: shipment.carrier,
          carrierName: shipment.carrierName,
          lookupStatus: result.lookupStatus,
          currentStatus,
          rawStatus: result.status,
          currentLocation: result.location,
          liveEta: result.estimatedArrival,
          isDelayed: currentStatus === 'DELAYED' || /delay|late/i.test(result.warnings.join(' ')),
          latestMilestone: result.latestEvent,
          lastFreeDate: result.lastFreeDate,
          eventDate: result.eventDate,
          sourceUrl: result.sourceUrl,
          retrievedAt: result.retrievedAt,
          milestones: result.milestones,
          warnings: result.warnings,
          errorMessage: result.errorMessage,
        };

        saveTrackingObservation(obs);
        tracking = obs;
      } catch (err: unknown) {
        console.warn(`[Workflow] READ agent failed for ${shipment.trackingNumber}:`, err);
      }
    }
  }

  // --- STEP 2: DETECT ---
  workflowRecord.currentStep = 'DETECT';
  const liveEtaStr = tracking?.liveEta || shipment.assignedDockSlot;
  const promisedEtaStr = shipment.promisedEta;
  const liveEta = liveEtaStr ? parseIsoOrDate(liveEtaStr) : null;
  const promisedEta = promisedEtaStr ? parseIsoOrDate(promisedEtaStr) : null;

  let isDelayed = tracking?.isDelayed || false;
  let delayMinutes = 0;

  if (liveEta && promisedEta) {
    const diffMs = liveEta.getTime() - promisedEta.getTime();
    delayMinutes = Math.round(diffMs / (60 * 1000));
    if (diffMs > 60 * 60 * 1000) {
      isDelayed = true;
    }
  }

  if (!isDelayed) {
    workflowRecord.currentState = 'COMPLETED';
    workflowRecord.status = 'COMPLETED';
    workflowRecord.currentStep = 'VERIFY';
    workflowRecord.decisionNotes = 'Shipment tracking on schedule. No dock rescheduling required.';
    workflowRecord.notes = workflowRecord.decisionNotes;
    workflowRecord.updatedAt = new Date().toISOString();
    saveShipmentWorkflow(workflowRecord);

    return {
      shipmentId,
      workflow: workflowRecord,
      trackingObservation: tracking,
      message: 'Workflow completed: Shipment is on schedule. No dock adjustment needed.',
    };
  }

  // --- STEP 3: DECIDE ---
  workflowRecord.currentStep = 'DECIDE';
  workflowRecord.currentState = 'APPROVAL_REQUIRED';
  workflowRecord.status = 'AWAITING_APPROVAL';

  const recommendation = evaluateRescheduleDecision({
    shipment,
    revisedEtaIso: liveEtaStr,
  });

  const targetDock: DockId = recommendation.recommendedDockId || recommendation.dockId;
  const targetSlot: string = recommendation.recommendedSlotTime || recommendation.slotTime;

  workflowRecord.proposedDock = targetDock;
  workflowRecord.proposedSlot = targetSlot;
  workflowRecord.recommendedDockId = targetDock;
  workflowRecord.recommendedSlotTime = targetSlot;
  workflowRecord.slotRecommendation = recommendation;
  workflowRecord.decisionNotes = recommendation.reasoning || recommendation.reason;
  workflowRecord.notes = workflowRecord.decisionNotes;
  workflowRecord.rescheduleReason = workflowRecord.decisionNotes;
  workflowRecord.updatedAt = new Date().toISOString();
  saveShipmentWorkflow(workflowRecord);

  return {
    shipmentId,
    workflow: workflowRecord,
    trackingObservation: tracking,
    recommendation,
    message: `Delay detected (+${Math.round(delayMinutes / 60)}h). Slot recommendation prepared: ${targetDock} at ${new Date(targetSlot).toLocaleString()}. Awaiting human gatekeeper approval.`,
  };
}

/**
 * Human Gatekeeper Action:
 * Approves a recommended dock rescheduling and immediately executes TinyFish WRITE agent:
 * APPROVE -> WRITE -> VERIFY
 */
export async function approveAndExecuteWorkflow(
  shipmentId: string,
  operatorNotes?: string
): Promise<WorkflowExecutionResult> {
  const shipment = getShipment(shipmentId);
  if (!shipment) {
    throw new Error(`Shipment "${shipmentId}" not found`);
  }

  const workflow = getShipmentWorkflow(shipmentId);
  const targetDock = workflow?.proposedDock || workflow?.recommendedDockId;
  const targetSlot = workflow?.proposedSlot || workflow?.recommendedSlotTime;

  if (!workflow || !targetDock || !targetSlot) {
    throw new Error(`Shipment "${shipmentId}" does not have a pending slot recommendation to approve.`);
  }

  const now = new Date().toISOString();

  // Step 4: APPROVE
  workflow.currentState = 'WRITING';
  workflow.status = 'APPROVED_PENDING_WRITE';
  workflow.currentStep = 'APPROVE';
  workflow.approvalStatus = 'APPROVED';
  workflow.approvedAt = now;
  workflow.decisionNotes = operatorNotes || 'Approved by logistics operations gatekeeper';
  workflow.notes = workflow.decisionNotes;
  workflow.updatedAt = now;
  saveShipmentWorkflow(workflow);

  // Step 5 & 6: WRITE & VERIFY via autonomous warehouse agent
  workflow.status = 'WRITING_WAREHOUSE';
  workflow.currentStep = 'WRITE';
  workflow.updatedAt = new Date().toISOString();
  saveShipmentWorkflow(workflow);

  const recommendation: SlotRecommendation = workflow.slotRecommendation || {
    dockId: targetDock,
    slotTime: targetSlot,
    reason: workflow.decisionNotes || 'Approved reschedule',
    bufferHours: 4,
    arrivalEta: targetSlot,
    confidence: 'CONFIRMED',
    durationHours: 2,
    conflictDetected: false,
    shipmentId,
    trackingNumber: shipment.trackingNumber,
    originalDockId: (shipment.assignedDock as DockId) || 'Dock A',
    originalSlotTime: shipment.assignedDockSlot || shipment.promisedEta || now,
    recommendedDockId: targetDock,
    recommendedSlotTime: targetSlot,
    delayMinutes: 0,
    reasoning: workflow.decisionNotes,
    alternativeSlots: [],
    demurrageRisk: 'NONE',
  };

  const agentResult = await runWarehouseRescheduleAgent({
    shipment,
    recommendation,
  });

  // Complete & Verified
  workflow.currentState = 'COMPLETED';
  workflow.status = 'COMPLETED';
  workflow.currentStep = 'VERIFY';
  workflow.confirmationId = agentResult.confirmationId;
  workflow.decisionNotes = `Autonomous write completed and verified. Confirmation key: ${agentResult.confirmationId}`;
  workflow.notes = workflow.decisionNotes;
  workflow.updatedAt = new Date().toISOString();
  saveShipmentWorkflow(workflow);

  return {
    shipmentId,
    workflow,
    recommendation,
    message: `Rescheduling executed and verified. Berth ${targetDock} reserved (${agentResult.confirmationId}). Prior reservation safely released.`,
  };
}
