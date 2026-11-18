# FACE Mobile Fase 1 — Monorepo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurable, compilable pnpm + Turborepo monorepo in `app-movil/` with three Expo Android shells (attendance-kiosk, workforce, inventory), one shared package, strict TS, lint, tests, env per app, and documented scripts — no business logic yet.

**Architecture:** pnpm workspaces root at `app-movil/`. Three independent Expo SDK 58 apps under `apps/*`, each with own `applicationId` and `app.config.ts`. Shared code only under `packages/*` via public `src/index.ts` exports. Backend auth untouched; device identity = X-Device-Key pre-provisioned by admin (decision D1 approved).

**Tech Stack:** Expo SDK 58.0.x, React Native 0.88.x, React 19.x, TypeScript 5.x strict, pnpm 10.x workspaces, Turborepo 2.x, Jest 29 (shared-types) / Jest 30 (Expo apps via jest-expo ~58), ESLint 9 flat config, expo-router 6.x.

## Global Constraints

- Node `>=24.14.0` (aligns with backend engines after fix; local = 24.14.0)
- Expo SDK 58.x only; pin exact versions in `pnpm-lock.yaml`; no major bumps without tests
- Android first; `applicationId`: kiosk=`com.facenexus.attendance`, workforce=`com.facenexus.workforce`, inventory=`com.facenexus.inventory`
- TypeScript `strict: true`, no `any` without documented justification
- No secrets in code or `EXPO_PUBLIC_*`; no tokens in AsyncStorage/SQLite
- No empty packages/folders; each package exposes `src/index.ts`
- `apps/*` may import `packages/*`; `packages/*` never import `apps/*`
- Offline sync/scanner/printer/DB packages NOT created in Fase 1 (YAGNI — Fase 3+)
- No commits to backend-main; work only under `app-movil/`
- Response format backend: `{success, data}`; API base path `/api/v1`
- Device auth header: `X-Device-Key` (approved path, no auth backend changes)
- Architecture authority: `app-movil/FACE_MOBILE_ARCHITECTURE.md`
- Plan location override: `app-movil/docs/plans/` (project docs live there)

---

### Task 1: Bootstrap monorepo root

**Files:**
- Create: `app-movil/package.json`
- Create: `app-movil/pnpm-workspace.yaml`
- Create: `app-movil/turbo.json`
- Create: `app-movil/tsconfig.base.json`
- Create: `app-movil/.gitignore`
- Create: `app-movil/.npmrc`
- Create: `app-movil/README.md`
- Create: `app-movil/docs/adr/ADR-011-x-device-key-mvp.md`

**Interfaces:**
- Consumes: empty `app-movil/` (only architecture .md files present)
- Produces: root workspace runnable via `pnpm install`; turbo tasks `lint`, `typecheck`, `test`

- [ ] **Step 1: Install pnpm via corepack**

```powershell
corepack enable
corepack prepare pnpm@10.18.2 --activate
pnpm --version
```

Expected: `10.18.2` (or ≥10). If corepack fails: `npm install -g pnpm@10.18.2`.

- [ ] **Step 2: Init git only if app-movil is not already a repo**

```powershell
Test-Path "C:\Users\ZARAGOZA051\Desktop\nexus\app-movil\.git"
# if False:
git init
```

Expected: `Initialized empty Git repository` or `True`.

- [ ] **Step 3: Write root `package.json`**

```json
{
  "name": "face-mobile",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@10.18.2",
  "engines": {
    "node": ">=24.14.0"
  },
  "scripts": {
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "build": "turbo run build",
    "doctor": "turbo run typecheck lint test"
  },
  "devDependencies": {
    "turbo": "2.5.4",
    "typescript": "5.9.3"
  }
}
```

- [ ] **Step 4: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 5: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "lint": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^typecheck"],
      "outputs": ["coverage/**"]
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".expo/**"]
    }
  }
}
```

- [ ] **Step 6: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "es2022",
    "lib": ["es2022"]
  },
  "exclude": ["node_modules"]
}
```

- [ ] **Step 7: Write `.npmrc` and `.gitignore`**

`.npmrc`:

```ini
node-linker=hoisted
strict-peer-dependencies=false
```

`.gitignore`:

```gitignore
node_modules/
.expo/
dist/
coverage/
*.log
.env
.env.*
!.env.example
android/
ios/
.DS_Store
```

Note: `.npmrc` `node-linker=hoisted` keeps Metro/Expo resolution predictable in workspaces.

- [ ] **Step 8: Write ADR-011 (device identity decision)**

Create `app-movil/docs/adr/ADR-011-x-device-key-mvp.md`:

```markdown
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
```

- [ ] **Step 9: Write root `README.md`**

```markdown
# FACE Mobile Platform

Monorepo for FACE Nexus mobile apps (Android first).

## Requirements
- Node >= 24.14.0
- pnpm 10.x (corepack)
- Android SDK / Expo tooling for device builds

## Commands
| Command | Purpose |
|---------|---------|
| pnpm install | Install workspace deps |
| pnpm lint | ESLint all packages |
| pnpm typecheck | TypeScript all packages |
| pnpm test | Jest all packages |
| pnpm build | Build all packages |
| pnpm --filter attendance-kiosk start | Run kiosk app |

## Structure
- apps/attendance-kiosk — FACE Attendance (com.facenexus.attendance)
- apps/workforce — FACE Workforce (com.facenexus.workforce)
- apps/inventory — FACE Inventory (com.facenexus.inventory)
- packages/shared-types — Shared TypeScript types only

## Authority
See FACE_MOBILE_ARCHITECTURE.md and docs/adr/.
```

- [ ] **Step 10: Install root deps and verify turbo**

```powershell
Set-Location "C:\Users\ZARAGOZA051\Desktop\nexus\app-movil"
pnpm install
pnpm exec turbo --version
```

Expected: turbo installs; `--version` prints 2.5.4.

- [ ] **Step 11: Commit**

```powershell
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore .npmrc README.md docs/adr/
git commit -m "chore: bootstrap face-mobile monorepo root"
```

---

### Task 2: `packages/shared-types`

**Files:**
- Create: `app-movil/packages/shared-types/package.json`
- Create: `app-movil/packages/shared-types/tsconfig.json`
- Create: `app-movil/packages/shared-types/src/index.ts`
- Create: `app-movil/packages/shared-types/src/device.ts`
- Create: `app-movil/packages/shared-types/src/api.ts`
- Create: `app-movil/packages/shared-types/src/__tests__/shared-types.test.ts`
- Create: `app-movil/packages/shared-types/jest.config.js`

**Interfaces:**
- Consumes: root `tsconfig.base.json`, turbo tasks
- Produces:
  - package name `@face/shared-types`
  - exports: `DeviceType`, `DeviceIdentity`, `ApiSuccess`, `ApiError`, `SyncStatus` (type only, used later)
  - command `pnpm --filter @face/shared-types test` PASS

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@face/shared-types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "devDependencies": {
    "@types/jest": "29.5.14",
    "jest": "29.7.0",
    "ts-jest": "29.4.5",
    "typescript": "5.9.3",
    "eslint": "9.39.1",
    "typescript-eslint": "8.46.2"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `src/device.ts`**

```ts
export type DeviceType = 'KIOSK' | 'WORKFORCE' | 'INVENTORY';

export type DeviceStatus = 'ACTIVE' | 'BLOCKED';

export interface DeviceIdentity {
  deviceId: string;
  deviceType: DeviceType;
  appVersion: string;
  platform: 'ANDROID';
  registeredAt?: string;
  status: DeviceStatus;
}
```

- [ ] **Step 4: Write `src/api.ts`**

```ts
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  timestamp?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'REJECTED';
```

- [ ] **Step 5: Write `src/index.ts`**

```ts
export type { DeviceType, DeviceStatus, DeviceIdentity } from './device.js';
export type { ApiSuccess, ApiError, ApiResponse, SyncStatus } from './api.js';
```

- [ ] **Step 6: Write `jest.config.js`**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

- [ ] **Step 7: Write failing-then-passing test `src/__tests__/shared-types.test.ts`**

```ts
import type { DeviceIdentity, ApiResponse, SyncStatus } from '../index';

describe('@face/shared-types', () => {
  it('DeviceIdentity accepts kiosk shape', () => {
    const d: DeviceIdentity = {
      deviceId: 'device_1',
      deviceType: 'KIOSK',
      appVersion: '0.1.0',
      platform: 'ANDROID',
      status: 'ACTIVE',
    };
    expect(d.deviceType).toBe('KIOSK');
  });

  it('ApiResponse discriminates success', () => {
    const ok: ApiResponse<number> = { success: true, data: 1 };
    const bad: ApiResponse<number> = { success: false, error: 'X', message: 'm' };
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });

  it('SyncStatus union is closed', () => {
    const s: SyncStatus = 'PENDING';
    expect(['PENDING', 'SYNCING', 'SYNCED', 'REJECTED']).toContain(s);
  });
});
```

- [ ] **Step 8: Install deps and run typecheck + test**

```powershell
Set-Location "C:\Users\ZARAGOZA051\Desktop\nexus\app-movil"
pnpm install
pnpm --filter @face/shared-types typecheck
pnpm --filter @face/shared-types test
```

Expected: typecheck clean; jest 3/3 PASS.

- [ ] **Step 9: Commit**

```powershell
git add packages/shared-types
git commit -m "feat(shared-types): device and api response types"
```

---

### Task 3: Attendance Kiosk Expo shell

**Files:**
- Create: `app-movil/apps/attendance-kiosk/package.json`
- Create: `app-movil/apps/attendance-kiosk/app.config.ts`
- Create: `app-movil/apps/attendance-kiosk/tsconfig.json`
- Create: `app-movil/apps/attendance-kiosk/babel.config.js`
- Create: `app-movil/apps/attendance-kiosk/jest.config.js`
- Create: `app-movil/apps/attendance-kiosk/.env.example`
- Create: `app-movil/apps/attendance-kiosk/app/_layout.tsx`
- Create: `app-movil/apps/attendance-kiosk/app/index.tsx`
- Create: `app-movil/apps/attendance-kiosk/src/config/env.ts`
- Create: `app-movil/apps/attendance-kiosk/src/config/__tests__/env.test.ts`

**Interfaces:**
- Consumes: `@face/shared-types` (workspace), root turbo, Expo SDK 58
- Produces:
  - app name `attendance-kiosk`, script `start`, `android`, `test`, `typecheck`, `lint`
  - `com.facenexus.attendance`
  - env export: `getEnv()` → `{ apiBaseUrl, environment }`
  - command `pnpm --filter attendance-kiosk test` PASS
  - command `pnpm --filter attendance-kiosk typecheck` PASS

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "attendance-kiosk",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "@face/shared-types": "workspace:*",
    "@expo/metro-runtime": "~58.0.17",
    "expo": "~58.0.25",
    "expo-constants": "~58.0.16",
    "expo-linking": "~58.0.17",
    "expo-router": "~58.0.32",
    "expo-status-bar": "~58.0.5",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-native": "0.88.1",
    "react-native-safe-area-context": "~5.11.1",
    "react-native-screens": "~4.30.1"
  },
  "devDependencies": {
    "@babel/core": "^7.29.7",
    "@types/jest": "^30.0.0",
    "@types/react": "~19.3.0",
    "eslint": "9.39.1",
    "jest": "~30.5.2",
    "jest-expo": "~58.0.0",
    "typescript": "5.9.3",
    "typescript-eslint": "8.46.2"
  }
}
```

Note: exact RN/expo-router patch versions re-pinned with SDK 58 set during execution (plan seeds corrected). Lockfile is source of truth.

- [ ] **Step 2: Write `app.config.ts`**

```ts
import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FACE Attendance',
  slug: 'face-attendance-kiosk',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'faceattendance',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  android: {
    package: 'com.facenexus.attendance',
    versionCode: 1,
    permissions: ['CAMERA', 'INTERNET'],
  },
  plugins: ['expo-router'],
  extra: {
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api/v1',
  },
});
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", "app.config.ts", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 4: Write `babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 5: Write `jest.config.js`**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

- [ ] **Step 6: Write `.env.example`**

```bash
EXPO_PUBLIC_ENVIRONMENT=development
EXPO_PUBLIC_API_BASE_URL=http://localhost:3002/api/v1
```

- [ ] **Step 7: Write `src/config/env.ts`**

```ts
export interface AppEnv {
  environment: 'development' | 'staging' | 'production';
  apiBaseUrl: string;
}

const ALLOWED = new Set(['development', 'staging', 'production']);

export function getEnv(): AppEnv {
  const environment = process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development';
  if (!ALLOWED.has(environment)) {
    throw new Error(`Invalid EXPO_PUBLIC_ENVIRONMENT: ${environment}`);
  }
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required');
  }
  if (environment !== 'development' && !apiBaseUrl.startsWith('https://')) {
    throw new Error('apiBaseUrl must use HTTPS outside development');
  }
  return { environment: environment as AppEnv['environment'], apiBaseUrl };
}
```

- [ ] **Step 8: Write env test `src/config/__tests__/env.test.ts`**

```ts
describe('getEnv', () => {
  const OLD = process.env;

  beforeEach(() => {
    process.env = { ...OLD };
  });

  afterAll(() => {
    process.env = OLD;
  });

  it('defaults to development with localhost allowed', () => {
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'development';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3002/api/v1';
    expect(getEnv()).toEqual({
      environment: 'development',
      apiBaseUrl: 'http://localhost:3002/api/v1',
    });
  });

  it('rejects http outside development', () => {
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'production';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://insecure.example/api/v1';
    expect(() => getEnv()).toThrow(/HTTPS/);
  });

  it('rejects unknown environment', () => {
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'qa';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://ok.example/api/v1';
    expect(() => getEnv()).toThrow(/Invalid EXPO_PUBLIC_ENVIRONMENT/);
  });

  it('requires apiBaseUrl', () => {
    process.env.EXPO_PUBLIC_ENVIRONMENT = 'development';
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(() => getEnv()).toThrow(/required/);
  });
});

import { getEnv } from '../env';
```

Note: put `import { getEnv } from '../env';` at top of file in implementation (shown last here only to keep test body visible first — final file must start with the import).

- [ ] **Step 9: Write Expo Router screens `app/_layout.tsx` and `app/index.tsx`**

`app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```

`app/index.tsx`:

```tsx
import { Text, View, StyleSheet } from 'react-native';
import { getEnv } from '../src/config/env';

export default function Home() {
  const env = getEnv();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FACE Attendance</Text>
      <Text testID="env-label">{env.environment}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
});
```

- [ ] **Step 10: Install and pin Expo versions**

```powershell
Set-Location "C:\Users\ZARAGOZA051\Desktop\nexus\app-movil"
pnpm install
Set-Location apps/attendance-kiosk
npx expo install --fix
Set-Location ../..
pnpm install
```

Expected: lockfile updated; no peer dependency hard failures.

- [ ] **Step 11: Verify typecheck + test**

```powershell
pnpm --filter attendance-kiosk typecheck
pnpm --filter attendance-kiosk test
```

Expected: typecheck clean; env tests 4/4 PASS.

- [ ] **Step 12: Verify Expo config resolves**

```powershell
Set-Location "C:\Users\ZARAGOZA051\Desktop\nexus\app-movil\apps\attendance-kiosk"
npx expo config --type public
```

Expected: prints config with `android.package = "com.facenexus.attendance"`.

- [ ] **Step 13: Commit**

```powershell
git add apps/attendance-kiosk pnpm-lock.yaml
git commit -m "feat(attendance-kiosk): expo shell with env validation"
```

---

### Task 4: Workforce + Inventory shells (pattern clone)

**Files:**
- Create: `app-movil/apps/workforce/package.json`
- Create: `app-movil/apps/workforce/app.config.ts`
- Create: `app-movil/apps/workforce/tsconfig.json`
- Create: `app-movil/apps/workforce/babel.config.js`
- Create: `app-movil/apps/workforce/jest.config.js`
- Create: `app-movil/apps/workforce/.env.example`
- Create: `app-movil/apps/workforce/app/_layout.tsx`
- Create: `app-movil/apps/workforce/app/index.tsx`
- Create: `app-movil/apps/workforce/src/config/env.ts`
- Create: `app-movil/apps/workforce/src/config/__tests__/env.test.ts`
- Create: `app-movil/apps/inventory/package.json`
- Create: `app-movil/apps/inventory/app.config.ts`
- Create: `app-movil/apps/inventory/tsconfig.json`
- Create: `app-movil/apps/inventory/babel.config.js`
- Create: `app-movil/apps/inventory/jest.config.js`
- Create: `app-movil/apps/inventory/.env.example`
- Create: `app-movil/apps/inventory/app/_layout.tsx`
- Create: `app-movil/apps/inventory/app/index.tsx`
- Create: `app-movil/apps/inventory/src/config/env.ts`
- Create: `app-movil/apps/inventory/src/config/__tests__/env.test.ts`

**Interfaces:**
- Consumes: Task 3 file contents (copy structure)
- Produces:
  - `workforce` → `com.facenexus.workforce`, display `FACE Workforce`
  - `inventory` → `com.facenexus.inventory`, display `FACE Inventory`
  - both pass typecheck + test

- [ ] **Step 1: Copy attendance-kiosk tree to workforce and inventory**

```powershell
$root = "C:\Users\ZARAGOZA051\Desktop\nexus\app-movil\apps"
Copy-Item -Recurse "$root\attendance-kiosk\*" "$root\workforce\"
Copy-Item -Recurse "$root\attendance-kiosk\*" "$root\inventory\"
Remove-Item -Recurse -Force "$root\workforce\node_modules", "$root\inventory\node_modules" -ErrorAction SilentlyContinue
```

- [ ] **Step 2: Patch `apps/workforce/package.json`**

Replace name/scripts deps block name only:

```json
{
  "name": "workforce",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "@face/shared-types": "workspace:*",
    "@expo/metro-runtime": "~58.0.17",
    "expo": "~58.0.25",
    "expo-constants": "~58.0.16",
    "expo-linking": "~58.0.17",
    "expo-router": "~58.0.32",
    "expo-status-bar": "~58.0.5",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-native": "0.88.1",
    "react-native-safe-area-context": "~5.11.1",
    "react-native-screens": "~4.30.1"
  },
  "devDependencies": {
    "@babel/core": "^7.29.7",
    "@types/jest": "^30.0.0",
    "@types/react": "~19.3.0",
    "eslint": "9.39.1",
    "jest": "~30.5.2",
    "jest-expo": "~58.0.0",
    "typescript": "5.9.3",
    "typescript-eslint": "8.46.2"
  }
}
```

- [ ] **Step 3: Patch `apps/workforce/app.config.ts`**

```ts
import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FACE Workforce',
  slug: 'face-workforce',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'faceworkforce',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  android: {
    package: 'com.facenexus.workforce',
    versionCode: 1,
    permissions: ['CAMERA', 'INTERNET'],
  },
  plugins: ['expo-router'],
  extra: {
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api/v1',
  },
});
```

- [ ] **Step 4: Patch `apps/workforce/app/index.tsx` title**

```tsx
import { Text, View, StyleSheet } from 'react-native';
import { getEnv } from '../src/config/env';

export default function Home() {
  const env = getEnv();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FACE Workforce</Text>
      <Text testID="env-label">{env.environment}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
});
```

- [ ] **Step 5: Patch `apps/inventory/package.json` name**

Change only `"name": "inventory"` (rest identical to workforce).

- [ ] **Step 6: Patch `apps/inventory/app.config.ts`**

```ts
import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FACE Inventory',
  slug: 'face-inventory',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'faceinventory',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  android: {
    package: 'com.facenexus.inventory',
    versionCode: 1,
    permissions: ['INTERNET'],
  },
  plugins: ['expo-router'],
  extra: {
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api/v1',
  },
});
```

- [ ] **Step 7: Patch `apps/inventory/app/index.tsx` title**

Same as workforce but title `FACE Inventory`.

- [ ] **Step 8: Install and verify all three apps**

```powershell
Set-Location "C:\Users\ZARAGOZA051\Desktop\nexus\app-movil"
pnpm install
pnpm --filter workforce typecheck
pnpm --filter workforce test
pnpm --filter inventory typecheck
pnpm --filter inventory test
Set-Location apps/workforce && npx expo config --type public | Select-String "package"
Set-Location ../inventory && npx expo config --type public | Select-String "package"
Set-Location ../..
```

Expected: both typechecks clean; tests PASS; packages `com.facenexus.workforce` and `com.facenexus.inventory`.

- [ ] **Step 9: Commit**

```powershell
git add apps/workforce apps/inventory pnpm-lock.yaml
git commit -m "feat(apps): workforce and inventory expo shells"
```

---

### Task 5: Root lint + full verification + docs sync

**Files:**
- Create: `app-movil/eslint.config.mjs`
- Create: `app-movil/packages/shared-types/eslint.config.js` (if root flat config needs per-package entry — prefer root-only first)
- Modify: each package `package.json` lint script if pointing at missing config
- Create: `app-movil/docs/PLAN_FASE1_STATUS.md`

**Interfaces:**
- Consumes: Tasks 1–4
- Produces: `pnpm doctor` green (lint + typecheck + test across workspace)

- [ ] **Step 1: Write root `eslint.config.mjs`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/android/**',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

Add root devDependency `@eslint/js` if missing:

```powershell
pnpm add -Dw @eslint/js@9.39.1
```

- [ ] **Step 2: Ensure each package lint script runs**

If `eslint src` fails on flat config discovery, set every package script to:

```json
"lint": "eslint ."
```

and run from package dir. Workspace root `eslint.config.mjs` is discovered walking up.

- [ ] **Step 3: Run full doctor**

```powershell
Set-Location "C:\Users\ZARAGOZA051\Desktop\nexus\app-movil"
pnpm install
pnpm doctor
```

Expected: turbo runs lint, typecheck, test for all 4 packages — all green.

- [ ] **Step 4: Fix any lint/type failures with minimal edits**

Only fix errors that block `pnpm doctor`. No style drive-by refactors.

- [ ] **Step 5: Write `docs/PLAN_FASE1_STATUS.md`**

```markdown
# Fase 1 Status

- [x] pnpm + Turborepo root
- [x] tsconfig.base strict
- [x] @face/shared-types + tests
- [x] attendance-kiosk shell (com.facenexus.attendance)
- [x] workforce shell (com.facenexus.workforce)
- [x] inventory shell (com.facenexus.inventory)
- [x] env validation + .env.example
- [x] eslint flat config
- [x] ADR-011 X-Device-Key MVP
- [ ] Device APK on real tablet (pending hardware)
- [ ] Fase 2: api-client/auth/tenant/device packages

Commands verified: pnpm install, pnpm doctor, expo config x3.
```

- [ ] **Step 6: Final commit**

```powershell
git add .
git commit -m "chore: eslint flat config and fase1 status doc"
```

---

## Out of Scope (later plans, not this document)

| Phase | Package/feature | Blocked by |
|-------|-----------------|------------|
| 2 | api-client, auth, tenant, device identity | Fase 1 accepted |
| 3 | scanner, sqlite, offline-sync | D3 sync endpoint ADR |
| 4 | Attendance Kiosk screens + X-Device-Key flows | Fase 2-3 |
| 5-7 | Workforce, Inventory, hardening | prior phases |

## Self-Review Notes

- Spec coverage Fase 1: monorepo ✓, TS strict ✓, lint ✓, jest ✓, 3 shells ✓, independent applicationId ✓, shared package with public export ✓, env per app ✓, scripts documented ✓, ADR ✓, no empty packages ✓ (only shared-types), no backend auth changes ✓.
- Placeholders: none — all steps carry full file contents or exact commands.
- Type consistency: `DeviceIdentity`/`ApiSuccess` defined Task 2, only consumed as types later; `getEnv(): AppEnv` identical across three apps.
