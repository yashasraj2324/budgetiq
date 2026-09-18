# BudgetIQ v1 market-ready target

**Target:** a secure, paid pilot SaaS that a finance team can sign up for, configure, import data, generate explainable reallocations, approve decisions, and audit every change without operator intervention.

**Release posture:** controlled production launch to 3–5 design-partner customers first, followed by general availability after the exit criteria below are met.

## v1 product promise

BudgetIQ v1 will:

1. Accept a customer’s budget-line and spend data through CSV/manual ingestion.
2. Keep each organization’s data isolated and auditable.
3. Detect anomalies and calculate deterministic reallocations.
4. Explain recommendations with optional AI assistance without allowing AI to set monetary values.
5. Require authorized human approval before financial decisions are committed.
6. Provide usable dashboard, forecast, export, billing, and administration workflows.
7. Fail clearly when a provider, import, approval, or payment operation cannot complete.

The first market release does **not** promise live ERP write-back. CSV/manual ingestion is the supported v1 data path; one ERP connector is a post-v1 expansion unless it is completed before the release gate.

## Required v1 scope

### 1. Identity and organization access

- Production Supabase Auth with email/password sign-in, refresh, sign-out, and password recovery.
- Invitation delivery and acceptance.
- Organization membership list, role assignment, and removal.
- Roles: organization admin, approver, finance manager, analyst, read-only.
- Server-side JWT validation with organization membership derived from trusted claims/database state.
- No development token or local-demo fallback in production.
- Session expiry, unauthorized redirects, and clear permission errors.

### 2. Production data and tenant isolation

- Select one production persistence path: Supabase/Postgres or managed MongoDB.
- Apply migrations automatically during deployment.
- Enforce organization scoping in every read, write, export, billing, and audit query.
- Add automated cross-tenant access tests.
- Configure managed backups, restore testing, retention, and deletion procedures.
- Keep monetary values Decimal-safe and consistently rounded at persistence boundaries.

### 3. Onboarding and data ingestion

- Workspace profile: organization name, currency, fiscal year, planning period, industry, and size.
- Resumable onboarding progress.
- Manual budget-line creation and editing.
- CSV import with:
  - template download;
  - column mapping;
  - preview;
  - type/range validation;
  - duplicate detection;
  - row-level errors;
  - import summary;
  - idempotent retry behavior.
- Spend-data import using the same validation and audit conventions.
- Import history showing actor, timestamp, rows accepted/rejected, and errors.

### 4. Finance decision workflow

- Dashboard metrics backed only by persisted customer data.
- Department, category, variance, anomaly, scenario, and date filters.
- Server-side pagination with truthful totals and filtered exports.
- Budget-line detail with allocation, spend, remaining balance, anomaly history,
  forecast, policies, and recommendation history.
- Deterministic source surplus, target gap, reserve, and policy calculations.
- Recommendation lifecycle:
  `pending -> approved | modified | rejected`.
- Human approval remains mandatory for v1.
- Idempotent approve/modify/reject operations with conditional balance checks.
- Immutable audit records containing actor, organization, timestamp, before/after
  values, policy, request ID, and outcome.

### 5. Approval governance

- Admin UI for approval thresholds and policy limits.
- At least one approver role enforced server-side.
- Optional two-person approval for configured high-value recommendations.
- Delegated approver assignment with start/end dates.
- Escalation status and operator-visible overdue approvals.
- No automatic source-system write-back in v1.

### 6. Forecasting and explanation

- Forecast endpoint with actual and projected points clearly distinguished.
- Documented forecast method, horizon, confidence calculation, and data window.
- Forecast backtest on representative fixture data before release.
- Empty/insufficient-history behavior that does not display fabricated projections.
- Qwen or another model may explain; deterministic engine remains authoritative.
- UI shows explanation source and fallback status.

### 7. Billing

- Stripe Checkout for the v1 paid plan.
- Stripe customer portal.
- Signed, idempotent subscription webhooks.
- Subscription status and basic entitlement enforcement.
- Invoice retrieval.
- Failed-payment and canceled-subscription states.
- Production price IDs, webhook endpoint, tax settings, and customer-portal
  configuration documented and tested in Stripe test mode.

### 8. Operations and supportability

- Liveness and readiness endpoints.
- Prometheus-compatible metrics.
- Request/correlation IDs in logs.
- Structured errors without leaking secrets or tenant data.
- Rate limiting and security headers.
- Error tracking and alerting for API failures, import failures, webhook failures,
  readiness failures, and database connectivity.
- Deployment runbook, rollback runbook, backup/restore runbook, and incident
  response contacts.

## Explicit v1 non-goals

- Live ERP/FP&A synchronization and source-system write-back.
- Automatic financial execution without human approval.
- Complex multi-entity consolidation.
- Custom forecasting models per customer.
- Native mobile applications.
- Full enterprise SSO/SAML unless required by a signed design partner.
- Usage-based billing and complex tax automation.
- Broad marketplace integrations.

These can be planned for v1.1 or v2 without blocking the initial market release.

## Release phases

### Phase 0 — Product and deployment decisions

- Confirm supported customer profile and paid plan.
- Select production database path.
- Create Supabase, Stripe, email, hosting, secrets, and observability projects.
- Define data retention, deletion, support, and security policies.
- Freeze v1 API contracts and CSV templates.

**Exit:** all credentials, vendors, owners, and rollback decisions are documented.

### Phase 1 — Production foundation

- Complete Supabase Auth and invitation flows.
- Remove production development-auth fallback.
- Finish database migration/RLS or production Mongo hardening.
- Add secrets management, CSRF/origin controls, rate limits, backups, and
  restore verification.

**Exit:** a new organization can sign up, invite a member, sign in, and access
only its own data in a clean production-like environment.

### Phase 2 — Finance workflow hardening

- Finish spend imports and import history.
- Finish dashboard filter/pagination/export behavior.
- Enforce approval tiers and dual-sign transitions where configured.
- Add audit assertions for every mutation.
- Add forecast backtest and insufficient-history behavior.

**Exit:** a design-partner dataset can be imported, analyzed, approved, exported,
and reloaded without losing state or violating policy.

### Phase 3 — Billing and operations

- Configure Stripe products, Checkout, portal, webhooks, invoices, and
  entitlement checks.
- Add error tracking, dashboards, alert rules, request IDs, and job health.
- Run backup restore, webhook replay, rate-limit, and outage drills.

**Exit:** a customer can pay, see subscription state, receive invoices, and
  support staff can diagnose failed requests without database shell access.

### Phase 4 — Design-partner launch

- Onboard 3–5 customers with written success criteria.
- Run weekly product/support reviews.
- Track activation, import success, time-to-first-recommendation, approval rate,
  forecast usage, support requests, and payment failures.
- Fix only launch-critical issues during the pilot; defer new major scope.

**Exit:** all launch gates pass for two consecutive weeks and each design partner
  completes the core workflow independently.

## Definition of done

### Functional

- A new organization completes onboarding without developer intervention.
- A customer imports valid and invalid rows and receives actionable results.
- A customer sees real dashboard values after reload.
- A recommendation amount is reproducible from the deterministic engine.
- Unauthorized users cannot approve or modify decisions.
- Every successful mutation creates an audit event.
- Stripe webhook replay does not duplicate subscription state.
- Forecasts never appear when there is insufficient data.

### Security

- Production secrets are absent from source control and client bundles.
- Cross-tenant API and export tests pass.
- JWT expiry, invalid audience, invalid organization, revoked API key, and
  expired invitation tests pass.
- CSRF/origin policy is tested for cookie-authenticated mutations.
- Rate limits and security headers are verified in production-like deployment.

### Reliability

- API readiness fails when required dependencies are unavailable.
- Database backup restoration is tested and timed.
- Webhook, import, and approval retries are idempotent.
- Critical errors produce alerts with correlation IDs.
- Rollback to the previous release is documented and tested.

### Quality

- Backend tests pass.
- Frontend type-check, build, and lint pass with no errors.
- Browser tests cover sign-in, onboarding, import, dashboard, recommendation
  approval, billing, permissions, and failure states.
- CSV templates and customer-facing setup documentation are published.

## Launch gates

The release is **GO** only if all are true:

- [ ] Production authentication and invitation flow pass end-to-end.
- [ ] Production data path and tenant-isolation tests pass.
- [ ] Backup and restore drill is complete.
- [ ] CSV budget and spend import is reliable and idempotent.
- [ ] Approval governance is enforced, not merely configurable.
- [ ] Forecast method and confidence behavior are documented and tested.
- [ ] Stripe test-mode and production-mode webhook flows pass.
- [ ] Monitoring, alerts, support, and rollback runbooks are live.
- [ ] No critical or high security findings remain open.
- [ ] Three design-partner workflows complete without developer intervention.

## Success metrics for the first 30 days

- 80% of invited organizations complete onboarding.
- 90% of valid CSV rows import successfully on the first attempt.
- Median time from import to first recommendation is under 10 minutes.
- 95% of recommendation mutations complete without manual database repair.
- 100% of approval mutations have an audit record.
- 99.5% API availability during business hours.
- Zero confirmed cross-tenant data exposures.
- Zero duplicate Stripe subscription state changes from webhook retries.
- At least three paying or contracted design partners complete the core workflow.

## Ownership

Every gap must have one accountable owner, an acceptance test, and a target date.
No item is considered complete because an endpoint exists; it is complete only
when the UI, authorization, persistence, audit behavior, tests, deployment
configuration, and runbook agree.
