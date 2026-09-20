// Approval policy enforcement (tiers / delegation / dual-sign / escalation)
// and invitation acceptance.
import { APPROVER_ROLES } from "./constants.ts";
import { HttpError, json } from "./helpers.ts";
import { hashKey } from "./tokens.ts";
import { logAudit } from "./metrics.ts";
import type { Supabase } from "./types.ts";

export async function loadApprovalPolicy(supabase: Supabase, orgId: string): Promise<{
  tiers: { level: number; min_amount: number; approver_roles: string[] }[];
  escalation_hours: number;
  delegated_approvers: string[];
  dual_sign: boolean;
}> {
  const { data: policy } = await supabase.from("approval_policies").select("*").eq("organization_id", orgId).maybeSingle();
  if (policy) {
    return {
      tiers: Array.isArray(policy.tiers)
        ? (policy.tiers as { level: number; min_amount: number; approver_roles: string[] }[])
        : [],
      escalation_hours: Number(policy.escalation_hours ?? 24),
      delegated_approvers: Array.isArray(policy.delegated_approvers) ? (policy.delegated_approvers as string[]) : [],
      dual_sign: Boolean(policy.dual_sign),
    };
  }
  return {
    tiers: [{ level: 1, min_amount: 0, approver_roles: [...APPROVER_ROLES] }],
    escalation_hours: 24,
    delegated_approvers: [],
    dual_sign: false,
  };
}

export function actorEligible(userRole: string, userId: string, tier: { approver_roles?: string[] } | null, policy: Record<string, unknown>) {
  const roles = new Set((tier?.approver_roles ?? []) as string[]);
  if (roles.has(userRole)) return true;
  const delegated = (policy?.delegated_approvers ?? []) as string[];
  return delegated.includes(userId);
}

// Accept a pending invitation: the authenticated user's email must match the
// invitation, which then grants membership in the inviting organization.
export async function acceptInvitation(supabase: Supabase, ctx: { user_id: string; email: string }, rawToken: string) {
  if (!rawToken.trim()) throw new HttpError(422, "Invitation token is required");
  const tokenHash = await hashKey(rawToken.trim());
  const { data: inv } = await supabase.from("organization_invitations").select("*").eq("token_hash", tokenHash).maybeSingle();
  if (!inv) throw new HttpError(404, "Invitation not found");
  if (inv.status !== "pending") throw new HttpError(409, `Invitation is already ${inv.status}`);
  if (new Date(String(inv.expires_at)).getTime() < Date.now()) throw new HttpError(410, "Invitation has expired");
  if (String(inv.email).toLowerCase() !== ctx.email.toLowerCase()) {
    throw new HttpError(403, "This invitation was issued for a different email address");
  }
  const { data: existingMember } = await supabase.from("organization_members")
    .select("user_id").eq("organization_id", inv.organization_id).eq("user_id", ctx.user_id).maybeSingle();
  if (!existingMember) {
    const { error: memberErr } = await supabase.from("organization_members").insert({
      organization_id: inv.organization_id as string,
      user_id: ctx.user_id,
      role: inv.role as string,
    });
    if (memberErr) throw new HttpError(500, `Unable to join organization: ${memberErr.message}`);
  }
  await supabase.from("organization_invitations").update({ status: "accepted" }).eq("id", inv.id);
  await logAudit(supabase, { user_id: ctx.user_id, role: "", display_name: "", org_id: inv.organization_id as string }, "invitation_accepted", { invitation_id: inv.id, email: inv.email, role: inv.role });
  return json({ accepted: true, organization_id: inv.organization_id });
}
