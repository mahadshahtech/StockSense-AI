# StockSense AI — Intelligent Inventory Management

**Client:** Nowshera Shopping Mall  
**Tagline:** Smarter Inventory. Better Decisions.

A full-stack AI-powered inventory system with role-based access, transactional stock operations, SQLite persistence, and a Gemini-backed assistant that never writes inventory without human confirmation.

## Technology stack

| Layer | Stack |
|-------|--------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, Recharts, Framer Motion, Lucide |
| Backend | Node.js, Express, TypeScript, Zod, JWT, bcrypt |
| Database | SQLite via Prisma |
| AI | Google Gemini (`@google/genai`) with server-side tool calling |
| Tests | Vitest + Supertest |

## Quick start

```bash
npm install
npm run db:seed -w backend
npm run dev
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:3001  

Other commands:

```bash
npm run test      # acceptance / integration tests
npm run build     # production build (backend + frontend)
```

## Environment variables

Copy `.env.example` to `backend/.env` (a starter file is already present):

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API key (optional — app runs without it) |
| `JWT_SECRET` | JWT signing secret |
| `DATABASE_URL` | SQLite path, e.g. `file:./data/stocksense.db` |
| `PORT` | API port (default `3001`) |
| `FRONTEND_URL` | CORS origin (default `http://localhost:5173`) |

**Where to put your Gemini key:** `backend/.env` → `GEMINI_API_KEY=your_key_here`

Never put the key in the frontend.

## Demo credentials (development only)

| Role | Email | Password |
|------|-------|----------|
| Manager | `manager@stocksense.local` | `Manager@123` |
| Staff | `staff@stocksense.local` | `Staff@123` |

## Main features

- Manager / staff authentication with bcrypt + JWT
- Backend-enforced RBAC (staff never receives cost/profit fields)
- Products, suppliers, stock in/out/sale/damage/adjustment
- Negative stock prevention and transactional updates
- Dashboard & reports from real SQL aggregations (PKR)
- AI assistant grounded in live DB tools
- AI stock proposals with Confirm / Cancel (idempotent)
- Graceful AI outage — inventory forms keep working

## AI architecture

1. User message hits `/api/assistant/chat` (authenticated).
2. Gemini selects tools (`search_products`, `get_product_stock`, `prepare_stock_in`, etc.).
3. Backend executes tools with the **server-side role** (prompt injection cannot escalate).
4. Read tools return DB truth; write tools only create `PENDING` proposals.
5. Confirm recalculates stock on the server, checks staleness, applies once inside a transaction.

## Security

- Password hashing (bcrypt)
- JWT auth middleware on all protected routes
- Zod validation
- Rate-limited login
- Helmet + CORS + request size limits
- No Gemini key in browser
- Audit logs for stock and AI actions

## Tests

```bash
npm run test
```

Automated tests cover all five acceptance scenarios using a mock Gemini tool-calling adapter. Live Gemini verification is manual — see `TEST_RESULTS.md` and `DEMO_GUIDE.md`.
