# ADR-013: Offline sync batch contract (`POST /api/v1/device/sync`)

## Status
Proposed 2026-11-18 — contract only, no backend implementation. Blocks live
batch sync (Fase 3 open item; P7 in `docs/PENDING_BACKEND_CHANGES.md`).

## Context
Attendance Kiosk must survive offline periods: events persist in SQLite
(`@face/database`) and drain through a durable queue (`@face/offline-sync`).
Backend today exposes only individual `POST /api/v1/device/entrada` and
`POST /api/v1/device/salida` — no batch endpoint, no server-side `eventId`
dedupe. `SingleEventTransport` therefore carries the risk documented in
`packages/offline-sync/src/transports.ts`: a timeout-then-retry can create a
duplicate attendance record, because the server cannot recognize a re-sent
event.

Batch sync is the fix: one request carries many events, each with a stable
client-generated `eventId`, and the server answers per event.

## Decision
Proposed contract (same as P7):

```http
POST /api/v1/device/sync
X-Device-Key: <key>
```

Request:

```json
{
  "events": [
    {
      "eventId": "uuid-v4",
      "employeeId": 120,
      "eventType": "ENTRY",
      "occurredAt": "2026-11-18T07:00:00-06:00",
      "deviceId": "string"
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "eventId": "uuid-v4",
        "status": "SYNCED",
        "serverRecordId": 456
      }
    ]
  }
}
```

Backend requirements:

- `UNIQUE(eventId)` (global or tenant, per data model)
- Re-send of same `eventId` → previous result (`DUPLICATE`)
- Same `eventId` with incompatible payload → auditable conflict (409)
- Validation + persistence inside one transaction
- Per-`eventId` result inside the batch response
- Batch size limit (e.g. 100)
- Documented functional rejection codes

Client side is ready: `createProposedBatchTransport(client, deviceId)` in
`packages/offline-sync/src/transports.ts` targets this endpoint and is
unit-tested against mocked fetch. It will 404 until the backend lands.

## Consequences
- Until P7 exists, kiosk drains via `SingleEventTransport` against
  `/device/entrada|salida`: no server-side dedupe, retry after timeout may
  duplicate (`shortcut:` comment in `transports.ts`).
- `eventId` generated once per event and never regenerated on retry —
  prerequisite for server dedupe; already enforced by `SyncEngine` + tests.
- Backend change requires design + approval before implementation
  (architecture rule); P7 marked ALTO in `PENDING_BACKEND_CHANGES.md`.
- Batch limit 100 aligns with Fase 4 stress criterion (100 events offline).
