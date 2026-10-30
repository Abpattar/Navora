# FREIGHTCOMMAND — Hackathon Presentation & Demonstration Script

A 3-minute, high-impact demonstration script structured around the core lifecycle:
**`IMPORT → READ → DETECT → MAP → ANALYZE → ACT → REPORT`**.

---

## 1. Opening Hook (0:00 – 0:30)

> "In global shipping, logistics teams manually reconcile thousands of container rows across fragmented ocean portals. Delays cause missed warehouse unloading slots, customs holds, and tens of thousands of dollars in carrier demurrage penalties.
>
> We built **FREIGHTCOMMAND**: an autonomous logistics intelligence and operations command center that turns static freight manifests into active, self-reconciling operations."

- **Action:** Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).
- Point to the live KPI cards: **Active Containers**, **SLA Breaches**, **Financial Demurrage Liability ($)**, **Warehouse Utilization (%)**, and **Live Agent Workers**.

---

## 2. Ingestion & Auto-Column Mapping (0:30 – 1:00)

> "Operations starts with a messy shipping manifest. FreightCommand ingests Excel or CSV files without requiring manual column formatting."

- **Action:** Navigate to **`/batch`**.
- Click the blue **`✨ Load Demo Manifest`** button (or drag & drop `sample-manifest.xlsx`).
- Show the auto-detected headers: `Container Number`, `Carrier`, `Origin`, `Destination`, `Promised ETA`, `Assigned Dock`.
- Click **`Commit 5 Shipments & Begin Tracking`**.

---

## 3. Autonomous Carrier Web Agents (1:00 – 1:40)

> "Unlike traditional systems that rely on fake data or fragile mock scrapers, FreightCommand dispatches autonomous TinyFish web agents directly to official carrier portals under a strict concurrency guardrail of max 2 simultaneous agents."

- **Action:** Navigate to **`/agent-console`**.
- Show the live **streaming execution terminal**, the **DOM browser window**, and the **milestone action timeline**.
- Highlight that the agent extracts real status milestones, event locations, and live revised ETAs directly from official carrier sources without fabricating GPS.

---

## 4. Geospatial Intelligence & SLA Risk Detection (1:40 – 2:10)

> "Extracted milestone locations are resolved against a verified UN/LOCODE database of 100+ global seaports and ICD hubs—never hallucinated."

- **Action:** Click **`/live-map`**.
- Show the global container map with custom vessel markers and geodesic route arcs connecting Shanghai, Rotterdam, Hamburg, JNPT Nhava Sheva, Mundra, and Los Angeles.
- Filter by carrier or SLA risk level (`CRITICAL`, `BREACHED`, `ON_TIME`).
- Click a container pin to inspect the modal popup card with real UN/LOCODE coordinates and milestone lineage.

---

## 5. Demurrage Calculation & Failsafe Warehouse Rescheduling (2:10 – 2:40)

> "When a vessel is delayed past its delivery window, demurrage starts accruing daily. Here's our autonomous closed-loop execution: the system detects the SLA breach and negotiates a new warehouse dock slot."

- **Action:** Navigate to **`/warehouse-portal`**.
- Show the 4-dock capacity matrix (Docks A–D).
- Click **Reschedule** on a delayed shipment or demonstrate the autonomous rescheduling endpoint.
- **Emphasize the Safety Failsafe:** *"The system guarantees transactional safety: the original dock booking is NEVER cancelled until a replacement slot is confirmed with an authoritative confirmation key (`WH-CONF-...`)."*
- View the audit trail in **`/warehouse-portal/bookings`** displaying the replacement confirmation ID and lineage.

---

## 6. Closing & Enriched Spreadsheet Export (2:40 – 3:00)

> "At any time, operations managers can export an audit-ready master manifest. Every original client column is preserved alongside computed SLA delays, demurrage exposure, and new dock confirmations."

- **Action:** Click **`Enriched Excel (.xlsx)`** in the top navigation or on `/batch`.
- Show that all original columns are retained alongside new intelligence fields.
- Conclude: *"FREIGHTCOMMAND delivers true autonomous freight operations: verifiable ground truth, zero fake data, and failsafe execution."*

---

## Judge FAQ Cheatsheet

- **Q: Are the GPS coordinates real?**
  *A: Yes. All coordinates originate either directly from carrier telemetry or from our verified UN/LOCODE database of over 100 global and Indian ports. If a location is unverified, it reports `UNKNOWN` with null coordinates—never fabricated.*
- **Q: How do you handle carrier rate limits?**
  *A: An instance-wide singleton queue enforces a hard ceiling of max 2 concurrent TinyFish agent sessions.*
- **Q: What database is used?**
  *A: Node.js 24 native `node:sqlite` in WAL mode with connection busy timeouts—zero external database setup required.*
