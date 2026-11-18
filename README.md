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
