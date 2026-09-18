# Implement every unfinished feature (nothing removed)

## Context

The user asked to verify there are no placeholders, fake features, or unimplemented
options, and to **implement** anything unfinished — not remove it. Stripe billing is
excluded (user: "for now don't add stripe"); the billing page/section stays as-is.

Audit findings (each maps to an implementation item):

1. **API keys are unusable.** Settings lets you create/rotate/revoke API keys, but the
   gateway (`supabase/functions/api/index.ts`) only accepts `Authorization: Bearer <JWT>`
   via `supabase.auth.getUser`. A key (`biq_…`) gets `401 Invalid access token`, and key
   scopes are never enforced.
2. **Approval policy is stored but not enforced.** `governance/approval-policy` tiers,
   `dual_sign`, `delegated_approvers`, `escalation_hours` are saved but `approve/modify`
   only checks `APPROVER_ROLES` and `status === "pending"`. No tier/dual-sign/delegation/
   escalation logic runs (the Python `backend/app/services/approval_engine.py` has it).
3. **Invitations have no acceptance flow.** `POST /organization/invitations` returns a
   token but nothing can consume it; the frontend just prints the token text.
4. **Password reset is one-sided.** `reset-password.tsx` only calls `auth/v1/recover`; it
   never handles the recovery link (`token_hash` + `type=recovery`) or lets the user set a
   new password.
5. **No way to record spend.** `spend_entries` drive remaining-budget, anomalies, and
   forecasts, but there is no endpoint or UI to add spend.
6. **Fabricated narrative.** `RechartsChart.tsx` hardcodes "Regional Events … 2.8× … W09".
7. **Hardcoded fiscal/org labels.** Dashboard and Shell render "FY25 Q2 / Apr 01–Jun 30 /
   FY25 Q3 Active" instead of the org's saved config + fiscal calendar.
8. **Deterministic AI fallback remains** in `generate` (also `backend/app/services/qwen.py`),
   contrary to the prior explicit no-fallback requirement.
9. **Integrations page advertises "Deferred connectors"** with no real section.
10. **Remote `seed` function status unknown** (deleted locally; may still be deployed).

All changes are additive/behavioral. No existing feature or copy is deleted; the
"Deferred connectors" placeholder becomes a real API-access section.

## Implementation checklist

### A. Make API keys real (gateway)
File: `supabase/functions/api/index.ts`
- [ ] `resolveAuth`: if `X-API-Key` header present, `hashKey` it and look up
      `organization_api_keys` (org-scoped, `revoked_at is null`, not expired). Build a ctx
      with `{ org_id, user_id: created_by, role: "admin", auth_mode: "key", scopes }`; invalid
      key → 401.
- [ ] Add `requireScope(ctx, seg, method)` mapping routes to scopes
      (`budgets:read|write`, `recommendations:read|write`, `approvals:read|write`,
      `reports:read`, `organization:read|write`, `scenarios:read|write`,
      `api_keys:manage`, `*`). In `handleRequest`, when `auth_mode === "key"` and the
      required scope is missing and `*` not present → 403.
- [ ] Keep JWT path unchanged (role-based admin/approver checks stay as they are).

### B. Enforce the approval policy (gateway + migration)
Files: `supabase/functions/api/index.ts`, new migration
`supabase/migrations/20260918XXXX_approval_state.sql`
- [ ] Migration (additive, same-business): `alter table public.recommendations add column
      if not exists tier_approvals jsonb not null default '[]'::jsonb;` and widen
      `audit_events` action CHECK to add `invitation_accepted`, `spend_entry_added`.
- [ ] Port the Python tier/dual-sign/delegated logic into the gateway `approve` branch:
      load `approval_policies`, pick applicable tier by `amount`, require actor role ∈
      tier.approver_roles **or** actor ∈ delegated_approvers; on first signature append
      `{tier_level, actor_user_id, actor_role, approved_at}` to `tier_approvals` and keep
      status `pending` unless fully approved; second signature (higher tier or second
      dual-sign signer, different actor) sets `approved`. Same checks apply to `modify`.
- [ ] `reject`: allowed while pending; keep current behavior but require the actor to be in
      any tier's approver roles (or delegated).
- [ ] `recOut` returns `tier_approvals` and an `escalation` field computed from
      `created_at` vs `escalation_hours` (overdue + `escalate_to` = highest tier's first
      role) for non-final states.
- [ ] Do not create new status values; `pending` remains until fully approved so the
      existing UI still shows actions.

### C. Working invitations
Files: `supabase/functions/api/index.ts`, `src/App.tsx`, new
`src/pages/accept-invitation.tsx`, `src/pages/settings.tsx`
- [ ] Gateway `GET /organization/invitations` also returns the invite `token` (admin-only
      list) so a copyable link can be rebuilt; `resend` already regenerates a token.
- [ ] Gateway `POST /organization/invitations/accept` with `{ token }`: hash-match a
      `pending`, unexpired invitation; the authenticated user's email must equal
      `invitation.email`; insert `organization_members` row (org + role); set status
      `accepted`; log `invitation_accepted`; return `{ accepted: true, organization_id }`.
      Invalid/expired/already-accepted → clear 4xx errors.
- [ ] New route `/accept-invitation` page: reads `?token=`; if no access token in
      sessionStorage shows the email/password sign-in (same fetch as `index.tsx`), then
      calls accept; success → `/dashboard`; errors displayed inline.
- [ ] Settings: per pending invitation add "Copy invite link" that builds
      `${origin}/accept-invitation?token=<token>` (token from the list / last resend) and
      copies it; show the link text under the invitation.

### D. Complete password reset
File: `src/pages/reset-password.tsx`
- [ ] Detect `type=recovery` + `token_hash` in the URL; verify via
      `POST /auth/v1/verify { type:"recovery", token_hash }` to obtain a session; store the
      access token in sessionStorage like login.
- [ ] When a recovery session is active, render "Set new password" → `PUT /auth/v1/user`
      `{ new_password }`, then navigate to `/dashboard`.
- [ ] Otherwise keep the existing "request reset" form.

### E. Record spend (gateway + UI)
Files: `supabase/functions/api/index.ts`, `src/pages/budget-lines/[id].tsx`
- [ ] Gateway `POST /budget-lines/:id/spend` `{ period, amount_spent }` (admin): validate
      `amount_spent >= 0`, upsert `spend_entries` on `(organization_id, budget_line_id, period)`;
      log `spend_entry_added`.
- [ ] Budget-line detail page: add an "Add spend entry" form (period text, amount) calling
      the endpoint, then reload the detail (spend history + remaining/status refresh).

### F. Real forecast/anomaly narrative
File: `src/components/RechartsChart.tsx`
- [ ] Fetch `/anomalies` + `/budget-lines`; pick the line with the highest
      `velocity_multiplier`; fetch that line's `/forecast`. Replace the hardcoded
      "Regional Events … 2.8× … W09" paragraph with real text from that line
      (name, multiplier, latest period) or a real "no significant anomaly" message.
- [ ] Render real projected bars only (already backed by the forecast endpoint).

### G. Real org/fiscal labels
Files: `src/pages/dashboard.tsx`, `src/components/Shell.tsx`
- [ ] Fetch `/onboarding/config` + `/organization/fiscal-calendar` alongside existing loads;
      render `org_name`, `fiscal_year`, `currency`, and the current period label computed
      from `fiscal_year_start_month` + `period_type` in the header, filter chip, and metric
      captions. Default to existing labels while loading (no layout shift).

### H. Remove deterministic AI fallback
Files: `supabase/functions/api/index.ts`, `backend/app/services/qwen.py`
- [ ] `generate`: if `groqReasoning` returns null/void (unconfigured, error, invalid
      output), return `503` with a clear `detail` (e.g. "AI reasoning unavailable — check
      the provider configuration. No recommendation was created."). Delete the
      `deterministic_fallback` rationale branch and `explanation_source:
      deterministic_fallback`.
- [ ] `qwen.py`: replace the `_fallback_reasoning` returns with raising an error
      (`RuntimeError`/503 semantics) so the failure surfaces instead of being substituted.

### I. Integrations page — replace placeholder with real API section
File: `src/pages/integrations.tsx`
- [ ] Replace the "Deferred connectors" card with a "Programmatic API access" card: shows
      the `X-API-Key` header usage, a real curl example against `${API}/budget-lines`, where
      keys are created (link to `/settings`), and the scope list. No fake connectors.

### J. Seed endpoint — verify and disable remotely
- [ ] Check whether the `seed` backend function is still deployed (search its runtime logs /
      attempt one unauthenticated probe). If present, redeploy it with a stub that returns
      `410 Gone` to every request so it can no longer create data; keep all existing rows.

## Files touched
- `supabase/functions/api/index.ts` (A–F, H, J)
- `supabase/migrations/20260918XXXX_approval_state.sql` (new, B)
- `src/App.tsx`, `src/pages/accept-invitation.tsx` (new, C)
- `src/pages/reset-password.tsx` (D)
- `src/pages/budget-lines/[id].tsx` (E)
- `src/components/RechartsChart.tsx` (F)
- `src/pages/dashboard.tsx`, `src/components/Shell.tsx` (G)
- `backend/app/services/qwen.py` (H)
- `src/pages/integrations.tsx` (I)
- `supabase/functions/seed/index.ts` (J, if deployed)

## Verification checklist
- [ ] `pnpm lint` and `pnpm build` pass after frontend changes.
- [ ] Deploy the `api` backend function; gateway requests still work for the existing
      dashboard/onboarding flows (JWT).
- [ ] API keys: create a key with `budgets:write`; `curl -H "X-API-Key: …"` on
      `GET /budget-lines` and `POST /budget-lines/:id/spend` succeed; `POST /scenarios`
      → 403 (scope denied); revoked/expired/garbage key → 401.
- [ ] Approval policy: set 2 tiers; generate a recommendation; a non-tier role's approve →
      403 with tier message; tier-1 approve keeps it `pending` with `tier_approvals`
      length 1; tier-2 approve sets `approved`. Dual-sign second signer must differ.
- [ ] Invitations: create → copy link → open `/accept-invitation?token=…` signed out shows
      sign-in → sign in with the invited email → accept succeeds → user lands on
      `/dashboard`; invitation status `accepted`; a second accept returns a clear error.
- [ ] Password reset: recovery link flow lets a user set a new password, then log in with
      it (verify recovery session works end-to-end).
- [ ] Spend entry: POST via UI updates the line detail and dashboard remaining/signals.
- [ ] Forecast card shows real anomaly line data, no "2.8×/W09/Regional Events" string in
      the source or rendered output.
- [ ] Dashboard/Shell show the saved org name, fiscal year, currency, and current period.
- [ ] Generate a recommendation with Groq intentionally failing → `503` with a clear
      message and **no** row created (`explanation_source: deterministic_fallback` no
      longer exists).
- [ ] `seed` function (if deployed) returns `410`; existing rows unchanged.
- [ ] Screenshots: `/dashboard`, `/approvals`, `/settings`, `/integrations`,
      `/budget-lines/1`, `/accept-invitation` — no leftover placeholder copy.
- [ ] No existing table data was reset or deleted; migration is additive
      (`add column if not exists`, CHECK widening only).
