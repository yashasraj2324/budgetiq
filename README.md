# BudgetIQ

BudgetIQ is a finance decision layer that detects spend-velocity anomalies,
calculates constrained reallocations, and routes recommendations through
human approval and an audit trail. The deterministic money engine never
delegates financial calculations to the AI provider.

## Local development

### Backend

1. Install Python 3.11+ and MongoDB.
2. Install dependencies: `python -m pip install -e ".[dev]"`.
3. Copy `.env.example` to `.env` and set `MONGO_URI`.
4. Start the API: `python main.py`.

The local API is not unauthenticated. Set the matching
`BUDGETIQ_DEV_AUTH_TOKEN` and `NEXT_PUBLIC_DEV_AUTH_TOKEN` values (the example
uses `local-dev-token`). The frontend stores only that development bearer token
in `sessionStorage`; it is not a substitute for user authentication.
For production set `BUDGETIQ_ENV=production`, `BUDGETIQ_AUTH_MODE=jwt`, and
`SUPABASE_JWT_SECRET`. JWTs must contain `sub` and `organization_id` (or
`org_id`) claims. Missing production auth or tenant claims fail closed.

The API is available at `http://localhost:8000`; liveness is
`GET /api/health`. Demo data is **opt-in**:

```powershell
$env:BUDGETIQ_SEED_DEMO = "true"
python -m backend.app.seed
```

The seed command only inserts when every demo collection is empty. It never
drops or overwrites application data. Set `MONGO_ENSURE_INDEXES=true` to
create the recommended Mongo indexes at startup.

### Frontend

```powershell
cd frontend
copy .env.example .env.local
npm ci
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the API URL including `/api` (for example
`https://api.example.com/api`). The local default is
`http://localhost:8000/api`.

The frontend API wrapper adds the bearer token to every request and redirects
expired sessions to the sign-in screen. A deployed frontend should replace the
development token flow with the Supabase browser auth client and place its
access token in the same session boundary.

## Storage and tenancy

The MVP API uses MongoDB for compatibility with the existing implementation.
The production relational target is provided in
`supabase/migrations/20260917000000_budgetiq_tenant_schema.sql`. It includes
organization-scoped foreign keys, membership-based RLS, and policies for
recommendations and audit events. Apply it with the Supabase CLI when moving
the storage adapter to Postgres; the migration is not run by the Mongo
startup path.

## Validation

```powershell
python -m pytest backend/tests/ -q
cd frontend
npm run lint
npm run build
```

If frontend dependencies are not installed, run `npm ci` first.

## Configuration

See `.env.example` for backend, Qwen, logging, MongoDB, and frontend
authentication configuration. Qwen is optional for local operation: without a valid
`QWEN_API_KEY`, recommendations use a clearly labelled deterministic
explanation while preserving all engine guardrails.

The Mongo adapter scopes every read and write to the authenticated organization;
demo records are tagged with `BUDGETIQ_DEV_ORGANIZATION_ID`. Recommendation
state transitions require a finance approver role, reserve source budget with
an atomic conditional update, and append audit metadata. Audit records have no
mutation API. The Supabase migration additionally installs an immutable audit
trigger and organization/membership RLS.

`GET /api/providers/status` is an authenticated status endpoint for the
provider boundary. ERP and Stripe are intentionally reported as
`not_connected` until real adapters and credentials are supplied; no fake
integration is enabled.
