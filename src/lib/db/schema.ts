export const INIT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  manifest_id TEXT,
  shipment_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  carrier_name TEXT NOT NULL,
  origin TEXT,
  destination TEXT,
  promised_eta TEXT,
  assigned_dock TEXT,
  assigned_dock_slot TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON shipments(carrier);

CREATE TABLE IF NOT EXISTS tracking_observations (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  carrier_name TEXT NOT NULL,
  lookup_status TEXT NOT NULL,
  current_status TEXT NOT NULL,
  raw_status TEXT,
  current_location TEXT,
  live_eta TEXT,
  is_delayed INTEGER NOT NULL DEFAULT 0,
  latest_milestone TEXT,
  last_free_date TEXT,
  event_date TEXT,
  source_url TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  milestones_json TEXT,
  warnings_json TEXT,
  error_message TEXT,
  agent_run_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_tracking_shipment ON tracking_observations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tracking_reference ON tracking_observations(tracking_number);

CREATE TABLE IF NOT EXISTS geo_coordinates (
  id TEXT PRIMARY KEY,
  location_query TEXT UNIQUE NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy TEXT NOT NULL,
  source TEXT NOT NULL,
  resolved_at TEXT NOT NULL,
  resolved_name TEXT
);

CREATE TABLE IF NOT EXISTS dock_bookings (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  carrier_name TEXT NOT NULL,
  dock_id TEXT NOT NULL,
  slot_time TEXT NOT NULL,
  status TEXT NOT NULL,
  confirmation_id TEXT UNIQUE NOT NULL,
  original_booking_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_shipment ON dock_bookings(shipment_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dock_slot ON dock_bookings(dock_id, slot_time);

CREATE TABLE IF NOT EXISTS reschedule_actions (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  original_booking_id TEXT NOT NULL,
  original_slot_time TEXT NOT NULL,
  original_dock_id TEXT NOT NULL,
  recommended_dock_id TEXT NOT NULL,
  recommended_slot_time TEXT NOT NULL,
  status TEXT NOT NULL,
  confirmation_id TEXT,
  reason TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL,
  executed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_reschedule_shipment ON reschedule_actions(shipment_id);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  run_id TEXT UNIQUE NOT NULL,
  agent_type TEXT NOT NULL,
  target_shipment_id TEXT,
  target_reference TEXT,
  status TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  streaming_url TEXT,
  extracted_output_json TEXT,
  error TEXT,
  confirmation_id TEXT,
  steps_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_run_id ON agent_runs(run_id);

CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_events_run_id ON agent_events(run_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS disruption_alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  affected_location TEXT NOT NULL,
  severity TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TEXT NOT NULL,
  related_shipment_ids_json TEXT
);
`;
