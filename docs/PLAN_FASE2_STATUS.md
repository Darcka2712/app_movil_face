# Fase 2 Status

- [x] @face/api-client — HttpClient, HttpError/NetworkError, envelope unwrap
- [x] @face/auth — SecureStorage, CredentialStore, login/fetchMe/logout contracts
- [x] ADR-012 JWT refresh cookie-only gap documented
- [x] docs/API_CONTRACTS.md verified against backend
- [x] attendance-kiosk: QueryClientProvider + device key hydration + deviceApi
- [ ] Real device key provisioned on tablet (admin flow)
- [ ] Live login against running backend (optional for kiosk path)
- [ ] Fase 3: scanner, sqlite, offline-sync (needs sync endpoint ADR)

## Doctor

`pnpm doctor` (typecheck + lint + test): **18/18 tasks green** — 6 packages × 3 tasks.

Blocking fixes applied in this task:

- `eslint.config.mjs`: `module`/`exports` globals now cover `**/*.config.cjs` (jest configs were failing `no-undef`).
- `packages/api-client/src/__tests__/client.test.ts`: dropped unused `HttpError` import.

## Out of Scope (later)

| Item | Phase |
|------|-------|
| Offline sync batch + eventId | Fase 3 (needs backend endpoint + ADR) |
| Scanner/camera | Fase 3 |
| SQLite | Fase 3 |
| Attendance flows UI | Fase 4 |
| JWT silent refresh | Blocked on ADR-012 backend decision |
| Workforce/Inventory feature modules | Fase 5-6 |
