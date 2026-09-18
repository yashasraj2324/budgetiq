# BudgetIQ implementation gaps

**As of:** 2026-09-18

This file tracks remaining launch work after the current pilot hardening pass.

## Resolved in this milestone

- Replaced scenario-page placeholder create action with a real `POST /api/scenarios` flow.
- Added scenario rename/share/duplicate/delete workflows with server responses surfaced in UI.
- Replaced governance placeholder card with an editable policy UI backed by
  `GET/PUT /api/governance/approval-policy` (tiers, roles, dual-sign,
  delegated approvers, escalation window).
- Reworked integrations page to truthful pilot scope (CSV/manual path only,
  ERP connectors deferred).
- Added customer-facing admin surfaces for:
  - API keys (`list/create/rotate/revoke`, one-time secret display, scopes, expiry)
  - Membership and invitation operations (`list/invite/resend/revoke/role change/removal`)
  - Fiscal calendar settings (`GET/PUT /api/organization/fiscal-calendar`)
- Enforced API-key scopes at request time via route-to-scope mapping in auth.
- Hardened auth defaults: development token and organization are now explicit;
  JWT checks include required expiry plus optional issuer/audience and active
  membership validation.
- Removed frontend TypeScript blocker from `layout.tsx` and excluded E2E files
  from production TS build while keeping a separate `npm run e2e` command.
- Marked billing/Stripe as deferred and non-blocking for startup and core flows.

## Explicitly deferred (intentional)

- Direct ERP/FP&A connectors and automated write-back.
- Stripe checkout/customer portal production rollout.
- Production email delivery and full Supabase deployment plumbing.
- Postgres adapter cutover (Mongo remains active runtime in this workspace).

## Remaining launch-risk gaps

- End-to-end production environment setup (Supabase auth, SMTP, secret manager,
  redirect allowlists, backup/restore drills).
- Broader integration tests for multi-tenant cross-route denial at HTTP level.
- Operational runbooks for incident response and key rotation cadence.

## Non-goals for this milestone

- Building new payment features.
- Shipping fake connector toggles or placeholder success paths.
