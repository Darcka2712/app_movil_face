# FACE Mobile Fase 3 — Scanner, SQLite, Offline-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three shared engines for the Attendance Kiosk MVP: scanner abstraction, SQLite persistence with migrations, and a durable offline sync queue/engine with idempotent client event IDs — unit-tested without hardware. Live batch sync remains blocked on backend P7 (see `docs/PENDING_BACKEND_CHANGES.md`).

**Architecture:** `packages/scanner` (interfaces + fake + dedupe logic, no native camera yet), `packages/database` (Database interface, MemoryDatabase for tests, Expo SQLite adapter via dynamic import, versioned migrations), `packages/offline-sync` (AttendanceEvent types already partly in shared-types, repository, queue with backoff, SyncEngine with pluggable SyncTransport: ProposedBatchTransport for future `/device/sync` + SingleEventTransport against existing `/device/entrada|salida`). Kiosk wires connectivity check + pending counter only (full UI = Fase 4).

**Tech Stack:** expo-sqlite (optional peer), @react-native-community/netinfo (optional peer), crypto.randomUUID, Jest 29 + ts-jest for packages (same as api-client/auth), TypeScript strict.

## Global Constraints

- Node `>=24.14.0`; TS `strict`; no `any`
- Offline only for attendance (not production/inventory)
- Every syncable event: stable UUID generated **once**; never regenerate on retry
- Persist to SQLite **before** showing "Guardado en dispositivo"
- Distinguish PENDING / SYNCED / REJECTED; never claim server-confirmed without server response
- No tokens/secrets in SQLite or logs
- `packages/*` never import `apps/*`; hardware behind interfaces
- expo-sqlite / NetInfo = optional peer + dynamic import (jest uses Memory*)
- Backend has NO batch sync endpoint — document in ADR-013; SingleEventTransport carries `shortcut:` comment about no server-side eventId dedupe
- Work only under `app-movil/`
- Backoff: exponential + jitter; REJECTED not retried forever; single worker per event (`locked_at`)
- Existing 18/18 doctor tasks must stay green

---

### Task 1: `packages/scanner` — interfaces + fake + dedupe

**Files:**
- Create: `app-movil/packages/scanner/package.json` (name `@face/scanner`, pattern = api-client: type module, jest.config.cjs, ts-jest)
- Create: `app-movil/packages/scanner/tsconfig.json`
- Create: `app-movil/packages/scanner/jest.config.cjs`
- Create: `app-movil/packages/scanner/src/index.ts`
- Create: `app-movil/packages/scanner/src/types.ts`
- Create: `app-movil/packages/scanner/src/dedupe.ts`
- Create: `app-movil/packages/scanner/src/fake-scanner.ts`
- Create: `app-movil/packages/scanner/src/__tests__/dedupe.test.ts`
- Create: `app-movil/packages/scanner/src/__tests__/fake-scanner.test.ts`

**Interfaces:**
- Consumes: nothing (pure)
- Produces: `ScannerSource`, `ScanResult`, `ScannerConfig`, `ScannerService`, `createFakeScanner()`, `createDedupeFilter(windowMs)`
- Command: `pnpm --filter @face/scanner typecheck|test` PASS

- [ ] **Step 1: package.json** — copy api-client package.json, change name to `@face/scanner`, no deps (or only shared-types if re-exporting SyncStatus — not needed).

- [ ] **Step 2: tsconfig.json + jest.config.cjs** — identical pattern to api-client.

- [ ] **Step 3: `src/types.ts`**

```ts
export type ScannerSource = 'camera' | 'hid' | 'native';

export interface ScanResult {
  value: string;
  format: string;
  source: ScannerSource;
  scannedAt: string;
}

export interface ScannerConfig {
  acceptedFormats: string[];
  duplicateWindowMs: number;
}

export interface ScannerService {
  start(config: ScannerConfig): Promise<void>;
  stop(): Promise<void>;
  subscribe(callback: (result: ScanResult) => void): () => void;
}
```

- [ ] **Step 4: `src/dedupe.ts`**

```ts
import type { ScanResult } from './types.js';

export function createDedupeFilter(windowMs: number) {
  const last = new Map<string, number>();

  return (result: ScanResult): boolean => {
    const now = Date.parse(result.scannedAt);
    const prev = last.get(result.value);
    if (prev !== undefined && now - prev < windowMs) {
      return false;
    }
    last.set(result.value, now);
    if (last.size > 500) {
      const cutoff = now - windowMs;
      for (const [k, t] of last) {
        if (t < cutoff) last.delete(k);
      }
    }
    return true;
  };
}
```

- [ ] **Step 5: `src/fake-scanner.ts`**

```ts
import { createDedupeFilter } from './dedupe.js';
import type { ScanResult, ScannerConfig, ScannerService } from './types.js';

export function createFakeScanner(): ScannerService & {
  emit(result: ScanResult): void;
} {
  const listeners = new Set<(r: ScanResult) => void>();
  let filter: ((r: ScanResult) => boolean) | null = null;
  let running = false;

  return {
    async start(config: ScannerConfig) {
      filter = createDedupeFilter(config.duplicateWindowMs);
      running = true;
    },
    async stop() {
      running = false;
      filter = null;
    },
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    emit(result) {
      if (!running || !filter) return;
      if (!filter(result)) return;
      for (const cb of listeners) cb(result);
    },
  };
}
```

- [ ] **Step 6: `src/index.ts`** — export types + createFakeScanner + createDedupeFilter. Extensionless imports (repo pattern).

- [ ] **Step 7: Tests**

`dedupe.test.ts`:
- same value within window → second rejected
- same value after window → accepted
- different values → both accepted

`fake-scanner.test.ts`:
- emit before start → no callback
- start + emit → subscriber receives
- duplicate within window → only one delivery
- unsubscribe → no more callbacks
- stop → emit ignored

- [ ] **Step 8: Verify** `pnpm install && pnpm --filter @face/scanner typecheck && pnpm --filter @face/scanner test`

- [ ] **Step 9: Commit** `feat(scanner): scanner interfaces fake and dedupe`

---

### Task 2: `packages/database` — schema, migrations, MemoryDatabase

**Files:**
- Create: `app-movil/packages/database/package.json` (`@face/database`)
- Create: `app-movil/packages/database/tsconfig.json`, `jest.config.cjs`
- Create: `app-movil/packages/database/src/index.ts`
- Create: `app-movil/packages/database/src/types.ts`
- Create: `app-movil/packages/database/src/migrations/001_init.sql` (or .ts exporting SQL string — **prefer .ts string** to avoid asset loader in jest)
- Create: `app-movil/packages/database/src/migrate.ts`
- Create: `app-movil/packages/database/src/memory-database.ts`
- Create: `app-movil/packages/database/src/expo-database.ts`
- Create: `app-movil/packages/database/src/__tests__/migrate.test.ts`
- Create: `app-movil/packages/database/src/__tests__/memory-database.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface Database { exec(sql): Promise<void>; all<T>(sql, params?): Promise<T[]>; run(sql, params?): Promise<{ changes: number }>; close(): Promise<void>; }`
  - `createMemoryDatabase(): Database` (in-memory table store — **simple approach:** keep rows in Maps keyed by table with naive SQL subset OR implement only the operations migrate+repository need via a thin API)

**Resolution (avoid full SQL engine):** MemoryDatabase implements a **narrow** API used by migrations and repository:
```ts
interface Database {
  exec(sql: string): Promise<void>; // runs migration SQL — memory impl: no-op schema tracking by version
  select<T>(table: string, where?: Record<string, unknown>): Promise<T[]>;
  insert(table: string, row: Record<string, unknown>): Promise<void>;
  update(table: string, where: Record<string, unknown>, patch: Record<string, unknown>): Promise<number>;
  delete(table: string, where: Record<string, unknown>): Promise<number>;
  getMigrations(): Promise<string[]>;
  applyMigration(id: string): Promise<void>;
  close(): Promise<void>;
}
```
Expo adapter maps to real SQL where clauses built by repository (repository builds parameterized SQL for Expo; for Memory, repository can use select/insert helpers).

**Better resolution (keep one repository code path):** Repository always uses SQL strings + params. `MemoryDatabase` parses only the exact SQL patterns the repository issues (fragile) OR repository takes a `EventStore` interface with two impls.

**Chosen:** `EventStore` interface in offline-sync (Task 3), Database package provides:
1. Migration runner + version tracking (`schema_migrations` table)
2. `createMemoryDatabase()` implementing `Database` with **parameterized mini-engine**: `INSERT/SELECT/UPDATE/DELETE` on known tables only — enough for attendance_events, sync_queue, employees_cache, device_config, schema_migrations
3. `createExpoDatabase()` dynamic `expo-sqlite` + same SQL

SQL subset for memory: exact-match WHERE only (`col = ?`), no joins. Repository must only use that subset.

**Schema (001_init):**
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS attendance_events (
  event_id TEXT PRIMARY KEY,
  employee_id INTEGER,
  codigo TEXT,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('ENTRY','EXIT')),
  occurred_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attendance_sync_status ON attendance_events(sync_status);
CREATE INDEX IF NOT EXISTS idx_attendance_occurred_at ON attendance_events(occurred_at);

CREATE TABLE IF NOT EXISTS sync_queue (
  event_id TEXT PRIMARY KEY REFERENCES attendance_events(event_id),
  next_attempt_at TEXT NOT NULL,
  locked_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_next ON sync_queue(next_attempt_at);

CREATE TABLE IF NOT EXISTS employees_cache (
  id_empleado INTEGER PRIMARY KEY,
  codigo_empleado TEXT,
  nombre TEXT,
  apellido_paterno TEXT,
  apellido_materno TEXT,
  cached_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

- [ ] Steps: package scaffolding, types, SQL as exported string, migrate runner, MemoryDatabase, tests (migrate creates tables + idempotent re-run; insert/select/update/delete on attendance_events), Expo adapter stub with dynamic import (not executed in jest).
- [ ] Verify + commit `feat(database): schema migrations and memory database`

---

### Task 3: `packages/offline-sync` — types, repository, queue

**Files:**
- Create: `app-movil/packages/offline-sync/package.json` (`@face/offline-sync`, deps: `@face/database`, `@face/shared-types`)
- Create: tsconfig, jest.config.cjs
- Create: `src/index.ts`, `src/types.ts`, `src/attendance-repository.ts`, `src/sync-queue.ts`
- Create: `src/__tests__/attendance-repository.test.ts`
- Create: `src/__tests__/sync-queue.test.ts`

**Interfaces:**
- Consumes: `Database` from `@face/database`, `SyncStatus` from `@face/shared-types`
- Produces:

```ts
export interface AttendanceEvent {
  eventId: string;
  employeeId: number | null;
  codigo: string | null;
  deviceId: string;
  eventType: 'ENTRY' | 'EXIT';
  occurredAt: string;
  syncStatus: SyncStatus;
  attemptCount: number;
  lastError?: string;
}

export interface AttendanceRepository {
  insert(event: AttendanceEvent): Promise<void>;
  getByEventId(eventId: string): Promise<AttendanceEvent | null>;
  listByStatus(status: SyncStatus, limit: number): Promise<AttendanceEvent[]>;
  updateStatus(eventId: string, status: SyncStatus, patch?: { attemptCount?: number; lastError?: string }): Promise<void>;
  countByStatus(status: SyncStatus): Promise<number>;
}

export interface SyncQueueItem {
  eventId: string;
  nextAttemptAt: string;
  lockedAt: string | null;
}

export interface SyncQueue {
  enqueue(eventId: string, nextAttemptAt: string): Promise<void>;
  claimDue(nowIso: string, limit: number): Promise<SyncQueueItem[]>;
  reschedule(eventId: string, nextAttemptAt: string): Promise<void>;
  release(eventId: string): Promise<void>;
  remove(eventId: string): Promise<void>;
}
```

**Rules tested:**
- insert event + queue in sequence (repository first; engine wraps in one logical operation — memory DB has no real transactions; document `shortcut:` or implement `Database.transaction(fn)` that memory runs sequentially and expo wraps SQLite transaction)
- Add `transaction<T>(fn: () => Promise<T>): Promise<T>` to Database interface — memory: just run fn; expo: BEGIN/COMMIT/ROLLBACK

**Backoff helper** (exported):
```ts
export function computeBackoffMs(attempt: number, baseMs = 5000, maxMs = 15 * 60 * 1000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * exp * 0.2);
  return exp + jitter;
}
```
Test: attempt 1 ~5s±20%, monotonic growth, capped at max.

- [ ] TDD each test file. Verify. Commit `feat(offline-sync): attendance repository and sync queue`

---

### Task 4: SyncEngine + transports

**Files:**
- Create: `src/sync-engine.ts`, `src/transports.ts`
- Create: `src/__tests__/sync-engine.test.ts`
- Create: `src/__tests__/transports.test.ts`
- Modify: `src/index.ts` exports

**Interfaces:**
```ts
export interface SyncTransport {
  sendBatch(events: AttendanceEvent[]): Promise<SyncResult[]>;
}

export interface SyncResult {
  eventId: string;
  status: 'SYNCED' | 'DUPLICATE' | 'REJECTED';
  serverRecordId?: number;
  errorCode?: string;
  message?: string;
}

export class SyncEngine {
  constructor(
    private repo: AttendanceRepository,
    private queue: SyncQueue,
    private transport: SyncTransport,
    private now: () => string,
  ) {}

  async enqueue(event: Omit<AttendanceEvent, 'syncStatus' | 'attemptCount'>): Promise<void>;
  async syncPending(limit?: number): Promise<SyncResult[]>;
  async getPendingCount(): Promise<number>;
}
```

**enqueue:** generate eventId if missing (caller should pass stable id — engine accepts provided eventId; if absent, `crypto.randomUUID()` once), insert repo PENDING + queue in `db.transaction`.

**syncPending:**
1. `claimDue(now, limit ?? 50)`
2. load events; if none → []
3. `transport.sendBatch(events)`
4. For each result: SYNCED/DUPLICATE → updateStatus + queue.remove; REJECTED → updateStatus REJECTED + queue.remove; missing from response → attemptCount++, reschedule backoff
5. On transport throw: for each event attemptCount++, reschedule backoff, release locks
6. Return results

**Transports:**
```ts
export function createProposedBatchTransport(client: HttpClient, deviceId: string): SyncTransport
// POST /device/sync device:true — will 404 until P7; tests mock fetch

export function createSingleEventTransport(client: HttpClient, deviceId: string): SyncTransport
// for each event POST /device/entrada or /device/salida with {codigo|id_empleado, timestamp}
// success → SYNCED; HttpError 4xx → REJECTED; NetworkError → throw to engine
// shortcut: no server-side eventId dedupe — timeout retry may duplicate; upgrade to ProposedBatchTransport when P7 lands
```

**Tests:**
- 3 events all SYNCED → pending 0, queue empty
- 1 REJECTED → stays REJECTED, not in queue, not retried
- transport network fail → attemptCount=1, still PENDING, queue rescheduled
- enqueue twice same eventId → second insert fails or is no-op (PK)
- engine does not regenerate eventId on retry (spy)

- [ ] Commit `feat(offline-sync): sync engine and transports`

---

### Task 5: Connectivity + kiosk wire

**Files:**
- Create: `packages/offline-sync/src/connectivity.ts` (+ test) — or small section in kiosk; **prefer package** for reuse:
  - `interface Connectivity { isOnline(): Promise<boolean> }`
  - `createNetInfoConnectivity()` dynamic import
  - `createMemoryConnectivity(online: boolean)` for tests
- Modify: `apps/attendance-kiosk/package.json` — deps `@face/scanner`, `@face/database`, `@face/offline-sync`, `expo-sqlite` (expo install), `@react-native-community/netinfo` (expo install)
- Create: `apps/attendance-kiosk/src/modules/attendance/services/syncRuntime.ts` — composition root: open DB, migrate, build engine with SingleEventTransport + getHttpClient
- Modify: `app/index.tsx` — pending count display (poll or query)
- Modify: `app/_layout.tsx` — kick `engine.syncPending()` on boot if online (fire-and-forget with catch)

**Tests:** kiosk syncRuntime with Memory* only; existing tests stay green.

- [ ] Verify typecheck+test all. Commit `feat(attendance-kiosk): offline sync runtime wiring`

---

### Task 6: ADR-013 + status + doctor

**Files:**
- Create: `app-movil/docs/adr/ADR-013-offline-sync-batch-contract.md` (contract from P7 + fallback risk)
- Create: `app-movil/docs/PLAN_FASE3_STATUS.md`
- Run: `npx turbo run lint typecheck test --force`

**Status content:**
```markdown
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
```

- [ ] Commit `docs: fase3 status and adr-013`

---

## Out of Scope

| Item | Phase |
|------|-------|
| Camera/HID native adapters | Fase 3b/device or Fase 4 |
| Attendance UI flows | Fase 4 |
| Backend P7 endpoint | Backend (PENDING_BACKEND_CHANGES.md) |
| SQLCipher encryption | Evaluar después |
| Workforce production offline | Fase 5+ |

## Self-Review Notes

- Coverage: scanner ✓, sqlite ✓, queue ✓, engine ✓, connectivity ✓, ADR ✓
- No fake "server confirmed" paths: SingleEventTransport only returns SYNCED on real 2xx
- eventId stability tested
- Placeholder none: Expo SQL uses same statements as memory tests
