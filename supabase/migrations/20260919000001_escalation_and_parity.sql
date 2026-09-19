-- Additive same-business changes for Python-backend parity:
--  escalation fields on recommendations + widened audit action list.

alter table public.recommendations
  add column if not exists escalated boolean not null default false,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_by uuid references auth.users(id) on delete set null;

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
      'organization_config_update', 'fiscal_calendar_updated',
      'recommendation_escalated'
    )
  );
