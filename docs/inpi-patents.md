# INPI patents integration

This project now exposes `GET /api/labs/:id/patents` and queries INPI by SIREN (derived from SIRET when needed).

## Required lab data

- `siretNumber` on the lab profile:
  - 14 digits: treated as SIRET and converted to SIREN (first 9 digits)
  - 9 digits: treated as SIREN directly

## Environment variables

Set one authentication mode.

### Mode A: API key / bearer token

- `INPI_API_KEY` (or `INPI_BEARER_TOKEN`)

### Mode B: INPI cookie auth

- `INPI_XSRF_TOKEN`
- `INPI_ACCESS_TOKEN`
- `INPI_SESSION_TOKEN`
- `INPI_REFRESH_TOKEN` (alternative to `INPI_SESSION_TOKEN`, depending on INPI account/session setup)

Optional:

- `INPI_API_BASE_URL` (default: `https://api-gateway.inpi.fr`)
- `INPI_API_SEARCH_PATH` (default: `/services/apidiffusion/api/brevets/search`)
- `INPI_COLLECTIONS` (default: `FR,EP,CCP`)
- `INPI_PAGE_SIZE` (default: `50`)
- `INPI_TIMEOUT_MS` (default: `15000`)

Note:

- The backend now retries with method/path fallbacks when INPI responds unexpectedly (for example `POST` 405).
- By default it uses the configured endpoint only, then a single GET fallback when `POST` is not allowed.
- Set `INPI_ENABLE_PATH_FALLBACK=true` only if you need extra path fallbacks (`/services/apidiffusion/...` and `/api/...`).

## Frontend behavior

- The `View patents` button is visible only when the lab has a valid SIRET/SIREN.
- Clicking `View patents` calls `/api/labs/:id/patents`.

## Quick smoke test

With the server running:

```bash
curl -s http://localhost:5001/api/labs/<LAB_ID>/patents
```

Expected outcomes:

- `200` with `{ items: [...] }` when INPI auth is configured and lab has SIRET/SIREN.
- `400` when the lab has no valid SIRET/SIREN.
- `503` when INPI credentials are not configured yet.
