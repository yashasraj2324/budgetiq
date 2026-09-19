"use client";

import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@enter-pro/analytics-sdk";
import { API, apiError, apiFetch } from "@/lib/api";

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
const empty: Form = {
  department_id: "",
  name: "",
  allocated_amount: "",
  priority_weight: "50",
  category: "",
  necessary_future_spend: "0",
  safety_reserve: "0",
  policy_maximum_transfer: "0",
};

const REQUIRED_COLUMNS = ["department_id", "name", "allocated_amount", "priority_weight", "category"];

type CsvRow = Record<string, string>;
type PreviewRow = { row: number; values: CsvRow; error?: string };
type ImportSummary = { created: number; errors: { row: number; error: string }[] };

// Minimal RFC4180-ish CSV parser (quoted fields, embedded commas/newlines).
function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((cell) => cell.trim() !== "")) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj: CsvRow = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] ?? "").trim(); });
    return obj;
  });
}

function validateRow(row: CsvRow, rowNumber: number, departments: Department[], seen: Set<string>): string | undefined {
  const departmentId = Number(row.department_id);
  if (!Number.isInteger(departmentId) || !departments.some((d) => d.id === departmentId)) return `department ${row.department_id || "(empty)"} not found`;
  const name = String(row.name ?? "").trim();
  if (!name) return "name is required";
  const allocated = Number(row.allocated_amount);
  if (!Number.isFinite(allocated) || allocated < 0) return "allocated_amount must be a non-negative number";
  const priority = Number(row.priority_weight);
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) return "priority_weight must be between 0 and 100";
  const category = String(row.category ?? "").trim();
  if (!category) return "category is required";
  const key = `${departmentId}|${name}`;
  if (seen.has(key)) return "duplicate budget line";
  seen.add(key);
  return undefined;
}

function previewRows(rows: CsvRow[], departments: Department[], missingColumns: string[]): PreviewRow[] {
  if (missingColumns.length) return rows.map((values, idx) => ({ row: idx + 2, values, error: "missing required columns" }));
  const seen = new Set<string>();
  return rows.map((values, idx) => {
    const error = validateRow(values, idx + 2, departments, seen);
    return { row: idx + 2, values, error };
  });
}

export default function DataPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`${API}/departments`)
      .then(async (response) => response.ok ? setDepartments(await response.json()) : setError(await apiError(response)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load departments"));
  }, []);

  const change = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function addLine(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
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
      trackEvent("budget_line_added", { eventType: "custom", properties: { source: "manual" } });
      setForm(empty);
      setMessage("Budget line added.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add budget line");
    } finally {
      setSaving(false);
    }
  }

  async function downloadTemplate() {
    setError(""); setMessage("");
    try {
      const response = await apiFetch(`${API}/budget-lines/import/template`);
      if (!response.ok) throw new Error(await apiError(response, "Unable to download template"));
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "budgetiq_budget_lines_template.csv";
      link.click();
      URL.revokeObjectURL(link.href);
      setMessage("Template downloaded. Fill it in and re-upload below.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to download template");
    }
  }

  function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setSummary(null);
    setMessage("");
    setError("");
    if (!selected) { setPreview(null); setMissingColumns([]); return; }
    selected.text().then((text) => {
      const rows = parseCsv(text);
      if (!rows.length) {
        setMissingColumns([]);
        setPreview([]);
        setError("CSV file is empty or has no data rows.");
        return;
      }
      const missing = REQUIRED_COLUMNS.filter((col) => !(col in rows[0]));
      setMissingColumns(missing);
      setPreview(previewRows(rows, departments, missing));
    }).catch(() => setError("Could not read the selected file."));
  }

  async function importCsv() {
    if (!file) { setError("Select a CSV file first."); return; }
    setSaving(true); setError(""); setMessage(""); setSummary(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await apiFetch(`${API}/budget-lines/import`, { method: "POST", body });
      if (!response.ok) {
        const text = await response.text();
        let detail: unknown = null;
        try { detail = JSON.parse(text).detail; } catch { /* not json */ }
        if (detail && typeof detail === "object" && Array.isArray((detail as { errors?: unknown[] }).errors)) {
          setSummary({ created: 0, errors: (detail as { errors: { row: number; error: string }[] }).errors });
        } else {
          throw new Error(typeof detail === "string" ? detail : await apiError(response, "Import failed"));
        }
        return;
      }
      const result = await response.json();
      setSummary({ created: result.created ?? 0, errors: result.errors ?? [] });
      trackEvent("budget_import_completed", { eventType: "conversion", properties: { rows: result.created ?? 0 } });
      setFile(null);
      setPreview(null);
      setMissingColumns([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  const invalidCount = preview?.filter((p) => p.error).length ?? 0;

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-on-surface font-body-md">
      <div className="mx-auto max-w-4xl">
        <p className="font-label-caps text-label-caps uppercase tracking-wider text-primary">Step 2 of 4 · Data setup</p>
        <h1 className="mt-3 font-headline-xl text-headline-xl font-bold">Add your budget data</h1>
        <p className="mt-2 text-on-surface-variant">
          Import a CSV or add budget lines manually. Download the template for the exact column format — row-level issues are flagged before upload.
        </p>

        {/* CSV import */}
        <section className="mt-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-headline-md text-headline-md">Import CSV</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Columns: {REQUIRED_COLUMNS.join(", ")}, then optional necessary_future_spend, safety_reserve, policy_maximum_transfer.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors"
            >
              Download template
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors">
              <input type="file" accept=".csv,text/csv" onChange={onFileSelected} className="hidden" />
              Choose CSV file
            </label>
            {file ? <span className="text-sm font-medium">{file.name}</span> : <span className="text-sm text-outline">No file selected</span>}
            <button
              type="button"
              onClick={importCsv}
              disabled={saving || !file || !!missingColumns.length || invalidCount > 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Uploading…" : "Upload CSV"}
            </button>
          </div>

          {missingColumns.length > 0 && (
            <div className="mt-4 rounded-lg bg-error-container/15 border border-error/20 p-3 text-sm text-error">
              Missing required columns: {missingColumns.join(", ")}. Download the template to see the expected format.
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Preview: {preview.length} row{preview.length === 1 ? "" : "s"} · {invalidCount} issue{invalidCount === 1 ? "" : "s"}
                </p>
                {invalidCount === 0 && <p className="text-sm text-primary font-medium">Ready to upload</p>}
              </div>
              <div className="mt-2 overflow-x-auto rounded-lg border border-outline-variant">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-surface-container-low text-outline">
                      <th className="py-2 px-3 font-label-caps text-label-caps uppercase tracking-wider">Row</th>
                      {REQUIRED_COLUMNS.map((col) => (
                        <th key={col} className="py-2 px-3 font-label-caps text-label-caps uppercase tracking-wider">{col}</th>
                      ))}
                      <th className="py-2 px-3 font-label-caps text-label-caps uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {preview.slice(0, 10).map((p) => (
                      <tr key={p.row} className={p.error ? "bg-error-container/10" : ""}>
                        <td className="py-2 px-3 font-numeric-table">{p.row}</td>
                        {REQUIRED_COLUMNS.map((col) => (
                          <td key={col} className="py-2 px-3 font-numeric-table max-w-[140px] truncate">{p.values[col]}</td>
                        ))}
                        <td className={`py-2 px-3 text-xs font-medium ${p.error ? "text-error" : "text-primary"}`}>
                          {p.error ?? "ok"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 10 && <p className="mt-1 text-xs text-outline">Showing first 10 of {preview.length} rows.</p>}
            </div>
          )}

          {summary && (
            <div className={`mt-4 rounded-lg border p-3 text-sm ${summary.errors.length ? "border-error/20 bg-error-container/15 text-error" : "border-outline-variant bg-surface-container text-on-surface"}`} role="status">
              {summary.errors.length
                ? <>Import rejected. {summary.errors.map((item) => `row ${item.row}: ${item.error}`).join("; ")}</>
                : <>Imported {summary.created} budget line{summary.created === 1 ? "" : "s"}.</>}
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-surface-container p-3 text-sm text-error" role="alert">{error}</p>}
          {message && <p className="mt-4 rounded-lg bg-surface-container p-3 text-sm text-on-surface" role="status">{message}</p>}
        </section>

        {/* Manual add */}
        <section className="mt-6 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="font-headline-md text-headline-md">Add budget line</h2>
          {departments.length === 0 && <p className="mt-3 text-sm text-secondary">Create a department during workspace setup before adding lines.</p>}
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
                  <select required value={form[key]} onChange={(event) => change(key, event.target.value)} className="mt-1 w-full rounded border border-outline-variant bg-surface-container px-3 py-2 text-on-surface">
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
                    className="mt-1 w-full rounded border border-outline-variant bg-surface-container px-3 py-2 text-on-surface"
                  />
                )}
              </label>
            ))}
            <button type="submit" disabled={saving || !departments.length} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary disabled:opacity-50 sm:col-span-2">
              {saving ? "Saving…" : "Add budget line"}
            </button>
          </form>
        </section>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => {
              trackEvent("onboarding_step_completed", { eventType: "conversion", properties: { step: "data" } });
              navigate("/onboarding/priorities");
            }}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary"
          >
            Continue to priorities →
          </button>
        </div>
      </div>
    </main>
  );
}
