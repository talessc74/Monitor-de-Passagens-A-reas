# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server (Express + Vite HMR) on http://localhost:3000
npm run build        # production build (Vite frontend + esbuild server)
npm start            # serve production build
npm run lint         # TypeScript type-check (noEmit)
```

No test suite yet — `npm run lint` is the only automated check.

## Architecture

This is a **full-stack single-repo** app: one Express server (`server.ts`) serves both the REST API and the Vite-bundled React SPA.

### Data flow

```
Browser (React SPA)
  └─ fetch /api/*
       └─ Express (server.ts)
            ├─ JSON file DB  (server_db_passagens.json, auto-created at runtime)
            └─ Gemini AI API  (optional — falls back to offline simulation)
```

### Key files

| File | Role |
|------|------|
| `server.ts` | All backend logic: REST routes, DB read/write, Gemini AI calls, price scan logic, notification generation |
| `src/types.ts` | Shared TypeScript interfaces (`FlightMonitor`, `NotificationLog`, `AirlineSite`) — single source of truth for shape of data |
| `src/App.tsx` | Root component: owns all state, fetches from API, passes handlers down |
| `src/components/MonitorCard.tsx` | Handles the scan UX flow (step-by-step animation, result display) |

### Data model (types.ts)

- **`FlightMonitor`** — the core entity: origin/destination IATA codes, dates, passenger counts, `targetPrice`, `currentPrice`, `history[]`, list of `trackedSites`, `status: 'active' | 'paused'`
- **`NotificationLog`** — generated when a scan finds `currentPrice ≤ targetPrice` or price changes; includes `purchaseUrl` deep-link to the airline site
- **`AirlineSite`** — metadata for each source (LATAM, GOL, Azul, Decolar, Skyscanner): `status`, `scrapedCount`, `avgResponseMs`

### Price scanning (`POST /api/monitors/:id/scan`)

1. Calls Gemini (`gemini-3.5-flash`) with a structured JSON schema prompt to generate realistic BRL prices per site
2. Falls back to deterministic random simulation if `GEMINI_API_KEY` is absent or the call fails
3. Picks the cheapest result, updates `monitor.currentPrice` and `monitor.history`, increments site stats
4. Creates a `NotificationLog` if price ≤ target or price changed since last scan

### Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `GEMINI_API_KEY` | No | Enables AI price simulation; without it, offline fallback runs |
| `APP_URL` | No | Base URL for self-referential links |

Copy `.env.example` to `.env.local` for local development.

### Dev vs production server mode

`server.ts` checks `NODE_ENV`:
- **development** — mounts Vite as Express middleware (HMR works)
- **production** — serves static `dist/` folder from `npm run build`
