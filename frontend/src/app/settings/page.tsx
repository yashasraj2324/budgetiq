"use client";
import { Shell } from "@/components/Shell";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { API, apiFetch } from "@/lib/api";
import Link from "next/link";

const formatINR = (val: number) =>
  "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 0 });

interface BudgetLine {
  id: number;
  name: string;
  department_id: number;
  allocated_amount: number;
  remaining_budget: number;
  priority_weight: number;
  policy_maximum_transfer: number;
  necessary_future_spend: number;
  safety_reserve: number;
}

interface Department {
  id: number;
  name: string;
  priority_weight: number;
}

interface WorkspaceConfig {
  org_name?: string;
  fiscal_year?: string;
  currency?: string;
}

interface ProviderStatus {
  name: string;
  configured: boolean;
  message?: string;
}

function ConfigRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between py-space-sm border-b border-outline-variant last:border-0">
      <div>
        <div className="font-body-md text-on-surface font-medium">{label}</div>
        {note && <div className="font-body-sm text-on-surface-variant mt-0.5">{note}</div>}
      </div>
      <div className="font-code-sm text-on-surface bg-surface-container px-space-md py-1 rounded font-semibold">
        {value}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<WorkspaceConfig>({});
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loadError, setLoadError] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch(`${API}/budget-lines`).then(r => r.json()),
      apiFetch(`${API}/departments`).then(r => r.json()),
      apiFetch(`${API}/onboarding/config`).then(r => r.ok ? r.json() : {}),
      apiFetch(`${API}/providers/status`).then(r => r.ok ? r.json() : { providers: [] }),
    ]).then(([lData, dData, cData, pData]) => {
      setLines(lData);
      setDepts(dData);
      setConfig(cData ?? {});
      setProviders(pData?.providers ?? []);
      setLoading(false);
    }).catch((error: Error) => {
      setLoadError(error.message);
      setLoading(false);
    });
  }, []);

  const saveConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingConfig(true);
    setLoadError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiFetch(`${API}/organization/config`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_name: form.get("org_name"), fiscal_year: form.get("fiscal_year"), currency: form.get("currency") }),
      });
      if (!response.ok) throw new Error((await response.json()).detail ?? "Unable to save settings");
      setConfig(await response.json());
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Unable to save settings"); }
    finally { setSavingConfig(false); }
  };

  const deptName = (id: number) => depts.find(d => d.id === id)?.name ?? "—";

  return (
    <Shell activePath="settings">
      <div className="flex flex-col w-full gap-space-xl max-w-4xl mx-auto">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Workspace Settings</h1>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Organisation configuration and policy limits — read from the active data source.
          </p>
        </div>
        {loadError && <p role="alert" className="text-error">{loadError}</p>}
        <Link href="/billing" className="self-start rounded bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary">Manage billing</Link>

        {/* Org Config */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-outline text-[20px]">business</span>
            Organisation Config
          </h2>
          <form onSubmit={saveConfig} className="space-y-3 mb-4">
            <label className="block text-sm text-on-surface">Organisation<input name="org_name" defaultValue={config.org_name ?? ""} required className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface" /></label>
            <label className="block text-sm text-on-surface">Fiscal year<input name="fiscal_year" defaultValue={config.fiscal_year ?? ""} required className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface" /></label>
            <label className="block text-sm text-on-surface">Currency<input name="currency" maxLength={3} defaultValue={config.currency ?? "INR"} required className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface uppercase" /></label>
            <button disabled={savingConfig} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">{savingConfig ? "Saving…" : "Save changes"}</button>
          </form>
          <ConfigRow label="Active Period" value="Q2 · Apr 01 – Jun 30" />
          <ConfigRow label="Database Engine" value="MongoDB" note="Active runtime storage for this deployment" />
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-outline text-[20px]">hub</span>
            Provider status
          </h2>
          {providers.length === 0 ? <p className="text-sm text-outline">No provider status is configured.</p> : providers.map((provider) => (
            <ConfigRow key={provider.name} label={provider.name} value={provider.configured ? "Configured" : "Not configured"} note={provider.message} />
          ))}
        </div>

        {/* Departments */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-outline text-[20px]">apartment</span>
            Departments &amp; Priority Weights
          </h2>
          {loading ? (
            <div className="text-outline font-body-sm py-4 text-center">Loading…</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-outline border-b border-outline-variant">
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider">Department</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider text-right">Priority Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {depts.map(d => (
                  <tr key={d.id}>
                    <td className="py-2.5 font-body-md text-on-surface font-medium">{d.name}</td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex items-center gap-space-sm">
                        <div className="w-24 h-1.5 bg-surface-container-high rounded overflow-hidden">
                          <div className="h-full bg-primary rounded" style={{ width: d.priority_weight + "%" }} />
                        </div>
                        <span className="font-numeric-table text-on-surface font-semibold">{d.priority_weight}/100</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Policy limits per line */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-outline text-[20px]">policy</span>
            Transfer Policy Limits (per Budget Line)
          </h2>
          <p className="font-body-sm text-on-surface-variant mb-space-md">
            <code className="font-code-sm bg-surface-container px-1 py-0.5 rounded">policy_maximum_transfer</code> — the hard ceiling on any single reallocation from that line, enforced by the guardrail engine.
          </p>
          {loading ? (
            <div className="text-outline font-body-sm py-4 text-center">Loading…</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-outline border-b border-outline-variant">
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider">Department</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider">Line Item</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider text-right">Policy Max</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider text-right">Safety Reserve</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider text-right">Necessary Future</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {lines.map(l => (
                  <tr key={l.id} className="hover:bg-surface-container transition-colors duration-100 group">
                    <td className="py-2.5 font-body-sm text-on-surface-variant">{deptName(l.department_id)}</td>
                    <td className="py-2.5 font-body-md text-on-surface font-medium">{l.name}</td>
                    <td className="py-2.5 text-right font-numeric-table font-semibold group-hover:bg-surface-container-high transition-colors cursor-pointer rounded"
                        onClick={async () => {
                          const val = prompt(`Set new Policy Max Transfer for ${l.name}:`, l.policy_maximum_transfer.toString());
                          if (val !== null && !isNaN(Number(val))) {
                            await apiFetch(`${API}/budget-lines/${l.id}/policy`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policy_maximum_transfer: Number(val) }) });
                            setLines(prev => prev.map(x => x.id === l.id ? { ...x, policy_maximum_transfer: Number(val) } : x));
                          }
                        }}>
                      {formatINR(l.policy_maximum_transfer)}
                      <span className="material-symbols-outlined text-[14px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                    </td>
                    <td className="py-2.5 text-right font-numeric-table font-semibold text-outline group-hover:bg-surface-container-high transition-colors cursor-pointer rounded"
                        onClick={async () => {
                          const val = prompt(`Set new Safety Reserve for ${l.name}:`, l.safety_reserve.toString());
                          if (val !== null && !isNaN(Number(val))) {
                            await apiFetch(`${API}/budget-lines/${l.id}/policy`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ safety_reserve: Number(val) }) });
                            setLines(prev => prev.map(x => x.id === l.id ? { ...x, safety_reserve: Number(val) } : x));
                          }
                        }}>
                      {formatINR(l.safety_reserve)}
                      <span className="material-symbols-outlined text-[14px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                    </td>
                    <td className="py-2.5 text-right font-numeric-table font-semibold text-outline group-hover:bg-surface-container-high transition-colors cursor-pointer rounded"
                        onClick={async () => {
                          const val = prompt(`Set new Necessary Future Spend for ${l.name}:`, l.necessary_future_spend.toString());
                          if (val !== null && !isNaN(Number(val))) {
                            await apiFetch(`${API}/budget-lines/${l.id}/policy`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ necessary_future_spend: Number(val) }) });
                            setLines(prev => prev.map(x => x.id === l.id ? { ...x, necessary_future_spend: Number(val) } : x));
                          }
                        }}>
                      {formatINR(l.necessary_future_spend)}
                      <span className="material-symbols-outlined text-[14px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
