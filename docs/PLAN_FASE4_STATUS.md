# Fase 4 Status

## Done (unit-tested)
- [x] Employee cache download + offline findByCodigo
- [x] recordAttendance ENTRY/EXIT local rules + persist-before-confirm
- [x] HomeScreen manual credential → "Guardado en dispositivo"
- [x] StatusScreen Pendientes/Sincronizados/Requiere revisión + sync button
- [x] Camera scanner adapter interface (inert until expo-camera installed)

## Open (need device/backend)
- [ ] expo-sqlite + NetInfo durable swap (P6) — events currently Memory-only
- [ ] expo-camera install + CameraView ingest (P6)
- [ ] expo run:android + tablet smoke (P6, RUNBOOK_ANDROID.md)
- [ ] Live sync against real backend (SingleEventTransport; P7 for batch idempotency)
- [ ] Stress: 100 events offline + force close + restart (needs durable SQLite)
- [ ] Kiosk Lock Task / MDM provisioning
- [ ] HID reader strategy
