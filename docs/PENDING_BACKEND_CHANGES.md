# Cambios backend pendientes (para cuando se actualice FACE Nexus)

Origen: auditoría móvil Fase 1-2 (2026-11-18). El `backend-main` en este
workspace está desactualizado respecto a estos puntos. **No se edita el repo
backend hasta que se use el backend original actualizado.**

Estado de ejecución móvil: `app-movil` ya documenta contratos en
`docs/API_CONTRACTS.md`, ADR-011, ADR-012.

---

## P1 — Paths swagger/docs stale (BAJO)

**Real (código OK):** `POST /api/v1/device/entrada`, `POST /api/v1/device/salida`
(rutas planas: `asistenciaRouter.post('/entrada')` + `router.use(asistenciaRouter)`).

Confirmado por: `sync-docs-routes.test.js:52`, `device.routes.auth.test.mjs:104`.

| Archivo | Línea | Acción |
|---|---|---|
| `src/modules/device/routes/device.routes.js` | 23 | Corregir JSDoc `/api/device/asistencia/entrada` → `/api/v1/device/entrada` |
| `docs/06-SEGURIDAD.md` | 677 | Idem |
| `docs/00-RECONOCIMIENTO-TOTAL.md` | 835 | Idem |
| `.opencode/plans/MASTER_REFERENCE_DOCUMENT.md` | 198 | Opcional (histórico) |

Nota: `csrfMiddleware.test.js:155` usa path fake — solo testing de matching, no assert de ruta real.

---

## P2 — `console.log` sensibles (MEDIO — seguridad)

| Archivo | Línea | Loguea | Acción |
|---|---|---|---|
| `UsuarioController.js` | 26 | `result` completo **incluye JWT `token`** | Borrar o `logger.debug` sin token |
| `UsuarioController.js` | 285 | `user` | Idem sin PII innecesaria |
| `AuthService.js` | 226 | `usuario` completo (**hash password**) | Borrar o solo ids no sensibles |

Riesgo: tokens/passwords en logs de producción.

---

## P3 — Boot sequence test (app-movil) — RESUELTO EN ESTA RAMA

Extraer `_layout.tsx` effect → `src/config/bootstrap.ts` + tests unitarios.
Ver commit correspondiente en app-movil.

---

## P4 — Runbook Android (app-movil) — RESUELTO EN ESTA RAMA

- `docs/RUNBOOK_ANDROID.md`
- `scripts/verify-android-env.ps1`

Estado máquina al auditar: `ANDROID_HOME` vacío, Java 1.8 (SDK 58 requiere JDK 17+), sin adb.

---

## P5 — Refresh JWT móvil (ALTO — requiere aprobación auth)

**Problema:** ver ADR-012 (`app-movil/docs/adr/ADR-012-jwt-refresh-cookie-mobile.md`).

Capas:
1. Refresh solo en cookie httpOnly (`UsuarioController.js:226`)
2. Access sí en body en login (`UsuarioController.js:52-57`)
3. `/usuarios/refresh` NO en CSRF PUBLIC_PATHS — **deliberado**:
   test regresión `csrfMiddleware.test.js:94` prohíbe eximirlo

**Opción B propuesta (no implementada):**
- Header `X-Client-Type: mobile` → login/refresh devuelven `refresh_token` en JSON
- Refresh acepta `refresh_token` en body
- CSRF: o refresh entra a `PUBLIC_PATHS`, o se acepta token en body con otro mecanismo
- **Cualquier cambio implica modificar el test de regresión CSRF** → aprobación explícita

**Opción actual (ADR-012):** Workforce re-login al expirar access (24h). Kiosk no afectado (X-Device-Key).

Nuevo ADR requerido: `ADR-013` cuando se apruebe.

---

## P6 — Instalación build Android (máquina, no repo)

1. Instalar JDK 17 (Temurin / Microsoft Build) — hoy solo Java 1.8
2. Android Studio o cmdline-tools + platform-tools + build-tools 35
3. Set `ANDROID_HOME`, PATH `platform-tools`
4. `npx expo run:android` en attendance-kiosk
5. Smoke: app abre, env + estado device key

Checklist: `app-movil/docs/RUNBOOK_ANDROID.md`

---

## P7 — Endpoint sync offline asistencia (ALTO — Fase 3 blocker live)

**No existe hoy.** Contrato propuesto:

```http
POST /api/v1/device/sync
X-Device-Key: <key>
```

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

**Requisitos backend:**
- `UNIQUE(eventId)` (global o tenant según modelo)
- Reenvío mismo eventId → resultado previo (`DUPLICATE`)
- Payload incompatible mismo eventId → conflicto auditable (409)
- Validación + persistencia en transacción
- Respuesta individual por `eventId` en el lote
- Límite de lote (p.ej. 100)
- Códigos funcionales de rechazo documentados

**Mientras no exista:** cliente usa `POST /device/entrada|salida` individual
(sin dedupe server-side → riesgo de duplicado si retry tras timeout; ver
`shortcut:` en `@face/offline-sync` SingleEventTransport).

---

## Resumen de estado

| ID | Tema | ¿Bloquea móvil? | ¿Listo para aplicar en backend original? |
|----|------|------------------|------------------------------------------|
| P1 | Docs paths | No | Sí (3 archivos + JSDoc) |
| P2 | console.log | No | Sí (3 líneas) |
| P3 | Bootstrap test | No | Hecho en app-movil |
| P4 | Runbook Android | No | Hecho en app-movil |
| P5 | Refresh body | Solo Workforce silent refresh | Requiere aprobación auth |
| P6 | JDK/SDK | Sí para build real | Instalación máquina |
| P7 | Sync batch | Sí para sync live offline | Requiere diseño + aprobación |
