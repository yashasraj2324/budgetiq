import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, apiError, apiFetch } from "../lib/api";

type Department = { id: number; name: string };
type Form = {
  department_id: string;
  name: string;
  allocated_amount: string;
  priority_weight: string;
  category: string;
  necessary_future_spend: string;
  safety_reserve: string;
  policy_maximum_transfer: string;
};
const empty: Form = { department_id: "", name: "", allocated_amount: "", priority_weight: "50", category: "", necessary_future_spend: "0", safety_reserve: "0", policy_maximum_transfer: "0" };

export default function DataPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`${API}/departments`)
      .then(async (response) => (response.ok ? setDepartments(await response.json()) : setMessage(await apiError(response))))
      .catch((error) => setMessage(error.message));
  }, []);

  const change = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function addLine(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch(`${API}/budget-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          department_id: Number(form.department_id),
          allocated_amount: Number(form.allocated_amount),
          priority_weight: Number(form.priority_weight),
          necessary_future_spend: Number(form.necessary_future_spend),
          safety_reserve: Number(form.safety_reserve),
          policy_maximum_transfer: Number(form.policy_maximum_transfer),
        }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      setForm(empty);
      setMessage("Budget line added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add budget line");
    } finally {
      setSaving(false);
    }
  }

  async function importCsv() {
    if (!file) return;
    setSaving(true);
    setMessage("");
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await apiFetch(`${API}/budget-lines/import`, { method: "POST", body });
      if (!response.ok) throw new Error(await apiError(response));
      const result = await response.json();
      setMessage(`Imported ${result.created} budget line${result.created === 1 ? "" : "s"}.`);
      if (result.errors?.length) {
        setMessage(`Import rejected: ${result.errors.map((item: { row: number; error: string }) => `row ${item.row}: ${item.error}`).join("; ")}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-mono uppercase tracking-wider text-blue-700">Step 2 of 4 · Data setup</p>
        <h1 className="mt-3 text-3xl font-bold">Add your budget data</h1>
        <p className="mt-2 text-slate-600">
          Import a CSV or add budget lines manually. CSV columns: department_id, name, allocated_amount, priority_weight, category, necessary_future_spend, safety_reserve, policy_maximum_transfer.
        </p>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Import CSV</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="text-sm" />
            <button type="button" onClick={importCsv} disabled={!file || saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Upload CSV
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Add budget line</h2>
          {departments.length === 0 && <p className="mt-3 text-sm text-amber-700">Create a department during workspace setup before adding lines.</p>}
          <form onSubmit={addLine} className="mt-5 grid gap-4 sm:grid-cols-2">
            {([
              ["department_id", "Department", "select"],
              ["name", "Line name", "text"],
              ["allocated_amount", "Allocated amount", "number"],
              ["priority_weight", "Priority weight", "number"],
              ["category", "Category", "text"],
              ["necessary_future_spend", "Necessary future spend", "number"],
              ["safety_reserve", "Safety reserve", "number"],
              ["policy_maximum_transfer", "Maximum transfer", "number"],
            ] as const).map(([key, label, type]) => (
              <label key={key} className="text-sm font-medium">
                {label}
                {type === "select" ? (
                  <select required value={form[key]} onChange={(event) => change(key, event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2">
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required={["name", "allocated_amount", "category"].includes(key)}
                    min={type === "number" ? "0" : undefined}
                    max={key === "priority_weight" ? "100" : undefined}
                    step={type === "number" ? "0.01" : undefined}
                    type={type}
                    value={form[key]}
                    onChange={(event) => change(key, event.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  />
                )}
              </label>
            ))}
            <button type="submit" disabled={saving || !departments.length} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">
              {saving ? "Saving…" : "Add budget line"}
            </button>
          </form>
        </section>

        {message && <p className="mt-5 rounded-lg bg-white p-3 text-sm text-slate-700" role="status">{message}</p>}
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={() => navigate("/onboarding/priorities")} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white">
            Continue to priorities →
          </button>
        </div>
      </div>
    </main>
  );
}
