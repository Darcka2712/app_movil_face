# ADR-011: X-Device-Key pre-provisioned for Attendance Kiosk MVP

## Status
Accepted 2026-11-18

## Context
Backend already implements device auth via X-Device-Key (SHA256 hash),
revocation, license, and implicit heartbeat. No mobile self-registration
endpoint exists. Offline batch sync with eventId does not exist yet.

## Decision
MVP kiosk authenticates exclusively with X-Device-Key provisioned by
admin via POST /api/v1/dispositivos. No changes to backend auth.
No JWT for kiosk session. No self-registration endpoint in Fase 1-4.

## Consequences
- Zero backend auth changes to ship Fase 1-4 shells and device flows
- Lost/stolen key → admin PATCH /:id/revocar or /:id/regenerar
- Batch offline sync endpoint deferred; requires separate ADR + approval
