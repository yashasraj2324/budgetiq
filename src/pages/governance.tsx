"use client";

import { Shell } from "@/components/Shell";
import { API, apiError, apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

interface Tier {
  level: number;
  min_amount: number;
  approver_roles: string[];
}

interface ApprovalPolicy {
  tiers: Tier[];
  escalation_hours: number;
  delegated_approvers: string[];
  dual_sign: boolean;
  updated_at?: string;
}

const ROLE_OPTIONS = [
  "admin",
  "CFO",
  "VP Finance",
  "Finance Manager",
  "Budget Analyst",
  "Controller",
  "finance_user",
];

export default function GovernancePage() {
  const [policy, setPolicy] = useState<ApprovalPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        const response = await apiFetch(`${API}/governance/approval-policy`);
        if (!response.ok) {
          throw new Error(await apiError(response, "Unable to load approval policy"));
        }
        const data = (await response.json()) as ApprovalPolicy;
        setPolicy({
          ...data,
          tiers: [...data.tiers].sort((a, b) => a.level - b.level),
          delegated_approvers: data.delegated_approvers ?? [],
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load approval policy");
      }
    };
    void load();
  }, []);

  const delegatedInput = useMemo(
    () => (policy?.delegated_approvers ?? []).join(", "),
    [policy?.delegated_approvers],
  );

  const setTier = (index: number, update: Partial<Tier>) => {
    setPolicy((previous) => {
      if (!previous) return previous;
      const tiers = [...previous.tiers];
      tiers[index] = { ...tiers[index], ...update };
      return { ...previous, tiers };
    });
  };

  const toggleRole = (index: number, role: string) => {
    setPolicy((previous) => {
      if (!previous) return previous;
      const tiers = [...previous.tiers];
      const selected = new Set(tiers[index].approver_roles);
      if (selected.has(role)) {
        selected.delete(role);
      } else {
        selected.add(role);
      }
      tiers[index] = { ...tiers[index], approver_roles: Array.from(selected) };
      return { ...previous, tiers };
    });
  };

  const addTier = () => {
    setPolicy((previous) => {
      if (!previous) return previous;
      const maxLevel = previous.tiers.reduce((max, tier) => Math.max(max, tier.level), 0);
      return {
        ...previous,
        tiers: [
          ...previous.tiers,
          {
            level: maxLevel + 1,
            min_amount: 0,
            approver_roles: ["CFO"],
          },
        ],
      };
    });
  };

  const removeTier = (index: number) => {
    setPolicy((previous) => {
      if (!previous || previous.tiers.length <= 1) return previous;
      const tiers = previous.tiers.filter((_, tierIndex) => tierIndex !== index);
      return {
        ...previous,
        tiers: tiers.map((tier, idx) => ({ ...tier, level: idx + 1 })),
      };
    });
  };

  const savePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!policy) return;

    setSaving(true);
    setMessage("");
    setError("");

    const normalizedTiers = policy.tiers
      .map((tier, index) => ({
        level: index + 1,
        min_amount: Number(tier.min_amount),
        approver_roles: Array.from(new Set(tier.approver_roles)).filter(Boolean),
      }))
      .sort((a, b) => a.level - b.level);

    const hasInvalidTier = normalizedTiers.some(
      (tier) => !Number.isFinite(tier.min_amount) || tier.min_amount < 0 || tier.approver_roles.length === 0,
    );

    if (hasInvalidTier) {
      setSaving(false);
      setError("Each tier needs a non-negative threshold and at least one approver role.");
      return;
    }

    try {
      const response = await apiFetch(`${API}/governance/approval-policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiers: normalizedTiers,
          escalation_hours: policy.escalation_hours,
          delegated_approvers: policy.delegated_approvers,
          dual_sign: policy.dual_sign,
        }),
      });
      if (!response.ok) {
        throw new Error(await apiError(response, "Unable to save approval policy"));
      }
      const saved = (await response.json()) as ApprovalPolicy;
      setPolicy({ ...saved, tiers: [...saved.tiers].sort((a, b) => a.level - b.level) });
      setMessage("Approval policy saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save approval policy");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Shell activePath="governance">
      <div className="flex flex-col w-full gap-space-xl max-w-5xl mx-auto">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Approval Governance</h1>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Configure tier thresholds, required approver roles, dual-sign, delegation, and escalation.
          </p>
        </div>

        {error && <p role="alert" className="text-error">{error}</p>}
        {message && <p role="status" className="text-primary-container">{message}</p>}

        {!policy ? (
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg text-outline">
            Loading governance settings...
          </div>
        ) : (
          <form onSubmit={savePolicy} className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg space-y-space-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-headline-md text-on-surface">Approval tiers</h2>
              <button type="button" onClick={addTier} className="rounded border border-outline-variant px-3 py-1.5 text-sm hover:bg-surface-container-low">
                Add tier
              </button>
            </div>

            <div className="space-y-space-md">
              {policy.tiers.map((tier, index) => (
                <div key={index} className="rounded border border-outline-variant p-space-md space-y-space-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-on-surface">Tier {index + 1}</h3>
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      disabled={policy.tiers.length <= 1}
                      className="text-sm text-error disabled:text-outline"
                    >
                      Remove
                    </button>
                  </div>
                  <label className="block text-sm text-on-surface">
                    Minimum transfer amount (INR)
                    <input
                      type="number"
                      min={0}
                      value={tier.min_amount}
                      onChange={(event) => setTier(index, { min_amount: Number(event.target.value || 0) })}
                      className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface"
                    />
                  </label>
                  <div className="space-y-2">
                    <p className="text-sm text-on-surface">Approver roles</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {ROLE_OPTIONS.map((role) => (
                        <label key={role} className="flex items-center gap-2 text-sm text-on-surface">
                          <input
                            type="checkbox"
                            checked={tier.approver_roles.includes(role)}
                            onChange={() => toggleRole(index, role)}
                          />
                          <span>{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <label className="block text-sm text-on-surface">
                Escalation window (hours)
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={policy.escalation_hours}
                  onChange={(event) =>
                    setPolicy((previous) => previous ? { ...previous, escalation_hours: Number(event.target.value || 1) } : previous)
                  }
                  className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-on-surface mt-7">
                <input
                  type="checkbox"
                  checked={policy.dual_sign}
                  onChange={(event) =>
                    setPolicy((previous) => previous ? { ...previous, dual_sign: event.target.checked } : previous)
                  }
                />
                Require dual-sign final approval
              </label>
            </div>

            <label className="block text-sm text-on-surface">
              Delegated approvers (user IDs, comma-separated)
              <input
                type="text"
                value={delegatedInput}
                onChange={(event) => {
                  const delegated = event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean);
                  setPolicy((previous) => previous ? { ...previous, delegated_approvers: delegated } : previous);
                }}
                className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface"
                placeholder="u_123, u_456"
              />
            </label>

            <div className="flex items-center justify-between">
              <p className="text-xs text-outline">
                Changes persist immediately after save and are applied to subsequent approval decisions.
              </p>
              <button type="submit" disabled={saving} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">
                {saving ? "Saving..." : "Save policy"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Shell>
  );
}


