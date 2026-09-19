"use client";

import { Shell } from "@/components/Shell";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { API, apiError, apiFetch } from "@/lib/api";
import { trackEvent } from '@enter-pro/analytics-sdk';

interface WorkspaceConfig {
  org_name?: string;
  fiscal_year?: string;
  currency?: string;
}

interface FiscalCalendar {
  fiscal_year_start_month: number;
  period_type: "monthly" | "quarterly" | "custom";
  period_labels: string[];
}

interface Membership {
  user_id: string;
  email: string;
  role: string;
  status: string;
  created_at?: string;
}

interface Invitation {
  id: number;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at?: string;
}

interface ApiKeyItem {
  id: number;
  name: string;
  scopes: string[];
  created_at: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  key?: string | null;
  status?: string;
}

const roleOptions = ["finance_user", "Budget Analyst", "Finance Manager", "Controller", "VP Finance", "CFO", "admin"];
const scopeOptions = [
  "budgets:read",
  "budgets:write",
  "recommendations:read",
  "recommendations:write",
  "approvals:read",
  "approvals:write",
  "reports:read",
  "organization:read",
  "organization:write",
  "scenarios:read",
  "scenarios:write",
  "api_keys:manage",
  "*",
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [config, setConfig] = useState<WorkspaceConfig>({});
  const [calendar, setCalendar] = useState<FiscalCalendar>({
    fiscal_year_start_month: 1,
    period_type: "quarterly",
    period_labels: ["Q1", "Q2", "Q3", "Q4"],
  });

  const [members, setMembers] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["budgets:read"]);
  const [newKeyExpiryDays, setNewKeyExpiryDays] = useState(30);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("finance_user");
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteLinks, setInviteLinks] = useState<Record<number, string>>({});

  const invitationLink = (token: string) =>
    `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [configResponse, calendarResponse, memberResponse, invitationResponse, apiKeyResponse] = await Promise.all([
        apiFetch(`${API}/onboarding/config`),
        apiFetch(`${API}/organization/fiscal-calendar`),
        apiFetch(`${API}/organization/members`),
        apiFetch(`${API}/organization/invitations`),
        apiFetch(`${API}/api-keys`),
      ]);

      if (!configResponse.ok) throw new Error(await apiError(configResponse, "Unable to load organization config"));
      if (!calendarResponse.ok) throw new Error(await apiError(calendarResponse, "Unable to load fiscal calendar"));
      if (!memberResponse.ok) throw new Error(await apiError(memberResponse, "Unable to load members"));
      if (!invitationResponse.ok) throw new Error(await apiError(invitationResponse, "Unable to load invitations"));
      if (!apiKeyResponse.ok) throw new Error(await apiError(apiKeyResponse, "Unable to load API keys"));

      setConfig(await configResponse.json());
      setCalendar(await calendarResponse.json());
      setMembers(await memberResponse.json());
      setInvitations(await invitationResponse.json());
      setApiKeys(await apiKeyResponse.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveOrganizationConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);

    const response = await apiFetch(`${API}/organization/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_name: formData.get("org_name"),
        fiscal_year: formData.get("fiscal_year"),
        currency: formData.get("currency"),
      }),
    });

    if (!response.ok) {
      setError(await apiError(response, "Unable to save organization settings"));
      return;
    }

    setConfig(await response.json());
    setMessage("Organization settings saved.");
  }

  async function saveFiscalCalendar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const response = await apiFetch(`${API}/organization/fiscal-calendar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calendar),
    });

    if (!response.ok) {
      setError(await apiError(response, "Unable to save fiscal calendar"));
      return;
    }

    setCalendar(await response.json());
    setMessage("Fiscal calendar saved.");
  }

  async function updateMemberRole(memberId: string, role: string) {
    setError("");
    setMessage("");
    const response = await apiFetch(`${API}/organization/members/${encodeURIComponent(memberId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      setError(await apiError(response, "Unable to update member role"));
      return;
    }

    const updated = (await response.json()) as Membership;
    setMembers((previous) => previous.map((member) => (member.user_id === updated.user_id ? updated : member)));
    setMessage("Member role updated.");
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this member from the organization?")) return;

    setError("");
    setMessage("");
    const response = await apiFetch(`${API}/organization/members/${encodeURIComponent(memberId)}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await apiError(response, "Unable to remove member"));
      return;
    }
    setMembers((previous) => previous.filter((member) => member.user_id !== memberId));
    setMessage("Member removed.");
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const response = await apiFetch(`${API}/organization/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, expires_in_days: inviteDays }),
    });

    if (!response.ok) {
      setError(await apiError(response, "Unable to create invitation"));
      return;
    }

    const invitation = await response.json();
    setInviteEmail("");
    trackEvent('invitation_created', { eventType: 'custom' });
    if (invitation.token) {
      const link = invitationLink(invitation.token);
      setInviteLinks((previous) => ({ ...previous, [invitation.id]: link }));
      setMessage(`Invitation created for ${invitation.email}. Invite link ready to copy below.`);
    } else {
      setMessage(`Invitation created for ${invitation.email}.`);
    }
    await reload();
  }

  async function resendInvitation(invitationId: number) {
    setError("");
    setMessage("");

    const response = await apiFetch(`${API}/organization/members/${invitationId}/resend-invitation`, { method: "POST" });
    if (!response.ok) {
      setError(await apiError(response, "Unable to resend invitation"));
      return;
    }

    const payload = await response.json();
    if (payload.token) {
      const link = invitationLink(payload.token);
      setInviteLinks((previous) => ({ ...previous, [invitationId]: link }));
      setMessage("Invitation resent. New invite link ready to copy below.");
    } else {
      setMessage("Invitation resent.");
    }
  }

  async function cancelInvitation(invitationId: number) {
    setError("");
    setMessage("");

    const response = await apiFetch(`${API}/organization/invitations/${invitationId}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await apiError(response, "Unable to cancel invitation"));
      return;
    }

    setInvitations((previous) => previous.filter((invitation) => invitation.id !== invitationId));
    setMessage("Invitation cancelled.");
  }

  async function copyInviteLink(invitationId: number) {
    const link = inviteLinks[invitationId];
    if (!link) {
      setMessage("Generate a link first by creating or resending the invitation.");
      return;
    }
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Invitation link copied.");
    } catch {
      setMessage(`Invitation link: ${link}`);
    }
  }

  async function createApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setNewlyCreatedSecret(null);

    const response = await apiFetch(`${API}/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes, expires_in_days: newKeyExpiryDays || null }),
    });

    if (!response.ok) {
      setError(await apiError(response, "Unable to create API key"));
      return;
    }

    const created = (await response.json()) as ApiKeyItem;
    setNewlyCreatedSecret(created.key ?? null);
    setNewKeyName("");
    setNewKeyScopes(["budgets:read"]);
    setNewKeyExpiryDays(30);
    setMessage("API key created.");
    trackEvent('api_key_created', { eventType: 'custom' });
    await reload();
  }

  async function rotateApiKey(keyId: number) {
    setError("");
    setMessage("");
    setNewlyCreatedSecret(null);

    const response = await apiFetch(`${API}/api-keys/${keyId}/rotate`, { method: "POST" });
    if (!response.ok) {
      setError(await apiError(response, "Unable to rotate API key"));
      return;
    }

    const rotated = (await response.json()) as ApiKeyItem;
    setNewlyCreatedSecret(rotated.key ?? null);
    setMessage("API key rotated.");
    await reload();
  }

  async function revokeApiKey(keyId: number) {
    setError("");
    setMessage("");

    const response = await apiFetch(`${API}/api-keys/${keyId}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await apiError(response, "Unable to revoke API key"));
      return;
    }

    setApiKeys((previous) =>
      previous.map((key) => (key.id === keyId ? { ...key, revoked_at: new Date().toISOString() } : key)),
    );
    setMessage("API key revoked.");
  }

  const periodLabelsInput = useMemo(() => calendar.period_labels.join(", "), [calendar.period_labels]);

  return (
    <Shell activePath="settings">
      <div className="flex flex-col w-full gap-space-xl max-w-6xl mx-auto">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Workspace Settings</h1>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Manage organization configuration, fiscal periods, members, invitations, and API keys.
          </p>
        </div>

        {error && <p role="alert" className="text-error">{error}</p>}
        {message && <p role="status" className="text-primary-container">{message}</p>}

        {newlyCreatedSecret && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg">
            <h2 className="font-semibold text-on-surface mb-2">API key secret (shown once)</h2>
            <code className="block break-all bg-surface px-3 py-2 rounded text-sm">{newlyCreatedSecret}</code>
          </div>
        )}

        {loading ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg text-outline">Loading settings...</div>
        ) : (
          <>
            <form onSubmit={saveOrganizationConfig} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg space-y-space-md">
              <h2 className="font-headline-md text-on-surface">Organization profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                <label className="block text-sm text-on-surface">
                  Organization
                  <input name="org_name" defaultValue={config.org_name ?? ""} required className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface" />
                </label>
                <label className="block text-sm text-on-surface">
                  Fiscal year label
                  <input name="fiscal_year" defaultValue={config.fiscal_year ?? ""} required className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface" />
                </label>
                <label className="block text-sm text-on-surface">
                  Currency
                  <input name="currency" maxLength={3} defaultValue={config.currency ?? "INR"} required className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface uppercase" />
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Save organization</button>
              </div>
            </form>

            <form onSubmit={saveFiscalCalendar} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg space-y-space-md">
              <h2 className="font-headline-md text-on-surface">Fiscal calendar</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                <label className="block text-sm text-on-surface">
                  Start month
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={calendar.fiscal_year_start_month}
                    onChange={(event) =>
                      setCalendar((previous) => ({ ...previous, fiscal_year_start_month: Number(event.target.value || 1) }))
                    }
                    className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface"
                  />
                </label>
                <label className="block text-sm text-on-surface">
                  Period type
                  <select
                    value={calendar.period_type}
                    onChange={(event) =>
                      setCalendar((previous) => ({
                        ...previous,
                        period_type: event.target.value as FiscalCalendar["period_type"],
                      }))
                    }
                    className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface"
                  >
                    <option value="monthly">monthly</option>
                    <option value="quarterly">quarterly</option>
                    <option value="custom">custom</option>
                  </select>
                </label>
                <label className="block text-sm text-on-surface">
                  Period labels (comma-separated)
                  <input
                    value={periodLabelsInput}
                    onChange={(event) =>
                      setCalendar((previous) => ({
                        ...previous,
                        period_labels: event.target.value
                          .split(",")
                          .map((label) => label.trim())
                          .filter(Boolean),
                      }))
                    }
                    className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Save fiscal calendar</button>
              </div>
            </form>

            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg space-y-space-md">
              <h2 className="font-headline-md text-on-surface">Membership and invitations</h2>
              <form onSubmit={createInvitation} className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
                <label className="block text-sm text-on-surface md:col-span-2">
                  Invite email
                  <input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface" />
                </label>
                <label className="block text-sm text-on-surface">
                  Role
                  <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface">
                    {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label className="block text-sm text-on-surface">
                  Expiry days
                  <input type="number" min={1} max={90} value={inviteDays} onChange={(event) => setInviteDays(Number(event.target.value || 7))} className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface" />
                </label>
                <div className="md:col-span-4 flex justify-end">
                  <button type="submit" className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Invite member</button>
                </div>
              </form>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
                <div>
                  <h3 className="font-semibold text-on-surface mb-2">Members</h3>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.user_id} className="rounded border border-outline-variant p-3 flex flex-col gap-2">
                        <div className="text-sm text-on-surface font-medium">{member.email || member.user_id}</div>
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(event) => void updateMemberRole(member.user_id, event.target.value)}
                            className="rounded border border-outline-variant px-2 py-1 bg-surface text-sm"
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                          <button onClick={() => void removeMember(member.user_id)} className="text-sm text-error">Remove</button>
                        </div>
                      </div>
                    ))}
                    {!members.length && <p className="text-sm text-outline">No active members.</p>}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-on-surface mb-2">Pending invitations</h3>
                  <div className="space-y-2">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="rounded border border-outline-variant p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-on-surface font-medium">{invitation.email}</p>
                            <p className="text-xs text-outline">{invitation.role} - {invitation.status}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => void resendInvitation(invitation.id)} className="text-sm text-primary">Resend</button>
                            <button onClick={() => void cancelInvitation(invitation.id)} className="text-sm text-error">Revoke</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void copyInviteLink(invitation.id)}
                            disabled={!inviteLinks[invitation.id]}
                            className="text-sm text-primary disabled:opacity-40"
                          >
                            {inviteLinks[invitation.id] ? "Copy invite link" : "Resend to get link"}
                          </button>
                          {inviteLinks[invitation.id] && (
                            <span className="text-xs text-outline truncate max-w-[260px]">{inviteLinks[invitation.id]}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {!invitations.length && <p className="text-sm text-outline">No pending invitations.</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg space-y-space-md">
              <h2 className="font-headline-md text-on-surface">API keys</h2>
              <form onSubmit={createApiKey} className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
                <label className="block text-sm text-on-surface">
                  Name
                  <input value={newKeyName} required onChange={(event) => setNewKeyName(event.target.value)} className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface" />
                </label>
                <label className="block text-sm text-on-surface">
                  Expiry (days)
                  <input type="number" min={1} max={3650} value={newKeyExpiryDays} onChange={(event) => setNewKeyExpiryDays(Number(event.target.value || 30))} className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface" />
                </label>
                <label className="block text-sm text-on-surface md:col-span-2">
                  Scopes
                  <select
                    multiple
                    value={newKeyScopes}
                    onChange={(event) =>
                      setNewKeyScopes(Array.from(event.target.selectedOptions).map((option) => option.value))
                    }
                    className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface min-h-24"
                  >
                    {scopeOptions.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
                  </select>
                </label>
                <div className="md:col-span-4 flex justify-end">
                  <button type="submit" className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Create API key</button>
                </div>
              </form>

              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div key={key.id} className="rounded border border-outline-variant p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-on-surface">{key.name}</p>
                      <p className="text-xs text-outline">Scopes: {key.scopes.join(", ")}</p>
                      <p className="text-xs text-outline">Status: {key.revoked_at ? "revoked" : "active"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void rotateApiKey(key.id)} className="text-sm text-primary">Rotate</button>
                      {!key.revoked_at && <button onClick={() => void revokeApiKey(key.id)} className="text-sm text-error">Revoke</button>}
                    </div>
                  </div>
                ))}
                {!apiKeys.length && <p className="text-sm text-outline">No API keys configured.</p>}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg">
              <h2 className="font-headline-md text-on-surface">Billing</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Free design-partner pilot. Gate: billing is enabled at paid pilot launch (target December 15, 2026) — tracked as an explicit milestone, not an indefinite deferral.
              </p>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
