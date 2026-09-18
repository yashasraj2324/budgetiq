# BudgetIQ fake and misleading surfaces

**As of:** 2026-09-18

This inventory tracks UI/actions that look available but are not actually
implemented. Resolved items are removed from the active fake list.

## Resolved fake surfaces

- `frontend/src/app/scenarios/page.tsx`
  - Replaced the `New Scenario` alert-only button with a validated create form
    backed by `POST /api/scenarios`.
  - Added real rename/share/duplicate/delete actions wired to API responses.
- `frontend/src/app/governance/page.tsx`
  - Replaced static placeholder card with a full editable governance form
    backed by existing governance APIs.
- `frontend/src/app/integrations/page.tsx`
  - Removed misleading connector CTA language and replaced with truthful
    CSV/manual ingestion guidance.
- `frontend/src/app/billing/page.tsx`
  - Removed active Stripe action buttons and replaced with explicit
    "Billing deferred" messaging.

## Current truthful deferred surfaces

- ERP/FP&A direct connectors are deferred.
- Stripe billing workflows are deferred and disabled by default.

These are intentionally labeled as deferred and are not presented as active
customer actions.

## Truthfulness rule (enforced)

Every visible control must either:

1. complete and persist the advertised action,
2. navigate to a working workflow that does, or
3. be explicitly labeled deferred/unavailable.

No active control should rely on "coming soon" alerts or fake success states.
