# ADR-012: JWT refresh token is cookie-only — mobile gap documented

## Status
Accepted 2026-11-18 (documented; no backend change)

## Context
Backend login sets httpOnly cookies access_token + refresh_token and also
returns access token in response body (data.token). Refresh endpoint
POST /api/v1/usuarios/refresh reads ONLY req.cookies.refresh_token and
returns new tokens via Set-Cookie; response body has no token field.

React Native / Expo fetch does not persist httpOnly cookies like a browser.
Storing refresh token from Set-Cookie is unreliable without a cookie jar.

## Decision
1. Attendance Kiosk MVP uses X-Device-Key only (ADR-011) — no JWT refresh needed.
2. User JWT flows (Workforce) store access token from login body in SecureStore.
3. Do NOT invent a body-based refresh contract. When Workforce needs silent
   refresh, propose backend change: accept refresh_token in body OR return
   refresh_token in login/refresh JSON for `X-Client-Type: mobile`.
4. Until then: expired access token → re-login (explicit).

## Consequences
- Kiosk unaffected
- Workforce MVP may require interactive re-login after access TTL (24h backend)
- Backend change needs approval per architecture rules
