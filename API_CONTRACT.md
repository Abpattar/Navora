# API contract

All lookup calls happen on the server; the TinyFish key must never be sent to the client.

## `GET /api/health`

Example response:

```json
{
  "ok": true,
  "service": "global-freight-command-center",
  "tinyfishConfigured": false,
  "checkedAt": "SERVER_GENERATED_ISO_TIMESTAMP",
  "note": "Key presence is checked only. A real agent run is required to verify upstream access."
}
```

## `POST /api/shipments/track`

Request:

```json
{
  "carrier": "maersk",
  "trackingNumber": "REFERENCE_ENTERED_BY_USER"
}
```

Response shape:

```json
{
  "success": true,
  "result": {
    "id": "server-generated-uuid",
    "carrier": "maersk",
    "carrierName": "Maersk",
    "trackingNumber": "REFERENCE_ENTERED_BY_USER",
    "lookupStatus": "success",
    "status": null,
    "latestEvent": null,
    "location": null,
    "eventDate": null,
    "estimatedArrival": null,
    "origin": null,
    "destination": null,
    "lastFreeDate": null,
    "milestones": [],
    "sourceUrl": "OFFICIAL_CARRIER_TRACKING_URL",
    "retrievedAt": "SERVER_GENERATED_ISO_TIMESTAMP",
    "warnings": []
  }
}
```

The nulls above are illustrative of the contract, not shipment data. Fields should be populated only when actually retrieved.

`lookupStatus` is one of:
- `success`
- `not_found`
- `needs_login`
- `blocked`
- `unsupported`
- `error`

A carrier lookup may return HTTP 200 and a `result` with a non-success `lookupStatus` when the agent completed but the shipment wasn't accessible/found. Request validation errors return 400. Missing API key returns 503. Upstream/agent failures return 502 and timeouts return 504.

## `POST /api/shipments/track-batch`

Request:

```json
{
  "items": [
    { "carrier": "maersk", "trackingNumber": "REFERENCE_A" },
    { "carrier": "msc", "trackingNumber": "REFERENCE_B" }
  ]
}
```

Maximum five items. Results contain `index`, `success`, and either `result` or `error`. The index corresponds to the input order. At most two TinyFish jobs are executed concurrently.
