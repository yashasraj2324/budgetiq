# BudgetIQ

BudgetIQ is a finance decision layer that detects spend-velocity anomalies,
calculates constrained reallocations, and routes recommendations through human
approval and an audit trail. Monetary calculations remain deterministic and are
never delegated to the LLM provider.

## Current pilot scope

- Supported ingestion path: **CSV import and manual data entry**.
- ERP/FP&A connectors: **deferred** for this milestone.
- Stripe billing flows: **deferred and disabled by default** (`BUDGETIQ_BILLING_ENABLED=false`).
- Core flows (startup, readiness, onboarding, imports, dashboard, recommendations,
  approvals, audit, and tests) run without Stripe credentials.

## Local development

### Frontend (the application runtime)

The application runs on **Vite + React** and talks to the **Enter Cloud backend**
(public API gateway + PostgreSQL database), which is what the platform preview
and production use. There is no local backend to start.

```powershell
pnpm install
pnpm dev
```

The Vite dev server runs at `http://localhost:3000`.

> Optional: to run against the legacy Python backend instead, set
> `VITE_API_URL=/api` in `.env` (the Vite server proxies `/api` to
> `http://localhost:8000`). This path exists only to exercise the archived
> backend and is not part of the supported runtime. VITE_* values are read from
> the root `.env` (see `.env.example`).

### Legacy Python/MongoDB backend (ARCHIVED)

`backend/` contains the original hackathon-era FastAPI + MongoDB backend. It is
**archived**: it is no longer the runtime, it is not deployed, and it is not
kept in parity with the active gateway. The active API is the Enter Cloud
backend function at `supabase/functions/api/`. Do not treat `backend/` as a
living codebase — changes to product behavior belong in the gateway and the
frontend only.

## Authentication and tenant safety

- Authentication uses Enter Cloud auth (email/password) with JWT validation.
- Every read/write goes through the org-scoped API gateway, which derives
  membership from the database and enforces role checks server-side.
- Row Level Security is enabled on every business table; authorization lives in
  RLS policies and the gateway, never in the client.

## Validation

```powershell
python -m pytest -q
pnpm lint
pnpm build
```

## Configuration

See `.env.example` for all required values. Do not use development demo values
as production defaults. Demo seed remains opt-in (`BUDGETIQ_SEED_DEMO=true`) and
never overwrites existing tenant data.

