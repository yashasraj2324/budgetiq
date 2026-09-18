# Move BudgetIQ data/API layer to Enter Cloud so the preview works end-to-end

## Context

The app renders in the platform preview now, but its `/api` calls resolve to the
preview origin (401) because the local Python/FastAPI backend is not reachable
from the preview's domain — a local server can never be. Enter Cloud provides a
public database + backend functions, which the preview can reach.

Goal: make the preview (and any deployment) use a **real backend with real data**
hosted in Enter Cloud, while keeping the Python backend in the repo for local
development.

The repo already contains the relational target schema
(`supabase/migrations/20260917000000_budgetiq_tenant_schema.sql`) with clean
BudgetIQ table names, RLS policies and `is_org_member`/`is_org_admin` helpers.
Reuse it as-is (same business, established tables).

## Architecture

- **Database**: apply the existing BudgetIQ schema migration (tables + RLS) to Enter Cloud.
- **Backend functions** (Deno, in `supabase/functions/`):
  - `api` — a single gateway function named `api` that routes `req.url` path + method to small handlers, preserving the frontend's existing `${API}/dashboard` REST style. `verify_jwt = false`; it authenticates via `Authorization: Bearer <token>`: the configured dev token (`DEV_AUTH_TOKEN` secret) → demo org, or a real Supabase JWT (resolved via `supabase.auth.getUser`) → membership org. Uses the service-role client (auto-provided env) so RLS stays on and server-side logic owns authorization.
  - `seed` — idempotent demo bootstrap: creates the demo auth user (`auth.admin.createUser`, email-confirmed), demo organization + membership, and the Python-seed-equivalent rows (departments, budget lines, spend entries, performance scores, 1 pending recommendation, onboarding config, approval policy, fiscal calendar).
- **Frontend**: `src/lib/api.ts` default API base switches to the gateway function URL (`VITE_API_URL` still overrides, so local dev keeps the `/api` → Python proxy). No other call-site changes needed — the gateway mirrors the REST contract.
- **Auth pages** (login non-dev path, reset-password, signup): use real `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (from the generated client).
- **Python backend**: untouched, still documented for local dev.

## Implementation checklist

- [ ] `supabase/config.toml`: set `[functions.api] verify_jwt = false` and `[functions.seed] verify_jwt = false`.
- [ ] Apply schema migration via `supabase_migration` (existing `20260917000000_budgetiq_tenant_schema.sql`), then verify RLS is enabled on every table via `supabase_get_table_schema`.
- [ ] Store `DEV_AUTH_TOKEN` = `dev-token-for-local` via `supabase_add_secret` (read with `Deno.env.get()`).
- [ ] Write `supabase/functions/seed/index.ts`: idempotent demo bootstrap (user → org → membership → departments → budget lines → spend entries → performance scores → pending recommendation → onboarding config → approval policy → fiscal calendar).
- [ ] Deploy `seed` and invoke it once; confirm rows exist via `supabase_read_query`.
- [ ] Write `supabase/functions/api/index.ts` gateway with CORS + auth resolution + numeric-string→number coercion, routing:
      `GET /dashboard` (+query filters), `GET /anomalies`, `GET /departments`,
      `GET /performance-scores`, `GET|POST|PATCH|DELETE /budget-lines[/:id]`,
      `PATCH /budget-lines/:id/policy`, `POST /budget-lines/import`,
      `GET /budget-lines/:id/spend`, `GET /budget-lines/:id/forecast?horizon=`,
      `GET /recommendations`, `GET /recommendations/:id`, `POST /recommendations/generate`,
      `POST /recommendations/:id/approve|reject|modify`, `GET /audit`,
      `GET|PATCH /onboarding/config`, `POST /onboarding/data|priorities|policies`,
      `GET|PUT /organization/fiscal-calendar`, `GET|PATCH|DELETE /organization/members[/:id]`,
      `POST /organization/members/:id/resend-invitation`, `GET|POST|DELETE /organization/invitations[/:id]`,
      `GET|POST /api-keys`, `POST /api-keys/:id/rotate`, `DELETE /api-keys/:id`,
      `GET|PUT /governance/approval-policy`, `GET|POST /scenarios`,
      `GET|PATCH|DELETE /scenarios/:id`, `POST /scenarios/:id/duplicate`,
      `GET /dashboard/export.csv` (+ `.csv` aliases). Each write appends an audit event.
      Recommendation generate/approve/modify/reject use deterministic logic (surplus → priority target → guardrail cap, confidence) mirroring the Python engine.
- [ ] Deploy `api` via `supabase_deploy_edge_function`; read the returned function URL.
- [ ] Frontend `src/lib/api.ts`: default `API` = gateway URL (keep `VITE_API_URL` override); keep dev-token fallback.
- [ ] `.env` + `.env.example`: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the real values from `src/integrations/supabase/client.ts`; document the cloud `VITE_API_URL`.
- [ ] Confirm the two auth pages that hand-roll Supabase calls (login non-dev path, `reset-password`) work with the real env values.

## Verification checklist

- [ ] `curl` the deployed gateway with `Authorization: Bearer dev-token-for-local`:
      `GET /dashboard` returns the seeded aggregate (16M total budget, 1 pending rec), `GET /budget-lines` returns 3 lines, `GET /recommendations` returns the seeded pending rec.
- [ ] Gateway without/with wrong token returns 401; CORS preflight (`OPTIONS`) returns 200 with `Access-Control-Allow-Origin`.
- [ ] Mutation flow via curl: `POST /recommendations/1/approve` → status `approved` + audit row appears in `GET /audit`.
- [ ] `GET /budget-lines/2/forecast?horizon=4` returns `{ points: [...] }` with projected flags (drives the Recharts chart).
- [ ] Frontend: `pnpm lint` + `pnpm build` pass; local dev still works with `VITE_API_URL=/api` (Python proxy) unset for cloud default.
- [ ] Screenshot `/dashboard` in the preview: metric cards show cloud-seeded numbers (₹160.0L total) and the budget-line table lists Engineering/Marketing/Operations — real data, not fallback.
- [ ] Spot-check `/recommendations`, `/approvals`, `/signals` screenshots render from the same data.
