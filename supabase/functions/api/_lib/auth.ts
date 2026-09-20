// Authentication: JWT + API-key resolution and route-scope mapping.
import { HttpError } from "./helpers.ts";
import { hashKey } from "./tokens.ts";
import type { Ctx, Supabase } from "./types.ts";

export async function resolveAuth(req: Request, supabase: Supabase): Promise<Ctx> {
  // API-key path: `X-API-Key: biq_...` lets external tools use the REST contract
  // with the scopes granted at creation time.
  const apiKeyHeader = req.headers.get("X-API-Key");
  if (apiKeyHeader) {
    const keyHash = await hashKey(apiKeyHeader);
    const { data: key } = await supabase
      .from("organization_api_keys")
      .select("id, organization_id, scopes, created_by, expires_at, revoked_at")
      .eq("key_hash", keyHash)
      .maybeSingle();
    if (!key || key.revoked_at) throw new HttpError(401, "Invalid or revoked API key");
    if (key.expires_at && new Date(String(key.expires_at)).getTime() < Date.now()) {
      throw new HttpError(401, "API key has expired");
    }
    return {
      user_id: (key.created_by as string) ?? "",
      org_id: key.organization_id as string,
      role: "admin",
      display_name: "API Key",
      email: "",
      auth_mode: "key",
      scopes: Array.isArray(key.scopes) ? (key.scopes as string[]) : ["*"],
    };
  }

  const authz = req.headers.get("Authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : null;
  if (!token) throw new HttpError(401, "Bearer authentication required");

  // Real JWT path only — dev-mode bearer tokens are no longer accepted.
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new HttpError(401, "Invalid access token");
  const userEmail = userData.user.email ?? "";
  const userDisplay = (userData.user.user_metadata?.display_name as string) || userEmail.split("@")[0] || "User";

  // Resolve the user's organization. A brand-new signup has no membership yet:
  // provision a personal workspace so onboarding can proceed immediately — but
  // never for an invitation-accept request, which joins the inviting org instead.
  let reqPathname = "";
  try { reqPathname = new URL(req.url).pathname; } catch { /* ignore */ }
  const isInviteAccept = reqPathname.includes("invitations/accept");

  let orgId: string;
  let role: string;
  {
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: true });
    if (memberships && memberships.length > 0) {
      // A user can accumulate multiple auto-provisioned workspaces (each
      // fresh signup/session creates one). Resolve to the ACTIVE workspace —
      // the one holding the most budget lines — so re-login always lands on
      // the org where data actually lives, instead of the oldest (often empty)
      // workspace. Ties fall back to the most recently created membership.
      let membership = memberships[0];
      if (memberships.length > 1) {
        const orgIds = memberships.map((m) => m.organization_id as string);
        const { data: lineRows } = await supabase
          .from("budget_lines")
          .select("organization_id")
          .in("organization_id", orgIds);
        const tally = new Map<string, number>();
        for (const row of lineRows ?? []) {
          tally.set(row.organization_id as string, (tally.get(row.organization_id as string) ?? 0) + 1);
        }
        for (const m of memberships) {
          const count = tally.get(m.organization_id as string) ?? 0;
          // >= (not >) so equal counts resolve to the most recent membership.
          if (count >= (tally.get(membership.organization_id as string) ?? 0)) membership = m;
        }
      }
      orgId = membership.organization_id as string;
      role = (membership.role as string) || "finance_user";
    } else if (isInviteAccept) {
      // No membership and not provisioning: the accept handler resolves the org.
      orgId = "";
      role = "";
    } else {
      const { data: newOrg, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: `${userDisplay}'s Workspace`, fiscal_year: "FY25", currency: "INR" })
        .select("id")
        .single();
      if (orgErr) throw new HttpError(500, `Unable to provision workspace: ${orgErr.message}`);
      const { error: memberErr } = await supabase.from("organization_members").insert({
        organization_id: newOrg.id,
        user_id: userData.user.id,
        role: "admin",
      });
      if (memberErr) throw new HttpError(500, `Unable to provision membership: ${memberErr.message}`);
      orgId = newOrg.id as string;
      role = "admin";
    }
  }

  return {
    user_id: userData.user.id,
    org_id: orgId,
    role,
    display_name: userDisplay,
    email: userEmail,
    auth_mode: "jwt",
    scopes: [],
  };
}

// Map a route + method to the API-key scope that authorizes it. API-key requests
// are denied whenever the required scope (or "*") is not on the key.
export function requiredScope(seg: string[], method: string): string | null {
  const first = seg[0] ?? "";
  const isRead = method === "GET";
  switch (first) {
    case "dashboard":
    case "departments":
    case "anomalies":
    case "performance-scores":
      return isRead ? "budgets:read" : "budgets:write";
    case "budget-lines":
      return isRead ? "budgets:read" : "budgets:write";
    case "spend":
      return isRead ? "budgets:read" : "budgets:write";
    case "recommendations": {
      if (seg[2] && ["approve", "modify", "reject"].includes(seg[2])) return "approvals:write";
      return isRead ? "recommendations:read" : "recommendations:write";
    }
    case "audit":
      return "reports:read";
    case "governance":
      return isRead ? "approvals:read" : "approvals:write";
    case "scenarios":
      return isRead ? "scenarios:read" : "scenarios:write";
    case "api-keys":
      return "api_keys:manage";
    case "onboarding":
      return seg[1] === "config" ? (isRead ? "organization:read" : "organization:write") : "budgets:write";
    case "organization":
      return isRead ? "organization:read" : "organization:write";
    default:
      return null;
  }
}
