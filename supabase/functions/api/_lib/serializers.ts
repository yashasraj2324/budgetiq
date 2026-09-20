// Response serializers.
import { num, money } from "./helpers.ts";

export function recOut(r: Record<string, unknown>, policy?: Record<string, unknown> | null) {
  const status = String(r.status ?? "pending");
  let escalation: { overdue: boolean; hours_overdue: number; escalate_to: string } | null = null;
  if (policy && status === "pending") {
    const hours = Number(policy.escalation_hours ?? 24);
    const created = r.created_at ? new Date(String(r.created_at)).getTime() : 0;
    if (created) {
      const elapsed = (Date.now() - created) / 3600000;
      if (elapsed > hours) {
        const tiers = ((policy.tiers as { level: number; approver_roles: string[] }[]) ?? []).slice().sort((a, b) => Number(b.level) - Number(a.level));
        const roles = tiers[0]?.approver_roles ?? [];
        escalation = { overdue: true, hours_overdue: Math.round((elapsed - hours) * 10) / 10, escalate_to: roles[0] ?? "" };
      }
    }
  }
  return {
    id: Number(r.id),
    source_line_id: Number(r.source_line_id),
    target_line_id: Number(r.target_line_id),
    amount: num(r.amount),
    confidence: num(r.confidence),
    status,
    rationale_json: r.rationale_json ?? {},
    tier_approvals: Array.isArray(r.tier_approvals) ? r.tier_approvals : [],
    escalation,
    created_at: r.created_at ?? null,
    approved_at: r.approved_at ?? null,
  };
}

export function apiKeyOut(k: Record<string, unknown>) {
  return {
    id: k.id,
    name: k.name,
    scopes: k.scopes ?? [],
    created_at: k.created_at,
    expires_at: k.expires_at ?? null,
    revoked_at: k.revoked_at ?? null,
  };
}

export function scenarioOut(s: Record<string, unknown>) {
  return {
    id: Number(s.id),
    name: s.name,
    created_by: s.created_by ?? "",
    shared: Boolean(s.shared),
    filters: s.filters ?? {},
    created_at: s.created_at ?? null,
    updated_at: s.updated_at ?? null,
  };
}

export function sourceRemainingSafetyCheck(remaining: number, amount: number): boolean {
  return remaining - amount < 0;
}
