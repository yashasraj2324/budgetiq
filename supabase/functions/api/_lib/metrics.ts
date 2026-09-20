// Org-scoped metrics + audit helpers.
import { num, money } from "./helpers.ts";
import type { Supabase } from "./types.ts";

// Load per-line live budget metrics for an organization.
export async function loadMetrics(
  supabase: Supabase,
  orgId: string,
): Promise<{ spentByLine: Map<number, number>; outgoingByLine: Map<number, number>; incomingByLine: Map<number, number> }> {
  const spentByLine = new Map<number, number>();
  const { data: spends } = await supabase.from("spend_entries").select("budget_line_id, amount_spent").eq("organization_id", orgId);
  for (const s of spends ?? []) {
    spentByLine.set(Number(s.budget_line_id), (spentByLine.get(Number(s.budget_line_id)) ?? 0) + num(s.amount_spent));
  }
  const outgoingByLine = new Map<number, number>();
  const incomingByLine = new Map<number, number>();
  const { data: recs } = await supabase
    .from("recommendations")
    .select("source_line_id, target_line_id, amount, status")
    .eq("organization_id", orgId)
    .in("status", ["approved", "modified"]);
  for (const r of recs ?? []) {
    const amount = num(r.amount);
    outgoingByLine.set(Number(r.source_line_id), (outgoingByLine.get(Number(r.source_line_id)) ?? 0) + amount);
    incomingByLine.set(Number(r.target_line_id), (incomingByLine.get(Number(r.target_line_id)) ?? 0) + amount);
  }
  return { spentByLine, outgoingByLine, incomingByLine };
}

export function liveRemaining(
  line: { id: number; allocated_amount: number },
  metrics: { spentByLine: Map<number, number>; outgoingByLine: Map<number, number>; incomingByLine: Map<number, number> },
): number {
  return money(
    num(line.allocated_amount) -
    (metrics.spentByLine.get(Number(line.id)) ?? 0) -
    (metrics.outgoingByLine.get(Number(line.id)) ?? 0) +
    (metrics.incomingByLine.get(Number(line.id)) ?? 0),
  );
}

// User email/display resolution for members + audit actor display.
export async function usersByEmail(supabase: Supabase): Promise<Map<string, string>> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const map = new Map<string, string>();
  for (const u of data?.users ?? []) {
    if (u.email) map.set(u.id, u.email);
  }
  return map;
}

export async function logAudit(
  supabase: Supabase,
  ctx: { org_id: string; user_id: string; role: string; display_name: string },
  action: string,
  eventMetadata: Record<string, unknown>,
  recommendationId: number | null = null,
) {
  const { error } = await supabase.from("audit_events").insert({
    organization_id: ctx.org_id,
    recommendation_id: recommendationId,
    action,
    actor: ctx.user_id,
    actor_role: ctx.role,
    event_metadata: { actor_user_id: ctx.user_id, actor_role: ctx.role, actor_display_name: ctx.display_name, ...eventMetadata },
  });
  if (error) console.error("audit insert failed:", error.message);
}
