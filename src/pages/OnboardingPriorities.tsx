import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, apiError, apiFetch } from "../lib/api";

type Line = { id: number; name: string; priority_weight: number; category: string };

export default function PrioritiesPage() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch(`${API}/budget-lines`)
      .then(async (response) => {
        if (response.ok) setLines(await response.json());
        else setMessage(await apiError(response, "Could not load budget lines"));
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const setWeight = (id: number, value: number) =>
    setLines((current) => current.map((line) => line.id === id ? { ...line, priority_weight: value } : line));

  async function save(continueNext = false) {
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch(`${API}/onboarding/priorities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_priorities: lines.map(({ name, priority_weight }) => ({ name, priority_weight })) }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      setMessage("Priorities saved.");
      if (continueNext) navigate("/onboarding/policies");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    const defaults = lines.map((line) => ({ name: line.name, priority_weight: 50 }));
    setLines((current) => current.map((line) => ({ ...line, priority_weight: 50 })));
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch(`${API}/onboarding/priorities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_priorities: defaults }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      setMessage("Priorities reset to 50.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-mono uppercase tracking-wider text-blue-700">Step 3 of 4 · Engine calibration</p>
        <h1 className="mt-3 text-3xl font-bold">Define your priorities</h1>
        <p className="mt-2 text-slate-600">Set the relative importance of each budget line. These weights are persisted for your organization.</p>
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {lines.length === 0 ? (
            <p className="text-sm text-slate-500">No budget lines yet. Add data first.</p>
          ) : (
            <div className="space-y-6">
              {lines.map((line) => (
                <div key={line.id}>
                  <div className="flex justify-between text-sm">
                    <label className="font-semibold">
                      {line.name}
                      <span className="ml-2 text-xs font-normal text-slate-400">{line.category}</span>
                    </label>
                    <span className="font-mono text-blue-700">{line.priority_weight}</span>
                  </div>
                  <input
                    aria-label={`${line.name} priority`}
                    className="mt-2 w-full accent-blue-600"
                    type="range"
                    min="0"
                    max="100"
                    value={line.priority_weight}
                    onChange={(event) => setWeight(line.id, Number(event.target.value))}
                  />
                </div>
              ))}
            </div>
          )}
          {message && <p className="mt-5 text-sm text-slate-600" role="status">{message}</p>}
          <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={reset} disabled={saving || !lines.length} className="text-sm font-medium text-slate-600 underline disabled:opacity-40">
              Reset to defaults
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => save()} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Save
              </button>
              <button type="button" onClick={() => save(true)} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Saving…" : "Continue to policies"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
