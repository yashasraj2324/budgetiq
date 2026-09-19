"use client";

import { useState } from "react";
import { Link } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { API, apiError, apiFetch } from "@/lib/api";
import { toast } from "@/lib/toast";

interface Result {
  ok?: boolean;
  created?: number;
  updated?: number;
  errors?: { row: number; error: string }[];
}

function extractErrors(body: unknown, fallback: string): { errors: { row: number; error: string }[]; message: string } {
  const errors: { row: number; error: string }[] = [];
  let message = fallback;
  if (body && typeof body === "object") {
    const record = body as { detail?: unknown; error?: unknown };
    const detail = record.detail;
    if (typeof detail === "string") {
      try {
        const parsed = JSON.parse(detail) as { errors?: { row: number; error: string }[] };
        if (Array.isArray(parsed.errors)) {
          errors.push(...parsed.errors);
          message = `Rejected ${parsed.errors.length} row(s).`;
        } else {
          message = detail;
        }
      } catch {
        message = detail;
      }
    } else if (typeof record.error === "string") {
      message = record.error;
    }
  }
  return { errors, message };
}

function ErrorsList({ result }: { result: Result | null }) {
  if (!result?.errors?.length) return null;
  return (
    <div role="alert" className="mt-3 text-sm text-error space-y-0.5">
      {result.errors.slice(0, 20).map((e, i) => (
        <p key={i}>Row {e.row}: {e.error}</p>
      ))}
      {result.errors.length > 20 && <p>… and {result.errors.length - 20} more</p>}
    </div>
  );
}

export default function ImportPage() {
  const [lineFile, setLineFile] = useState<File | null>(null);
  const [spendFile, setSpendFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"lines" | "spend" | null>(null);
  const [lineResult, setLineResult] = useState<Result | null>(null);
  const [spendResult, setSpendResult] = useState<Result | null>(null);
  const [lineMessage, setLineMessage] = useState("");
  const [spendMessage, setSpendMessage] = useState("");

  const upload = async (kind: "lines" | "spend", file: File | null) => {
    const setMsg = kind === "lines" ? setLineMessage : setSpendMessage;
    const setRes = kind === "lines" ? setLineResult : setSpendResult;
    const setFile = kind === "lines" ? setLineFile : setSpendFile;
    if (!file) {
      setMsg("Select a CSV file first.");
      return;
    }
    setBusy(kind);
    setMsg("");
    setRes(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await apiFetch(`${API}/${kind === "lines" ? "budget-lines" : "spend"}/import`, {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => null)) as Result | null;
      if (response.ok) {
        setRes({ ok: true, created: body?.created ?? 0, updated: body?.updated ?? 0, errors: body?.errors ?? [] });
        const successMessage = kind === "lines"
          ? `Imported ${body?.created ?? 0} budget line(s).`
          : `Imported ${body?.created ?? 0} spend entry(ies), updated ${body?.updated ?? 0}.`;
        setMsg(successMessage);
        toast(successMessage, "success");
        setFile(null);
      } else {
        const { errors, message } = extractErrors(body, await apiError(response, "Import failed."));
        setRes({ errors });
        setMsg(message);
        toast(message, "error");
      }
    } catch {
      setMsg("Network error during upload.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell activePath="import">
      <div className="flex flex-col w-full gap-space-xl max-w-5xl mx-auto">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Import Budget Data</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Refresh your numbers at any time — this is the monthly ingestion surface for ongoing monitoring.
          Data appears on the dashboard immediately after a successful import.
        </p>
        </div>

        {/* Budget lines CSV */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg space-y-space-md">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Budget lines</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Add new or replacement budget lines. Existing lines are kept; duplicates in the file are rejected.
            </p>
          </div>
          <p className="text-xs font-mono text-outline">
            Columns: department_name (auto-created if new) or department_id, name, allocated_amount, priority_weight,
            category, necessary_future_spend, safety_reserve, policy_maximum_transfer
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-[18px] text-outline">upload_file</span>
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  setLineFile(event.target.files?.[0] ?? null);
                  setLineMessage("");
                  setLineResult(null);
                }}
              />
            </label>
            {lineFile ? (
              <span className="text-sm font-medium text-on-surface">{lineFile.name}</span>
            ) : (
              <span className="text-sm text-outline">No file selected</span>
            )}
            <button
              onClick={() => void upload("lines", lineFile)}
              disabled={busy !== null}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              {busy === "lines" ? "Uploading…" : "Upload budget lines"}
            </button>
            <Link to="/settings" className="text-sm text-primary hover:underline">
              or add lines manually in settings
            </Link>
          </div>
          {lineMessage && (
            <p className="text-sm text-primary-container font-medium flex items-center gap-2" role="status">
              {lineMessage}
              {lineResult?.ok && (
                <Link to="/dashboard" className="text-primary underline font-semibold">View on dashboard →</Link>
              )}
            </p>
          )}
          <ErrorsList result={lineResult} />
        </section>

        {/* Spend entries CSV */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg space-y-space-md">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Spend entries</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Record actual spend per budget line per period. Re-importing a period replaces its value — this is the
              monthly budget refresh.
            </p>
          </div>
          <p className="text-xs font-mono text-outline">
            Columns: budget_line_id, period, amount_spent — or budget_line_name (with optional department_name to
            disambiguate), period, amount_spent. Re-importing a period replaces its value.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-[18px] text-outline">upload_file</span>
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  setSpendFile(event.target.files?.[0] ?? null);
                  setSpendMessage("");
                  setSpendResult(null);
                }}
              />
            </label>
            {spendFile ? (
              <span className="text-sm font-medium text-on-surface">{spendFile.name}</span>
            ) : (
              <span className="text-sm text-outline">No file selected</span>
            )}
            <button
              onClick={() => void upload("spend", spendFile)}
              disabled={busy !== null}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
            >
              {busy === "spend" ? "Uploading…" : "Upload spend entries"}
            </button>
            <Link to="/dashboard" className="text-sm text-primary hover:underline">
              or record a single entry on a budget line
            </Link>
          </div>
          {spendMessage && (
            <p className="text-sm text-primary-container font-medium flex items-center gap-2" role="status">
              {spendMessage}
              {spendResult?.ok && (
                <Link to="/dashboard" className="text-primary underline font-semibold">View on dashboard →</Link>
              )}
            </p>
          )}
          <ErrorsList result={spendResult} />
        </section>

        <p className="text-sm text-on-surface-variant">
          Imports only change your own workspace. Dashboard totals, signals, and forecasts update immediately after a
          successful upload.
        </p>
      </div>
    </Shell>
  );
}
