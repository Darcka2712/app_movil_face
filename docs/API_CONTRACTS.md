# FACE Mobile API Contracts (verified against backend-main)

Base URL: EXPO_PUBLIC_API_BASE_URL (default http://localhost:3002/api/v1)

## Envelope
Success: { success: true, message?, data, pagination?, timestamp }
Failure: { success: false, error?, message, timestamp? }

## Auth (user JWT)
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | /usuarios/login | none (CSRF public) | body {user,password} → data.token (access). Cookies also set. |
| POST | /usuarios/refresh | cookie refresh_token only + CSRF header/cookie (not in CSRF PUBLIC_PATHS) | see ADR-012 |
| POST | /usuarios/logout | Bearer or cookie | clears cookies server-side; CSRF public |
| GET | /usuarios/me | Bearer | data = LoginUser shape |

## Device (X-Device-Key, CSRF bypassed)
| Method | Path | Permission | Body |
|--------|------|------------|------|
| GET | /device/empleados | empleados READ | — |
| POST | /device/entrada | asistencia CREATE | XOR id_empleado|codigo + optional timestamp |
| POST | /device/salida | asistencia CREATE | same |

Note: routes are flat under `/device/*` (asistenciaRouter mounted without subpath). Backend swagger comments saying `/device/asistencia/*` are stale.

Device key provisioned by admin: POST /api/v1/dispositivos (web JWT).
No self-registration endpoint.

## Error codes seen
UNAUTHORIZED, INVALID_TOKEN, TOKEN_REVOKED, FORBIDDEN,
CSRF_TOKEN_MISSING, CSRF_TOKEN_INVALID,
API key messages on device 401.
