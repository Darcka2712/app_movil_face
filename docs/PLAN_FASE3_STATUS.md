# Fase 3 Status

- [x] @face/scanner interfaces + fake + dedupe
- [x] @face/database schema + migrations + MemoryDatabase + Expo adapter
- [x] @face/offline-sync repository + queue + backoff
- [x] SyncEngine + ProposedBatchTransport (mock) + SingleEventTransport
- [x] Connectivity wrapper + kiosk wiring (pending counter)
- [x] ADR-013 batch contract proposal
- [ ] Live batch sync (blocked on backend P7)
- [ ] Camera adapter (expo-camera) — needs device
- [ ] HID scanner — needs device
- [ ] expo run:android (P6 machine setup)
- [ ] Stress test 100 events offline + restart (Fase 4 criteria)

## Doctor

`npx turbo run lint typecheck test --force`: **27/27 tasks green** — 9 packages × 3 tasks (6 face packages + 3 apps). No blocking fixes needed.

## Out of Scope (later)

| Item | Phase |
|------|-------|
| Camera/HID native adapters | Fase 3b/device or Fase 4 |
| Attendance UI flows | Fase 4 |
| Backend P7 endpoint | Backend (PENDING_BACKEND_CHANGES.md) |
| SQLCipher encryption | Evaluar después |
| Workforce production offline | Fase 5+ |
