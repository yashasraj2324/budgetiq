# Codex implementation prompt — close BudgetIQ gaps and remove fake features

Work in the BudgetIQ repository. Read `gaps.md`, `fake.md`, `v1 target.md`,
`prd.md`, `README.md`, and `.env.example` before editing.

## Product decision

**Stripe billing is deferred for this milestone.** Do not configure, require, or
extend Stripe. Core startup, readiness, onboarding, imports, dashboards,
recommendations, approvals, audit, and tests must work without Stripe
credentials. Hide billing from active navigation or put it behind an explicit
feature flag with clear `Billing deferred` wording. Do not let missing Stripe
configuration fail normal workflows. Preserve existing Stripe code only if it
is isolated and harmless.

## Objective

Make BudgetIQ truthful and usable for a controlled client pilot. Implement the
remaining gaps and remove every fake, misleading, placeholder, or
non-functional control. Do not claim completion when a feature is only a static
card, API stub, alert, placeholder, or development-only behavior.

## Required implementation

### Fake and placeholder UI

- Replace the `New Scenario` alert in
  `frontend/src/app/scenarios/page.tsx` with a validated create form backed by
  `POST /api/scenarios`, including loading, success, and error states.
- Replace the static governance page in
  `frontend/src/app/governance/page.tsx` with a real editor backed by the
  existing governance API: tiers, roles, thresholds, dual-sign, delegated
  approvers, and escalation settings.
- Make `frontend/src/app/integrations/page.tsx` truthful: CSV/manual ingestion
  is the supported current path; ERP/FP&A connectors are deferred. Remove any
  connect action that cannot work.
- Audit onboarding, dashboard, approvals, recommendations, reports, audit,
  settings, scenarios, governance, integrations, and billing. Every active
  button/link/form must either complete and persist its advertised action,
  navigate to a working workflow, or be removed/labeled deferred.
- Remove “coming soon” alerts from active product controls.

### Admin and workspace workflows

- Add a customer-facing API-key screen: list, create, one-time secret display,
  rotate, revoke, expiry, and scope selection.
- Enforce API-key scopes on every protected route using `require_scope` or a
  consistent equivalent; role checks alone are insufficient.
- Add membership/invitation UI: list, invite, resend, revoke, role change, and
  removal with server-side permission checks.
- Add fiscal calendar/period settings UI.
- Make approval policy settings editable and persistent after reload.
- Add saved scenario create/edit/share/delete/duplicate UI with permissions.

### Governance and finance correctness

- Enforce the approval state machine in approve, modify, and reject mutations:
  tiers, dual-sign, delegated approvers, escalation, actor authorization,
  idempotent transitions, and stale-action protection.
- Move money only after final approval.
- Audit every transition with organization, actor, previous state, next state,
  amount, timestamp, and correlation/request ID.
- Keep all monetary calculations Decimal-safe and deterministic.
- Add tests for denied roles, duplicate actions, stale decisions, tier
  progression, dual-sign same-actor rejection, and final balance changes.

### Authentication and tenant isolation

- Production must never silently use `local-dev-token`, `local-demo`, or a
  default secret. Keep development auth only behind explicit development mode.
- Validate JWT expiry, issuer, audience, organization membership, and role.
- Scope every collection, export, report, scenario, job, audit, forecast,
  invitation, and API-key query by organization.
- Add cross-tenant denial tests for reads, writes, exports, and API keys.
- Preserve CSRF/origin protection for cookie-authenticated mutations.

### Imports, forecasts, and jobs

- Ensure CSV imports provide validation, duplicate detection, row-level errors,
  idempotent retries, and persisted import history.
- Never display fabricated forecasts when history is insufficient.
- Preserve forecast provenance and backtest results; test repeatability.
- Keep background jobs tenant-scoped, idempotent, retryable, observable, and
  safe to run without Stripe.

### Build and test health

- Fix the unused `@ts-expect-error` in `frontend/src/app/layout.tsx`.
- Make Playwright setup valid: add the required package/configuration if E2E is
  intended to run, or exclude E2E files from the production TypeScript build
  while retaining a separate E2E command. Do not weaken strict TypeScript.
- Run until successful:

```text
python -m pytest -q
cd frontend && npm run lint
cd frontend && npm run build
```

Run the browser suite if configured and add focused regression tests.

### Documentation

Synchronize `gaps.md`, `fake.md`, `README.md`, and `.env.example`. State that
CSV/manual ingestion is the current path, ERP connectors are deferred, Stripe
is deferred and non-blocking, development auth/demo seed are never production
defaults, and every active control has a working path.

## Constraints

Reuse existing models, routes, tenant database facade, auth helpers, Decimal
helpers, audit conventions, and UI patterns. Make surgical changes. Do not
invent fake success responses, placeholder data, silent fallbacks, or
unrelated rewrites. Do not do Stripe work in this milestone.

## Completion checklist

Before reporting completion:

1. Search active frontend code for `coming soon`, fake success text, and alerts
   attached to product actions.
2. Verify every active navigation item opens a working workflow.
3. Verify Stripe is not required for startup, readiness, onboarding, or tests.
4. Verify backend tests, frontend lint, and frontend production build pass.
5. Update `gaps.md` and `fake.md` so resolved items are removed and deferred
   items are clearly labeled.
6. Report changed files, checks run, and explicitly deferred work.
