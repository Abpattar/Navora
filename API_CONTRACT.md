# FREIGHTCOMMAND — Complete API Specification & Contracts

All external web scraping and carrier communications are executed securely on the server; the `TINYFISH_API_KEY` is never transmitted to client browsers.

---

## 1. System & Health

### `GET /api/health`
Verifies backend operational status, database connectivity, and `TINYFISH_API_KEY` configuration.

**Response (200 OK):**
```json
{
  "ok": true,
  "service": "freightcommand",
  "version": "1.0.0",
  "tinyfishConfigured": true,
  "databaseStatus": "connected",
  "checkedAt": "2026-10-30T12:00:00.000Z"
}
```

---

## 2. Manifest Operations

### `POST /api/manifest/upload`
Uploads and parses a multipart `.xlsx`, `.xls`, or `.csv` spreadsheet manifest using SheetJS with automatic column matching.

**Request:** `multipart/form-data` with form field `file`.

**Response (200 OK):**
```json
{
  "success": true,
  "filename": "sample-manifest.xlsx",
  "summary": {
    "totalRows": 5,
    "validRows": 5,
    "invalidRows": 0,
    "duplicateCount": 0
  },
  "rows": [
    {
      "rowId": "row-1",
      "shipmentId": "SHP-IN-8921",
      "trackingNumber": "MSKU9070323",
      "carrier": "maersk",
      "carrierRaw": "Maersk Line",
      "origin": "Shanghai Port, China",
      "destination": "JNPT Nhava Sheva, India",
      "promisedEta": "2026-11-02T08:00:00.000Z",
      "assignedDock": "Dock A",
      "isValid": true,
      "errors": []
    }
  ]
}
```

### `POST /api/manifest/commit`
Persists verified manifest rows into the SQLite database and enqueues them for background tracking.

**Request Body (JSON):**
```json
{
  "rows": [
    {
      "shipmentId": "SHP-IN-8921",
      "trackingNumber": "MSKU9070323",
      "carrier": "maersk",
      "origin": "Shanghai Port, China",
      "destination": "JNPT Nhava Sheva, India",
      "promisedEta": "2026-11-02T08:00:00.000Z",
      "assignedDock": "Dock A"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "committedCount": 5,
  "enqueuedCount": 5
}
```

### `GET /api/manifest/export`
Generates and downloads an enriched spreadsheet preserving all original client columns alongside real-time tracking, SLA delay differences, demurrage liability, and dock confirmation keys.

**Query Parameters:**
- `format`: `xlsx` (default) or `csv`

---

## 3. Shipments & Intelligence

### `GET /api/shipments/enriched`
Returns all tracked shipments enriched with UN/LOCODE coordinates, SLA risk level, demurrage estimates, and dock booking status.

**Response (200 OK):**
```json
{
  "success": true,
  "count": 5,
  "shipments": [
    {
      "id": "uuid-here",
      "shipmentId": "SHP-IN-8921",
      "trackingNumber": "MSKU9070323",
      "carrier": "maersk",
      "carrierName": "Maersk Line",
      "origin": "Shanghai Port, China",
      "destination": "JNPT Nhava Sheva, India",
      "promisedEta": "2026-11-02T08:00:00.000Z",
      "assignedDock": "Dock A",
      "tracking": {
        "status": "IN_TRANSIT",
        "latestEvent": "Vessel departed Shanghai Port",
        "location": "Shanghai Port",
        "estimatedArrival": "2026-11-04T12:00:00.000Z",
        "lookupStatus": "success",
        "sourceUrl": "https://www.maersk.com/tracking/"
      },
      "location": {
        "latitude": 31.2304,
        "longitude": 121.4737,
        "accuracy": "PORT_APPROXIMATE",
        "source": "UN/LOCODE CNSHA (Shanghai Port)"
      },
      "sla": {
        "isBreached": true,
        "riskLevel": "HIGH",
        "reason": "Vessel delayed by 52 hours past promised delivery window"
      },
      "demurrage": {
        "daysOverdue": 2,
        "dailyRate": 120,
        "currency": "USD",
        "estimatedDemurrage": 240
      },
      "dockBooking": {
        "dockId": "Dock A",
        "slotTime": "2026-11-02T08:00:00.000Z",
        "status": "CONFIRMED",
        "confirmationId": "WH-CONF-1793342170339"
      }
    }
  ]
}
```

### `POST /api/shipments/track-sse`
Executes a TinyFish carrier web agent with real-time Server-Sent Events (SSE) streaming for the Live Agent Inspector.

**Request Body (JSON):**
```json
{
  "carrier": "maersk",
  "trackingNumber": "MSKU9070323",
  "shipmentId": "uuid-here"
}
```

**SSE Stream Events:**
- `STARTED`: Run initiated with runId.
- `STREAMING_URL`: Live simulated browser DOM stream URL.
- `LOG`: Agent action log entries (DOM clicks, navigation, extraction).
- `PROGRESS`: Current milestone or status updates.
- `COMPLETE`: Structured JSON result conforming to `TRACKING_OUTPUT_SCHEMA`.

---

## 4. Concurrency Queue

### `GET /api/queue/status`
Returns real-time queue concurrency metrics across the server instance.

**Response (200 OK):**
```json
{
  "activeCount": 1,
  "maxConcurrency": 2,
  "pendingCount": 4,
  "completedCount": 12,
  "failedCount": 0
}
```

---

## 5. Warehouse Rescheduling & Safety

### `GET /api/warehouse/slots`
Queries available unloading slots for Docks A–D for a specific calendar date.

**Query Parameters:**
- `date`: `YYYY-MM-DD` (e.g. `2026-11-04`)

**Response (200 OK):**
```json
{
  "date": "2026-11-04",
  "docks": [
    {
      "dockId": "Dock A",
      "slots": [
        { "slotTime": "2026-11-04T08:00:00Z", "isAvailable": true },
        { "slotTime": "2026-11-04T10:00:00Z", "isAvailable": false, "bookingId": "..." }
      ]
    }
  ]
}
```

### `POST /api/warehouse/reschedule-agent`
Autonomous rescheduling agent endpoint enforcing the **Atomic Booking Failsafe**. It verifies slot availability, creates a replacement reservation with a unique confirmation ID, and only transitions the prior reservation after replacement confirmation is verified.

**Request Body (JSON):**
```json
{
  "shipmentId": "SHP-IN-8921",
  "originalBookingId": "orig-booking-uuid",
  "requestedSlotTime": "2026-11-04T14:00:00Z",
  "preferredDockId": "Dock B",
  "reason": "Vessel delayed by 52 hours"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "replacementBooking": {
    "id": "new-booking-uuid",
    "shipmentId": "SHP-IN-8921",
    "dockId": "Dock B",
    "slotTime": "2026-11-04T14:00:00Z",
    "status": "CONFIRMED",
    "confirmationId": "WH-CONF-REPL-1793342170339",
    "originalBookingId": "orig-booking-uuid"
  },
  "priorBookingStatus": "RESCHEDULED"
}
```

---

## 6. Maritime Disruption Intelligence

### `GET /api/intelligence/disruptions`
Returns active weather disruptions, port strikes, and maritime congestion mapped to active shipments.

**Response (200 OK):**
```json
{
  "success": true,
  "disruptions": [
    {
      "id": "disrupt-1",
      "port": "JNPT Nhava Sheva",
      "type": "CONGESTION",
      "severity": "HIGH",
      "description": "Berthing delays of 2-3 days due to seasonal monsoon container surges.",
      "estimatedDelayHours": 48,
      "affectedShipmentsCount": 2
    }
  ]
}
```

---

## 7. Central Autonomous Workflow Pipeline

### `POST /api/workflow/execute`
Initiates or advances the full autonomous operations workflow for a target shipment:
**READ** (carrier telemetry) &rarr; **DETECT** (delay/SLA breach analysis) &rarr; **DECIDE** (warehouse berth availability & capacity optimization). If delay is confirmed, pauses at the human approval gate (`APPROVAL_REQUIRED` / `AWAITING_APPROVAL`).

**Request Body (JSON):**
```json
{
  "shipmentId": "SHP-IN-8921"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "shipmentId": "SHP-IN-8921",
  "workflow": {
    "id": "wf-uuid-123",
    "shipmentId": "SHP-IN-8921",
    "trackingNumber": "MSKU9070323",
    "carrier": "maersk",
    "currentState": "APPROVAL_REQUIRED",
    "currentStep": "DECIDE",
    "proposedDock": "Dock B",
    "proposedSlot": "2026-11-04T10:00:00.000Z",
    "approvalStatus": "PENDING",
    "decisionNotes": "Revised ETA requires +4h vessel discharge buffer. Optimal berth Dock B avoids conflict."
  },
  "message": "Delay detected (+24h). Slot recommendation prepared: Dock B at 11/4/2026. Awaiting human gatekeeper approval."
}
```

---

### `POST /api/workflow/approve`
Human operations gatekeeper action. Confirms the recommended dock rescheduling and immediately dispatches the TinyFish WRITE browser automation agent to execute the transaction:
**APPROVE** &rarr; **WRITE** (interact with `/warehouse-portal/reschedule`) &rarr; **VERIFY** (validate authoritative `WH-CONF-...` key and release prior booking).

**Request Body (JSON):**
```json
{
  "shipmentId": "SHP-IN-8921",
  "notes": "Approved by logistics shift supervisor"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "shipmentId": "SHP-IN-8921",
  "workflow": {
    "id": "wf-uuid-123",
    "currentState": "COMPLETED",
    "currentStep": "VERIFY",
    "approvalStatus": "APPROVED",
    "confirmationId": "WH-CONF-DockB-582914"
  },
  "message": "Rescheduling executed and verified. Berth Dock B reserved (WH-CONF-DockB-582914). Prior reservation safely released."
}
```

---

### `GET /api/workflow/status`
Queries the live workflow state for a specific shipment or lists all active workflows across the enterprise.

**Query Parameters:**
- `shipmentId` (optional): Query workflow for a single shipment. Omit to list all workflows.

**Response (200 OK):**
```json
{
  "success": true,
  "workflow": {
    "shipmentId": "SHP-IN-8921",
    "currentState": "COMPLETED",
    "currentStep": "VERIFY",
    "confirmationId": "WH-CONF-DockB-582914",
    "updatedAt": "2026-10-30T14:40:00.000Z"
  }
}
```

---

### `POST /api/warehouse/reschedule-booking`
Atomic transaction endpoint operated by TinyFish browser automation or manual operators on `/warehouse-portal/reschedule`. Safely persists replacement booking and verifies confirmation token before retiring prior booking.

**Request Body (JSON):**
```json
{
  "shipmentId": "SHP-IN-8921",
  "replacementDockId": "Dock B",
  "replacementSlotTime": "2026-11-04T10:00:00.000Z",
  "reason": "Carrier transit delay mitigation"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "confirmationId": "WH-CONF-DockB-839201",
  "booking": {
    "id": "book-uuid-new",
    "shipmentId": "SHP-IN-8921",
    "dockId": "Dock B",
    "slotTime": "2026-11-04T10:00:00.000Z",
    "status": "CONFIRMED",
    "confirmationId": "WH-CONF-DockB-839201"
  }
}
```

