# StockSense AI — Test Results

Verified locally on this submission build.

## How to run automated tests

```bash
npm run test
```

Uses Vitest + Supertest against an isolated SQLite file (`backend/data/test-stocksense.db`) with a mock Gemini tool-calling adapter.

## Acceptance tests

| # | Scenario | Automated | Live Gemini | Result |
|---|----------|-----------|-------------|--------|
| 1 | AI answers from real data | Yes (tools + mock chat) | Manual | **PASS** (automated) |
| 2 | AI confirmation (cancel / confirm / idempotent) | Yes | Manual | **PASS** (automated) |
| 3 | Negative stock protection (form + AI) | Yes | Manual | **PASS** (automated) |
| 4 | Role-based security + prompt injection | Yes | Manual | **PASS** (automated) |
| 5 | AI outage resilience + persistence | Yes (invalid key path) | Manual | **PASS** (automated; mobile layout NOT RUN visually) |

## Automated run log

```
✓ src/tests/acceptance.test.ts (14 tests) 5401ms
  ✓ Auth — logs in demo accounts
  ✓ TEST 1 — stock-in/sales forms, multi-product stocks, top seller, nonexistent product, mocked chat
  ✓ TEST 2 — cancel unchanged; confirm +40 once; duplicate confirm idempotent
  ✓ TEST 3 — form + AI oversell rejected; stock stays 5
  ✓ TEST 4 — profit denied, cost omitted, price PATCH 403, prompt injection refused
  ✓ TEST 5 — invalid Gemini → unavailable; stock-in works; data persists

Test Files  1 passed (1)
Tests       14 passed (14)
```

## Live Gemini

**Status: NOT RUN** — no valid `GEMINI_API_KEY` was configured in this environment.

To verify live:

1. Set a valid key in `backend/.env`
2. Restart `npm run dev`
3. Follow `DEMO_GUIDE.md` sections for Tests 1–2

## Manual API smoke (this environment)

| Check | Result |
|-------|--------|
| Manager login | PASS |
| Dashboard from DB (60 products) | PASS |
| Staff product omits `costPrice` | PASS |
| Staff price PATCH → 403 | PASS |
| AI without key → unavailable message | PASS |
| Oversell SALE of 8 when stock 5 → blocked | PASS |

## Limitations

- Automated AI chat uses a controlled mock adapter; it does not call Google’s API.
- Mobile layout (Test 5 UI) requires visual/manual browser check — **NOT RUN**.
- Weekly sales use Monday–local start via server calendar.

## Build checks

| Check | Command | Result |
|-------|---------|--------|
| Install | `npm install` | **PASS** |
| Seed | `npm run db:seed -w backend` | **PASS** (60 products) |
| Test | `npm run test` | **PASS** (14/14) |
| Build | `npm run build` | **PASS** |
