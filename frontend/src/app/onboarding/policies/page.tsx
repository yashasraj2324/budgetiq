"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API, apiError, apiFetch } from "@/lib/api";

type Line = { id: number; name: string; safety_reserve: number; necessary_future_spend: number; policy_maximum_transfer: number };
type Field = "safety_reserve" | "necessary_future_spend" | "policy_maximum_transfer";

export default function PoliciesPage() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    apiFetch(`${API}/budget-lines`).then(async (response) => response.ok ? setLines(await response.json()) : setMessage(await apiError(response))).catch((error) => setMessage(error.message));
  }, []);
  const update = (id: number, field: Field, value: number) => setLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));
  async function persist(reset = false) {
    setSaving(true); setMessage("");
    const values = lines.map((line) => ({ name: line.name, safety_reserve: reset ? 0 : Number(line.safety_reserve) || 0, necessary_future_spend: reset ? 0 : Number(line.necessary_future_spend) || 0, policy_maximum_transfer: reset ? 0 : Number(line.policy_maximum_transfer) || 0 }));
    if (reset) setLines((current) => current.map((line) => ({ ...line, safety_reserve: 0, necessary_future_spend: 0, policy_maximum_transfer: 0 })));
    try {
      const response = await apiFetch(`${API}/onboarding/policies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ line_policies: values }) });
      if (!response.ok) throw new Error(await apiError(response));
      setMessage(reset ? "Policies reset to zero." : "Policies saved.");
      if (!reset) router.push("/dashboard");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed"); }
    finally { setSaving(false); }
  }
  const fields: [Field, string][] = [["necessary_future_spend", "Necessary future spend"], ["safety_reserve", "Safety reserve"], ["policy_maximum_transfer", "Maximum transfer"]];
  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900"><div className="mx-auto max-w-4xl"><p className="text-xs font-mono uppercase tracking-wider text-blue-700">Step 4 of 4 · Financial policies</p><h1 className="mt-3 text-3xl font-bold">Configure financial policies</h1><p className="mt-2 text-slate-600">Protect reserves and cap transfers for every budget line.</p><section className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500"><th className="pb-3">Budget line</th>{fields.map(([, label]) => <th key={label} className="pb-3">{label}</th>)}</tr></thead><tbody>{lines.map((line) => <tr key={line.id} className="border-b last:border-0"><td className="py-4 pr-4 font-semibold">{line.name}</td>{fields.map(([field, label]) => <td key={field} className="py-4 pr-4"><label className="sr-only">{`${line.name} ${label}`}</label><input type="number" min="0" step="0.01" value={line[field]} onChange={(event) => update(line.id, field, Number(event.target.value))} className="w-full rounded border border-slate-300 px-3 py-2" /></td>)}</tr>)}</tbody></table>{!lines.length && <p className="py-5 text-sm text-slate-500">No budget lines yet. Add data first.</p>}{message && <p className="mt-5 text-sm text-slate-600" role="status">{message}</p>}<div className="mt-8 flex justify-between border-t border-slate-100 pt-5"><button type="button" onClick={() => persist(true)} disabled={saving || !lines.length} className="text-sm font-medium text-slate-600 underline disabled:opacity-40">Reset policies</button><div className="flex gap-3"><button type="button" onClick={() => persist()} disabled={saving || !lines.length} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Save</button><button type="button" onClick={() => persist()} disabled={saving || !lines.length} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Complete setup"}</button></div></div></section></div></main>;
}
