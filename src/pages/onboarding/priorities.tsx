"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API, apiError, apiFetch } from "@/lib/api";
import { trackEvent } from '@enter-pro/analytics-sdk';

type Line = { id: number; name: string; priority_weight: number; category: string };

export default function PrioritiesPage() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch(`${API}/budget-lines`).then(async (response) => {
      if (response.ok) setLines(await response.json());
      else setMessage(await apiError(response, "Could not load budget lines"));
    }).catch((error) => setMessage(error.message));
  }, []);

  const setWeight = (id: number, value: number) =>
    setLines((current) => current.map((line) => line.id === id ? { ...line, priority_weight: value } : line));

  async function save(continueNext = false) {
    setSaving(true); setMessage("");
    try {
      const response = await apiFetch(`${API}/onboarding/priorities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_priorities: lines.map(({ name, priority_weight }) => ({ name, priority_weight })) }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      setMessage("Priorities saved.");
      if (continueNext) { trackEvent('onboarding_step_completed', { eventType: 'conversion', properties: { step: 'priorities' } }); navigate("/onboarding/policies"); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function reset() {
    const defaults = lines.map((line) => ({ name: line.name, priority_weight: 50 }));
    setLines((current) => current.map((line) => ({ ...line, priority_weight: 50 })));
    setSaving(true); setMessage("");
    try {
      const response = await apiFetch(`${API}/onboarding/priorities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_priorities: defaults }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      setMessage("Priorities reset to 50.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reset failed"); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-on-surface font-body-md">
      <div className="mx-auto max-w-3xl">
        <Link to="/onboarding/data" className="inline-flex items-center gap-1 text-outline hover:text-on-surface font-body-sm mb-2">&larr; Back to data</Link>
        <p className="font-label-caps text-label-caps uppercase tracking-wider text-primary">Step 3 of 4 · Engine calibration</p>
        <h1 className="mt-3 font-headline-xl text-headline-xl font-bold">Define your priorities</h1>
        <p className="mt-2 text-on-surface-variant">Set the relative importance of each budget line. These weights are persisted for your organization.</p>
        <section className="mt-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          {lines.length === 0 ? <p className="text-sm text-on-surface-variant">No budget lines yet. Add data first.</p> :
            <div className="space-y-6">{lines.map((line) => <div key={line.id}>
              <div className="flex justify-between text-sm">
                <label className="font-semibold">{line.name}<span className="ml-2 text-xs font-normal text-outline">{line.category}</span></label>
                <span className="font-numeric-metric-md font-semibold text-primary">{line.priority_weight}</span>
              </div>
              <input aria-label={`${line.name} priority`} className="mt-2 w-full accent-primary" type="range" min="0" max="100" value={line.priority_weight} onChange={(event) => setWeight(line.id, Number(event.target.value))} />
            </div>)}</div>}
          {message && <p className="mt-5 text-sm text-on-surface-variant" role="status">{message}</p>}
          <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-outline-variant pt-5">
            <button type="button" onClick={reset} disabled={saving || !lines.length} className="text-sm font-medium text-on-surface-variant underline disabled:opacity-40">Reset to defaults</button>
            <div className="flex gap-3">
              <button type="button" onClick={() => save()} disabled={saving} className="rounded-lg border border-outline-variant bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50">Save</button>
              <button type="button" onClick={() => save(true)} disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Continue to policies"}</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
