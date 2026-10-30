import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { INIT_SCHEMA_SQL } from './schema';
import type {
  AgentEvent,
  AgentRun,
  DisruptionAlert,
  DockBooking,
  EnrichedShipment,
  RescheduleAction,
  Shipment,
  ShipmentLocation,
  ShipmentTracking,
} from '@/lib/types';
import { calculateEtaComparison } from '@/lib/logistics/eta-calculator';
import { assessSlaRisk } from '@/lib/logistics/sla-detector';
import { calculateDemurrageAndDetention } from '@/lib/logistics/demurrage-calculator';

let databaseInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (databaseInstance) return databaseInstance;

  const dataDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'freightcommand.db');
  databaseInstance = new DatabaseSync(dbPath);
  databaseInstance.exec('PRAGMA journal_mode = WAL;');
  databaseInstance.exec('PRAGMA busy_timeout = 5000;');
  databaseInstance.exec('PRAGMA foreign_keys = ON;');
  databaseInstance.exec(INIT_SCHEMA_SQL);

  return databaseInstance;
}

// -------------------------------------------------------------
// Shipments Persistence
// -------------------------------------------------------------

export function saveShipment(shipment: Shipment): Shipment {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO shipments (
      id, manifest_id, shipment_id, tracking_number, carrier, carrier_name,
      origin, destination, promised_eta, assigned_dock, assigned_dock_slot, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      shipment_id = excluded.shipment_id,
      tracking_number = excluded.tracking_number,
      carrier = excluded.carrier,
      carrier_name = excluded.carrier_name,
      origin = excluded.origin,
      destination = excluded.destination,
      promised_eta = excluded.promised_eta,
      assigned_dock = excluded.assigned_dock,
      assigned_dock_slot = excluded.assigned_dock_slot,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    shipment.id,
    shipment.manifestId ?? null,
    shipment.shipmentId,
    shipment.trackingNumber,
    shipment.carrier,
    shipment.carrierName,
    shipment.origin ?? null,
    shipment.destination ?? null,
    shipment.promisedEta ?? null,
    shipment.assignedDock ?? null,
    shipment.assignedDockSlot ?? null,
    shipment.notes ?? null,
    shipment.createdAt,
    shipment.updatedAt
  );

  return shipment;
}

export function getShipment(id: string): Shipment | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM shipments WHERE id = ? OR shipment_id = ?').get(id, id) as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: String(row.id),
    manifestId: row.manifest_id ? String(row.manifest_id) : undefined,
    shipmentId: String(row.shipment_id),
    trackingNumber: String(row.tracking_number),
    carrier: row.carrier as any,
    carrierName: String(row.carrier_name),
    origin: row.origin ? String(row.origin) : null,
    destination: row.destination ? String(row.destination) : null,
    promisedEta: row.promised_eta ? String(row.promised_eta) : null,
    assignedDock: row.assigned_dock ? String(row.assigned_dock) : null,
    assignedDockSlot: row.assigned_dock_slot ? String(row.assigned_dock_slot) : null,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listShipments(): Shipment[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM shipments ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    manifestId: row.manifest_id ? String(row.manifest_id) : undefined,
    shipmentId: String(row.shipment_id),
    trackingNumber: String(row.tracking_number),
    carrier: row.carrier as any,
    carrierName: String(row.carrier_name),
    origin: row.origin ? String(row.origin) : null,
    destination: row.destination ? String(row.destination) : null,
    promisedEta: row.promised_eta ? String(row.promised_eta) : null,
    assignedDock: row.assigned_dock ? String(row.assigned_dock) : null,
    assignedDockSlot: row.assigned_dock_slot ? String(row.assigned_dock_slot) : null,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export function deleteShipment(id: string): boolean {
  const db = getDb();
  db.prepare('DELETE FROM shipments WHERE id = ?').run(id);
  db.prepare('DELETE FROM tracking_observations WHERE shipment_id = ?').run(id);
  db.prepare('DELETE FROM dock_bookings WHERE shipment_id = ?').run(id);
  db.prepare('DELETE FROM reschedule_actions WHERE shipment_id = ?').run(id);
  return true;
}

// -------------------------------------------------------------
// Tracking Observations Persistence
// -------------------------------------------------------------

export function saveTrackingObservation(tracking: ShipmentTracking): ShipmentTracking {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tracking_observations (
      id, shipment_id, tracking_number, carrier, carrier_name, lookup_status,
      current_status, raw_status, current_location, live_eta, is_delayed,
      latest_milestone, last_free_date, event_date, source_url, retrieved_at,
      milestones_json, warnings_json, error_message, agent_run_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      lookup_status = excluded.lookup_status,
      current_status = excluded.current_status,
      raw_status = excluded.raw_status,
      current_location = excluded.current_location,
      live_eta = excluded.live_eta,
      is_delayed = excluded.is_delayed,
      latest_milestone = excluded.latest_milestone,
      last_free_date = excluded.last_free_date,
      event_date = excluded.event_date,
      source_url = excluded.source_url,
      retrieved_at = excluded.retrieved_at,
      milestones_json = excluded.milestones_json,
      warnings_json = excluded.warnings_json,
      error_message = excluded.error_message,
      agent_run_id = excluded.agent_run_id
  `);

  stmt.run(
    tracking.id,
    tracking.shipmentId,
    tracking.trackingNumber,
    tracking.carrier,
    tracking.carrierName,
    tracking.lookupStatus,
    tracking.currentStatus,
    tracking.rawStatus ?? null,
    tracking.currentLocation ?? null,
    tracking.liveEta ?? null,
    tracking.isDelayed ? 1 : 0,
    tracking.latestMilestone ?? null,
    tracking.lastFreeDate ?? null,
    tracking.eventDate ?? null,
    tracking.sourceUrl,
    tracking.retrievedAt,
    JSON.stringify(tracking.milestones || []),
    JSON.stringify(tracking.warnings || []),
    tracking.errorMessage ?? null,
    tracking.agentRunId ?? null
  );

  return tracking;
}

export function getLatestTracking(shipmentId: string): ShipmentTracking | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM tracking_observations
    WHERE shipment_id = ? OR tracking_number = ?
    ORDER BY retrieved_at DESC LIMIT 1
  `).get(shipmentId, shipmentId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: String(row.id),
    shipmentId: String(row.shipment_id),
    trackingNumber: String(row.tracking_number),
    carrier: row.carrier as any,
    carrierName: String(row.carrier_name),
    lookupStatus: row.lookup_status as any,
    currentStatus: row.current_status as any,
    rawStatus: row.raw_status ? String(row.raw_status) : null,
    currentLocation: row.current_location ? String(row.current_location) : null,
    liveEta: row.live_eta ? String(row.live_eta) : null,
    isDelayed: Boolean(row.is_delayed),
    latestMilestone: row.latest_milestone ? String(row.latest_milestone) : null,
    lastFreeDate: row.last_free_date ? String(row.last_free_date) : null,
    eventDate: row.event_date ? String(row.event_date) : null,
    sourceUrl: String(row.source_url),
    retrievedAt: String(row.retrieved_at),
    milestones: row.milestones_json ? JSON.parse(String(row.milestones_json)) : [],
    warnings: row.warnings_json ? JSON.parse(String(row.warnings_json)) : [],
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    agentRunId: row.agent_run_id ? String(row.agent_run_id) : undefined,
  };
}

// -------------------------------------------------------------
// Geo Coordinates Cache
// -------------------------------------------------------------

export function getCachedCoordinates(locationQuery: string): ShipmentLocation | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM geo_coordinates WHERE location_query = ?').get(locationQuery.trim().toLowerCase()) as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    accuracy: row.accuracy as any,
    source: String(row.source),
    resolvedAt: String(row.resolved_at),
    resolvedName: row.resolved_name ? String(row.resolved_name) : null,
  };
}

export function saveCachedCoordinates(locationQuery: string, location: ShipmentLocation): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO geo_coordinates (id, location_query, latitude, longitude, accuracy, source, resolved_at, resolved_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(location_query) DO UPDATE SET
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy = excluded.accuracy,
      source = excluded.source,
      resolved_at = excluded.resolved_at,
      resolved_name = excluded.resolved_name
  `);
  stmt.run(
    crypto.randomUUID(),
    locationQuery.trim().toLowerCase(),
    location.latitude,
    location.longitude,
    location.accuracy,
    location.source,
    location.resolvedAt,
    location.resolvedName
  );
}

// -------------------------------------------------------------
// Dock Bookings Persistence
// -------------------------------------------------------------

export function createDockBooking(booking: DockBooking): DockBooking {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO dock_bookings (
      id, shipment_id, tracking_number, carrier_name, dock_id, slot_time,
      status, confirmation_id, original_booking_id, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      dock_id = excluded.dock_id,
      slot_time = excluded.slot_time,
      status = excluded.status,
      confirmation_id = excluded.confirmation_id,
      original_booking_id = excluded.original_booking_id,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    booking.id,
    booking.shipmentId,
    booking.trackingNumber,
    booking.carrierName,
    booking.dockId,
    booking.slotTime,
    booking.status,
    booking.confirmationId,
    booking.originalBookingId ?? null,
    booking.notes ?? null,
    booking.createdAt,
    booking.updatedAt
  );

  return booking;
}

export function getDockBookingByShipment(shipmentId: string): DockBooking | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM dock_bookings
    WHERE (shipment_id = ? OR tracking_number = ?) AND status != 'CANCELLED'
    ORDER BY created_at DESC LIMIT 1
  `).get(shipmentId, shipmentId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: String(row.id),
    shipmentId: String(row.shipment_id),
    trackingNumber: String(row.tracking_number),
    carrierName: String(row.carrier_name),
    dockId: row.dock_id as any,
    slotTime: String(row.slot_time),
    status: row.status as any,
    confirmationId: String(row.confirmation_id),
    originalBookingId: row.original_booking_id ? String(row.original_booking_id) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listDockBookings(): DockBooking[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM dock_bookings ORDER BY slot_time ASC').all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    shipmentId: String(row.shipment_id),
    trackingNumber: String(row.tracking_number),
    carrierName: String(row.carrier_name),
    dockId: row.dock_id as any,
    slotTime: String(row.slot_time),
    status: row.status as any,
    confirmationId: String(row.confirmation_id),
    originalBookingId: row.original_booking_id ? String(row.original_booking_id) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export function updateDockBookingStatus(id: string, status: DockBooking['status']): void {
  const db = getDb();
  db.prepare('UPDATE dock_bookings SET status = ?, updated_at = ? WHERE id = ?').run(
    status,
    new Date().toISOString(),
    id
  );
}

// -------------------------------------------------------------
// Reschedule Actions Persistence
// -------------------------------------------------------------

export function createRescheduleAction(action: RescheduleAction): RescheduleAction {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO reschedule_actions (
      id, shipment_id, tracking_number, carrier, original_booking_id,
      original_slot_time, original_dock_id, recommended_dock_id,
      recommended_slot_time, status, confirmation_id, reason, error,
      created_at, executed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      confirmation_id = excluded.confirmation_id,
      error = excluded.error,
      executed_at = excluded.executed_at
  `);

  stmt.run(
    action.id,
    action.shipmentId,
    action.trackingNumber,
    action.carrier,
    action.originalBookingId,
    action.originalSlotTime,
    action.originalDockId,
    action.recommendedDockId,
    action.recommendedSlotTime,
    action.status,
    action.confirmationId ?? null,
    action.reason,
    action.error ?? null,
    action.createdAt,
    action.executedAt ?? null
  );

  return action;
}

export function getRescheduleAction(id: string): RescheduleAction | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM reschedule_actions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: String(row.id),
    shipmentId: String(row.shipment_id),
    trackingNumber: String(row.tracking_number),
    carrier: row.carrier as any,
    originalBookingId: String(row.original_booking_id),
    originalSlotTime: String(row.original_slot_time),
    originalDockId: row.original_dock_id as any,
    recommendedDockId: row.recommended_dock_id as any,
    recommendedSlotTime: String(row.recommended_slot_time),
    status: row.status as any,
    confirmationId: row.confirmation_id ? String(row.confirmation_id) : undefined,
    reason: String(row.reason),
    error: row.error ? String(row.error) : undefined,
    createdAt: String(row.created_at),
    executedAt: row.executed_at ? String(row.executed_at) : undefined,
  };
}

export function listRescheduleActions(): RescheduleAction[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM reschedule_actions ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    shipmentId: String(row.shipment_id),
    trackingNumber: String(row.tracking_number),
    carrier: row.carrier as any,
    originalBookingId: String(row.original_booking_id),
    originalSlotTime: String(row.original_slot_time),
    originalDockId: row.original_dock_id as any,
    recommendedDockId: row.recommended_dock_id as any,
    recommendedSlotTime: String(row.recommended_slot_time),
    status: row.status as any,
    confirmationId: row.confirmation_id ? String(row.confirmation_id) : undefined,
    reason: String(row.reason),
    error: row.error ? String(row.error) : undefined,
    createdAt: String(row.created_at),
    executedAt: row.executed_at ? String(row.executed_at) : undefined,
  }));
}

// -------------------------------------------------------------
// Agent Runs & Events Persistence
// -------------------------------------------------------------

export function createAgentRun(run: AgentRun): AgentRun {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO agent_runs (
      id, run_id, agent_type, target_shipment_id, target_reference,
      status, start_time, end_time, streaming_url, extracted_output_json,
      error, confirmation_id, steps_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      status = excluded.status,
      end_time = excluded.end_time,
      streaming_url = excluded.streaming_url,
      extracted_output_json = excluded.extracted_output_json,
      error = excluded.error,
      confirmation_id = excluded.confirmation_id,
      steps_count = excluded.steps_count
  `);

  stmt.run(
    run.id,
    run.runId,
    run.agentType,
    run.targetShipmentId ?? null,
    run.targetReference ?? null,
    run.status,
    run.startTime,
    run.endTime ?? null,
    run.streamingUrl ?? null,
    run.extractedOutput ? JSON.stringify(run.extractedOutput) : null,
    run.error ?? null,
    run.confirmationId ?? null,
    run.stepsCount
  );

  return run;
}

export function updateAgentRun(runId: string, partial: Partial<AgentRun>): void {
  const db = getDb();
  const current = db.prepare('SELECT * FROM agent_runs WHERE run_id = ?').get(runId) as Record<string, unknown> | undefined;
  if (!current) return;

  const status = String(partial.status ?? current.status);
  const endTime = partial.endTime !== undefined ? (partial.endTime ?? null) : (current.end_time ? String(current.end_time) : null);
  const streamingUrl = partial.streamingUrl !== undefined ? (partial.streamingUrl ?? null) : (current.streaming_url ? String(current.streaming_url) : null);
  const extractedOutput = partial.extractedOutput !== undefined ? JSON.stringify(partial.extractedOutput) : (current.extracted_output_json ? String(current.extracted_output_json) : null);
  const error = partial.error !== undefined ? (partial.error ?? null) : (current.error ? String(current.error) : null);
  const confirmationId = partial.confirmationId !== undefined ? (partial.confirmationId ?? null) : (current.confirmation_id ? String(current.confirmation_id) : null);
  const stepsCount = Number(partial.stepsCount ?? current.steps_count ?? 0);

  db.prepare(`
    UPDATE agent_runs SET
      status = ?, end_time = ?, streaming_url = ?, extracted_output_json = ?,
      error = ?, confirmation_id = ?, steps_count = ?
    WHERE run_id = ?
  `).run(status, endTime, streamingUrl, extractedOutput, error, confirmationId, stepsCount, runId);
}

export function getAgentRun(runId: string): AgentRun | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM agent_runs WHERE run_id = ? OR id = ?').get(runId, runId) as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: String(row.id),
    runId: String(row.run_id),
    agentType: row.agent_type as any,
    targetShipmentId: row.target_shipment_id ? String(row.target_shipment_id) : undefined,
    targetReference: row.target_reference ? String(row.target_reference) : undefined,
    status: row.status as any,
    startTime: String(row.start_time),
    endTime: row.end_time ? String(row.end_time) : undefined,
    streamingUrl: row.streaming_url ? String(row.streaming_url) : undefined,
    extractedOutput: row.extracted_output_json ? JSON.parse(String(row.extracted_output_json)) : undefined,
    error: row.error ? String(row.error) : undefined,
    confirmationId: row.confirmation_id ? String(row.confirmation_id) : undefined,
    stepsCount: Number(row.steps_count || 0),
  };
}

export function listAgentRuns(limit = 50): AgentRun[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM agent_runs ORDER BY start_time DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    runId: String(row.run_id),
    agentType: row.agent_type as any,
    targetShipmentId: row.target_shipment_id ? String(row.target_shipment_id) : undefined,
    targetReference: row.target_reference ? String(row.target_reference) : undefined,
    status: row.status as any,
    startTime: String(row.start_time),
    endTime: row.end_time ? String(row.end_time) : undefined,
    streamingUrl: row.streaming_url ? String(row.streaming_url) : undefined,
    extractedOutput: row.extracted_output_json ? JSON.parse(String(row.extracted_output_json)) : undefined,
    error: row.error ? String(row.error) : undefined,
    confirmationId: row.confirmation_id ? String(row.confirmation_id) : undefined,
    stepsCount: Number(row.steps_count || 0),
  }));
}

export function appendAgentEvent(event: AgentEvent): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO agent_events (id, run_id, type, timestamp, message, payload_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.runId,
    event.type,
    event.timestamp,
    event.message,
    event.payload ? JSON.stringify(event.payload) : null
  );
}

export function getAgentEvents(runId: string): AgentEvent[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM agent_events WHERE run_id = ? ORDER BY timestamp ASC').all(runId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    runId: String(row.run_id),
    type: row.type as any,
    timestamp: String(row.timestamp),
    message: String(row.message),
    payload: row.payload_json ? JSON.parse(String(row.payload_json)) : undefined,
  }));
}

// -------------------------------------------------------------
// Disruption Alerts Persistence
// -------------------------------------------------------------

export function saveDisruptionAlert(alert: DisruptionAlert): DisruptionAlert {
  const db = getDb();
  db.prepare(`
    INSERT INTO disruption_alerts (
      id, title, category, affected_location, severity, summary, source, published_at, related_shipment_ids_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      severity = excluded.severity,
      summary = excluded.summary,
      related_shipment_ids_json = excluded.related_shipment_ids_json
  `).run(
    alert.id,
    alert.title,
    alert.category,
    alert.affectedLocation,
    alert.severity,
    alert.summary,
    alert.source,
    alert.publishedAt,
    JSON.stringify(alert.relatedShipmentIds || [])
  );
  return alert;
}

export function listDisruptionAlerts(): DisruptionAlert[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM disruption_alerts ORDER BY published_at DESC').all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    category: row.category as any,
    affectedLocation: String(row.affected_location),
    severity: row.severity as any,
    summary: String(row.summary),
    source: String(row.source),
    publishedAt: String(row.published_at),
    relatedShipmentIds: row.related_shipment_ids_json ? JSON.parse(String(row.related_shipment_ids_json)) : [],
  }));
}

// -------------------------------------------------------------
// Composite Enriched Shipments
// -------------------------------------------------------------

export function getEnrichedShipments(): EnrichedShipment[] {
  const shipments = listShipments();
  return shipments.map((shipment) => {
    const tracking = getLatestTracking(shipment.id);
    const booking = getDockBookingByShipment(shipment.id) || undefined;
    
    // Calculate live SLA Risk & Demurrage if tracking info is available
    const sla = tracking?.liveEta && shipment.promisedEta
      ? assessSlaRisk(shipment.promisedEta, tracking.liveEta, tracking.currentStatus)
      : undefined;

    const demurrage = tracking
      ? calculateDemurrageAndDetention({
          status: tracking.currentStatus,
          liveEta: tracking.liveEta,
          lastFreeDate: tracking.lastFreeDate,
          carrier: shipment.carrier,
        })
      : undefined;

    return {
      shipment,
      tracking: tracking || undefined,
      booking,
      sla,
      demurrage,
    };
  });
}
