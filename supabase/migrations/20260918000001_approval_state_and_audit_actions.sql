-- Additive same-business changes:
--  1) recommendations gains a tier_approvals ledger for multi-tier / dual-sign approval.
--  2) audit_events action CHECK is widened: some gateway audit actions already in use
--     (organization_config_update, fiscal_calendar_updated, member_deactivated,
--     invitation_cancelled, api_key_rotated) were missing from the original constraint
--     and silently failing, plus the new invitation_accepted and spend_entry_added.

alter table public.recommendations
  add column if not exists tier_approvals jsonb not null default '[]'::jsonb;

alter table public.audit_events
  drop constraint if exists audit_events_action_check;

alter table public.audit_events
  add constraint audit_events_action_check check (
    action in (
      'approve', 'modify', 'reject',
      'onboarding_data', 'onboarding_priorities', 'onboarding_policies',
      'policy_update', 'budget_line_create', 'budget_line_update',
      'budget_line_delete', 'budget_line_import', 'spend_entry_added',
      'membership_role_update', 'member_deactivated',
      'invitation_created', 'invitation_accepted', 'invitation_cancelled',
      'approval_policy_updated', 'api_key_created', 'api_key_rotated', 'api_key_revoked',
      'organization_config_update', 'fiscal_calendar_updated'
    )
  );
