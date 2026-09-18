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

### Backend

1. Install Python 3.11+ and MongoDB.
2. Install dependencies: `python -m pip install -e ".[dev]"`.
3. Copy `.env.example` to `.env` and set dev auth and Mongo values.
4. Start the API: `python main.py`.

The API runs at `http://localhost:8000`.

- Liveness: `GET /api/health`
- Readiness: `GET /api/health/ready`

### Frontend

```powershell
cd frontend
copy .env.example .env.local
npm ci
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the backend URL including `/api`
(for example `http://localhost:8000/api`).

## Authentication and tenant safety

- Development auth is only allowed in development mode and requires explicit
  `BUDGETIQ_DEV_AUTH_TOKEN` and `BUDGETIQ_DEV_ORGANIZATION_ID` values.
- Production must use JWT mode with configured secrets and claims.
- JWT validation enforces expiry and optional issuer/audience checks.
- Active organization membership is required for JWT requests.
- Every Mongo read/write goes through the tenant-scoped database facade.

## Validation

```powershell
python -m pytest -q
cd frontend
npm run lint
npm run build
```

Optional E2E command (kept separate from production build):

```powershell
cd frontend
npm run e2e
```

## Configuration

See `.env.example` for all required values. Do not use development demo values
as production defaults. Demo seed remains opt-in (`BUDGETIQ_SEED_DEMO=true`) and
never overwrites existing tenant data.

