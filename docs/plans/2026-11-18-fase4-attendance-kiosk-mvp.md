# FACE Mobile Fase 4 — Attendance Kiosk MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End-to-end kiosk attendance flow in attendance-kiosk: download employee cache, scan/manual credential, resolve employee offline, decide ENTRY/EXIT locally, persist via SyncEngine before showing "Guardado en dispositivo", display sync states, operational status screen. Camera adapter behind interface (device-dependent tests deferred).

**Architecture:** Feature module `src/modules/attendance/` with services (employee-cache, attendance-usecase, clock helper), screens (home scan, status), and wiring into existing syncRuntime. Employee cache fills `employees_cache` from `GET /device/empleados`. Attendance use-case: resolve codigo → local ENTRY/EXIT rule → `SyncEngine.enqueue` → UI feedback. Scanner: manual codigo input primary for testable MVP; `createCameraScanner` dynamic expo-camera adapter with interface parity to `@face/scanner` (device smoke deferred to P6).

**Tech Stack:** Existing @face/* packages, TanStack Query optional for refresh, React Native components (no NativeWind yet), Jest, expo-router.

## Global Constraints

- TS strict, no `any`; no secrets in logs/UI
- Persist event (SQLite via SyncEngine.enqueue) **before** showing "Guardado en dispositivo"
- UI copy: never show "confirmado por servidor" unless SYNCED after real response
- Local ENTRY/EXIT rule (client heuristic; backend remains authority on sync):
  - No local ENTRY today for employee → ENTRY
  - Local ENTRY without EXIT today → EXIT
  - ENTRY+EXIT already → error "Jornada cerrada hoy"
- Employee only resolved from `employees_cache` (or explicit id); unknown codigo → clear error
- Download employees only when online; cache usable offline
- Manual codigo entry always available (MVP without camera hardware)
- Camera adapter: dynamic import expo-camera, not hard dep; tests use FakeScanner
- Existing doctor green; kiosk tests stay green
- Work only under `app-movil/`
- deviceId for events: from device key context — use `'kiosk'` placeholder as today OR read from bootstrap; keep consistent with SingleEventTransport
- occurredAt: ISO 8601 with offset from device clock (document clock risk; no retroactive alter)

---

### Task 1: Employee cache service

**Files:**
- Create: `apps/attendance-kiosk/src/modules/attendance/services/employeeCache.ts`
- Create: `apps/attendance-kiosk/src/modules/attendance/services/__tests__/employeeCache.test.ts`
- Modify: `packages/database` — only if employees_cache helpers missing (select/insert already generic — no schema change)

**Interfaces:**
- Consumes: `listEmpleados` from `deviceApi.ts`, `Database` from `@face/database`
- Produces:
```ts
export interface EmployeeCacheEntry {
  id_empleado: number;
  codigo_empleado: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
}
export class EmployeeCache {
  constructor(db: Database);
  refreshFromServer(employees: EmployeeCacheEntry[]): Promise<number>; // upsert + cached_at
  findByCodigo(codigo: string): Promise<EmployeeCacheEntry | null>; // UPPER trim match
  count(): Promise<number>;
}
export async function syncEmployeeCache(client, db): Promise<number>; // listEmpleados → refresh
```
- Tests: upsert replaces by id, findByCodigo case-insensitive trim, empty server list, count

- [ ] TDD → typecheck+test → commit `feat(attendance): employee cache service`

---

### Task 2: Attendance use-case (ENTRY/EXIT + enqueue)

**Files:**
- Create: `src/modules/attendance/services/attendanceUsecase.ts`
- Create: `src/modules/attendance/services/__tests__/attendanceUsecase.test.ts`

**Interfaces:**
```ts
export type AttendanceOutcome =
  | { ok: true; eventId: string; eventType: 'ENTRY' | 'EXIT' }
  | { ok: false; code: 'UNKNOWN_EMPLOYEE' | 'DAY_CLOSED' | 'NO_DEVICE_KEY' | 'ENQUEUE_FAILED'; message: string };

export interface AttendanceDeps {
  cache: EmployeeCache;
  engine: SyncEngine;
  now: () => Date;
}

export async function recordAttendance(
  deps: AttendanceDeps,
  rawCodigo: string,
): Promise<AttendanceOutcome>;
```

**Logic:**
1. `codigo = rawCodigo.trim().toUpperCase()`; empty → ENQUEUE_FAILED/UNKNOWN
2. `findByCodigo` → null → UNKNOWN_EMPLOYEE
3. Local day key = `now().toISOString().slice(0,10)` (UTC date — **document shortcut:** timezone; prefer local date via offset-aware helper `localDateKey(now)`)
4. Query engine's repo `listByStatus` is wrong filter — need events by employee+day: add `AttendanceRepository.findByEmployeeAndDay(employeeId, dayKey)` **or** filter `listByStatus('PENDING'|'SYNCED', 500)` in use-case. **Resolution:** add repo method `findForEmployeeDay(employeeId, dayIsoDate): Promise<AttendanceEvent[]>` (filter in JS OK for memory; comment shortcut)
5. Determine type from events where occurredAt startsWith day (after localDateKey):
   - no ENTRY → ENTRY
   - ENTRY, no EXIT → EXIT
   - EXIT present → DAY_CLOSED
6. `engine.enqueue({ eventId: crypto.randomUUID(), employeeId, codigo, deviceId: 'kiosk', eventType, occurredAt: now.toISOString() })`
7. Return ok + eventId

**Tests:** unknown codigo; entry first; exit after entry; day closed; enqueue called with stable shape; uppercase normalize.

- [ ] Commit `feat(attendance): entry-exit use case with local rules`

---

### Task 3: Manual entry + home screen

**Files:**
- Create: `src/modules/attendance/screens/HomeScreen.tsx`
- Create: `src/modules/attendance/screens/__tests__/HomeScreen.test.tsx` (optional — if RN testing heavy, test pure logic only; Home thin)
- Modify: `app/index.tsx` → render HomeScreen
- Modify: `package.json` if `@testing-library/react-native` needed — **prefer pure logic tests; HomeScreen minimal**

**UI (minimal, StyleSheet):**
- Title FACE Attendance
- TextInput `codigo` + button `Registrar`
- Result area: success → green "Guardado en dispositivo" + eventType label; error → red message
- Pending count (existing) + link/button to Status
- On success: clear input, refresh pending count

**Wiring:** use getKioskSyncRuntime + EmployeeCache singleton (compose in `attendanceRuntime.ts` similar to syncRuntime).

- [ ] Commit `feat(attendance): home screen manual credential entry`

---

### Task 4: Status screen (sync states)

**Files:**
- Create: `src/modules/attendance/screens/StatusScreen.tsx`
- Create: `src/modules/attendance/services/__tests__/statusSummary.test.ts`
- Create: `src/modules/attendance/services/statusSummary.ts`
- Modify: `app/_layout.tsx` — Stack screens: index + status; or index embeds navigation button via `router.push('/status')`
- Create: `app/status.tsx` (expo-router route)

**statusSummary:**
```ts
export interface StatusSummary { pending: number; synced: number; rejected: number; }
export async function loadStatusSummary(repo: AttendanceRepository): Promise<StatusSummary>;
```
(counts by status; REJECTED listed for "Requiere revisión")

**StatusScreen:** three counters, `Sincronizar ahora` button → syncNow + reload, list last 20 events (eventId short, codigo, type, status) — list from repo optional if time; **MVP: counters + sync button + rejected count prominent**.

- [ ] Commit `feat(attendance): status screen with sync states`

---

### Task 5: Camera scanner adapter (interface only + optional UI)

**Files:**
- Create: `src/modules/attendance/scanner/createCameraScanner.ts`
- Create: `src/modules/attendance/scanner/__tests__/createCameraScanner.test.ts` (mock expo-camera module)
- Modify: HomeScreen — secondary "Escanear" button only if camera available (try/catch dynamic import); manual remains primary

**createCameraScanner:** implements `ScannerService` from `@face/scanner`; dynamic `import('expo-camera')`; subscribe emits ScanResult source:'camera'. Not installed yet → factory returns null / throws typed → Home hides button.

**Tests:** factory without module → null; with mocked module → start/stop/subscribe delegate.

- [ ] Commit `feat(attendance): camera scanner adapter behind interface`

---

### Task 6: Status doc + doctor

**Files:**
- Create: `docs/PLAN_FASE4_STATUS.md`
- Run: `npx turbo run lint typecheck test --force`

**Status checkboxes:** employee cache, use-case, home manual, status screen, camera adapter stub; open: camera on device, expo-sqlite durable swap (P6), live backend sync, stress 100 events, kiosk mode MDM.

- [ ] Commit `docs: fase4 status`

---

## Out of Scope
| Item | Where |
|------|-------|
| expo-sqlite durable swap | P6 / follow-up |
| Real camera QR on tablet | P6 device |
| Kiosk Lock Task / MDM | After P6 provisioning |
| Maestro E2E | After device |
| Batch P7 backend | PENDING_BACKEND_CHANGES |

## Self-Review
- Persist-before-confirm: use-case enqueue then UI success ✓ (tests assert enqueue before return ok)
- ENTRY/EXIT local rules tested ✓
- Unknown employee no enqueue ✓
- No server-confirm copy ✓
- Camera not hard dep ✓
