# BudgetIQ implementation gaps

**As of:** 2026-09-18  
**Current balance:** feature-complete pilot backend with production integration and deployment gaps; not yet general-client launch-ready.

The market-readiness scope, release gates, non-goals, and success metrics are
defined in [`v1 target.md`](v1%20target.md).

## Why the frontend uses React

React was already the frontend framework in this repository before the gap work
started. The application uses Next.js, which is built on React, so the changes
reuse the existing stack rather than introducing a second UI technology.

React is used here for the interactive parts of BudgetIQ: onboarding forms,
editable policy and priority controls, CSV upload state, dashboard filters,
loading/error states, and approval actions. Next.js still provides routing,
server-rendered dashboard pages, static builds, and the production frontend
runtime.

This was not added as a new gap or chosen to replace the backend. The backend
remains FastAPI/Python, and React/Next.js is only the existing presentation
layer.

## Implemented

- Tenant-aware development authentication and role checks.
- Organization-scoped Mongo access and audit events.
- Deterministic Decimal-based reallocation calculations.
- Recommendation generation, explanation, approval, modification, and rejection.
- Onboarding workspace configuration persistence.
- Editable and persisted priority weights.
- Editable and persisted transfer policies with reset behavior.
- Manual budget-line creation and CSV import with validation.
- Dashboard query filters and CSV export.
- Budget-line detail and spend history.
- Deterministic forecast service with projected chart points and confidence bounds.
- Server-side dashboard pagination, scenario query state, and paged totals.
- Editable organization profile settings with validation and audit events.
- Liveness/readiness health checks and a Prometheus-compatible metrics endpoint.
- Supabase-compatible JWT and auth-cookie validation, browser password recovery/sign-in boundaries, sign-out endpoint, organization memberships/invitations, role management, and account-provisioning boundary.
- Scoped API keys with SHA-256 hashing, expiry, rotation, revocation, one-time cleartext display, and API-key request authentication.
- Configurable approval tiers, delegated approvers, escalation windows, dual-sign configuration, and governance audit events.
- Deterministic forecast endpoint with confidence bounds and provenance fields.
- Organization settings editing with validation and audit events.
- Stripe checkout, customer portal, subscription webhooks, duplicate-event protection, entitlements, and invoice retrieval.
- Security headers, configurable per-client rate limiting, readiness/metrics endpoints, and webhook signature verification.
- Audit and report exports.
- Truthful provider-status display and removal of onboarding fake/unavailable controls.

## Remaining gaps

| Priority | Area | Gap | Launch impact | Next implementation |
|---|---|---|---|---|
| P0 | Authentication deployment | Supabase credentials, refresh-token persistence, email delivery, invitation delivery, redirect allowlists, and production JWT secrets are not configured in this workspace. | Blocks turnkey customer access and recovery. | Configure Supabase Auth, SMTP, redirect URLs, service-role secret, and a secure frontend session strategy. |
| P0 | Production data | MongoDB is still the active runtime; the Supabase/Postgres migration is not wired as the application repository. | RLS, managed backups, migrations, and scale posture are not proven. | Select the production adapter, migrate data, enable RLS, and run restore/tenant-isolation drills. |
| P0 | Security operations | Rate limiting and headers exist, but secrets-manager integration, CSRF protection for cookie mutations, key rotation procedures, backup automation, and incident response remain. | Security review and operational launch are incomplete. | Deploy behind managed secrets, add CSRF/origin enforcement, automate backups, and document incident response. |
| P1 | Approval execution | Approval-policy configuration exists, but approval mutations do not yet enforce multi-step tiers, dual-sign completion, delegated approvers, escalation windows, or email/job notifications. | Enterprise governance can be configured without fully enforcing it. | Put the approval state machine in the approve/modify/reject path and add notification workers. |
| P1 | ERP/FP&A integration | No provider adapter, scheduled sync, retry/reconciliation job, or source-system write-back exists; CSV/manual ingestion is the only live data path. | Customers must operate manually. | Select one provider, implement credential handling, sync jobs, idempotency, reconciliation, and write-back. |
| P1 | API access UX | API-key lifecycle and API-key authentication exist, but route scopes are not broadly enforced and there is no customer-facing key-management screen. | External access is technically possible but not self-service or least-privilege complete. | Annotate each API route with scopes and add create/list/rotate/revoke UI with one-time key display. |
| P1 | Forecast governance | Forecasting is deterministic with confidence bounds, but there is no backtesting, accuracy monitoring, or approved model-governance record. | Forecast quality is not production-validated. | Add backtest datasets, error metrics, forecast version/provenance, and review controls. |
| P1 | Scenario UX | Dashboard query scenarios and pagination exist, but scenario definitions are not persisted as reusable saved views and the UI has limited filter controls. | Repeatable planning analysis is incomplete. | Add saved scenario CRUD, typed filter controls, and permission-aware sharing. |
| P1 | Settings completeness | Organization profile editing exists, but fiscal calendar/period configuration, membership management UI, approval-policy UI, and API-key UI are incomplete. | Admins cannot manage the full workspace from the product. | Add the remaining admin screens and wire them to the existing APIs. |
| P1 | Billing operations | Stripe checkout, portal, signed webhooks, entitlements, and invoices exist; tax, usage metering, dunning, plan catalog management, and production Stripe configuration remain. | Monetization path exists but commercial billing is incomplete. | Configure Stripe products/webhooks and add metering, tax, failed-payment handling, and plan enforcement. |
| P2 | ERP/background operations | No worker/queue runtime exists for scheduled sync, email delivery, escalation, reconciliation, or retry visibility. | Time-based workflows require manual triggering. | Add a durable worker/queue, job status model, retries, dead-letter handling, and operator controls. |
| P2 | Observability | Health and Prometheus metrics exist, but dashboards, alerts, trace correlation, job monitoring, and customer-visible sync health are absent. | Failures may be detected late. | Add production dashboards, alert rules, correlation IDs, and sync/job status views. |
| P2 | Quality | Backend coverage is strong for current APIs; frontend lint has warnings and browser/E2E coverage is limited. | UI regressions and integration failures can escape CI. | Add browser tests for auth, onboarding, imports, filters, billing, permissions, retries, and empty/error states. |

## Release decision

**Not ready for general client launch.** The system is suitable for a controlled pilot with configured development/JWT auth, MongoDB, manual/CSV ingestion, human-reviewed recommendations, and configured Stripe credentials. General launch still requires closing all P0 gaps, enforcing approval governance, selecting an ERP provider, and operationalizing background jobs, billing, observability, backups, and production credentials.

## Recommended delivery order

1. Configure Supabase Auth, SMTP, production secrets, sessions, and redirects.
2. Choose/migrate the production data adapter and complete RLS, backups, restore, and tenant drills.
3. Enforce the approval state machine and add workers for escalation/email/retries.
4. Add admin UI for memberships, approval policy, API keys, saved scenarios, and fiscal periods.
5. Select and ship one ERP/FP&A connector with sync, reconciliation, and write-back.
6. Add forecast backtesting/model governance and production observability.
7. Finish Stripe tax/metering/dunning and browser/E2E release hardening.
