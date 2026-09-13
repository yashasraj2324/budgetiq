"use client";
import { Shell } from "@/components/Shell";
import { useState, useEffect } from "react";

const API = "http://localhost:8000/api";

const formatINR = (val: number) =>
  "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 0 });

interface AuditEvent {
  id: number;
  recommendation_id: number;
  action: string;
  actor: string;
  event_metadata: Record<string, number | string>;
  timestamp: string;
}

const actionStyle: Record<string, string> = {
  approve: "bg-primary-container/20 text-primary",
  modify:  "bg-secondary-fixed text-secondary",
  reject:  "bg-error-container/20 text-error",
};

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? "";
        const s = String(v);
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${API}/audit`)
      .then(r => r.json())
      .then(d => { setEvents(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = events.filter(e => {
    if (filter !== "all" && e.action !== filter) return false;
    if (search && !String(e.recommendation_id).includes(search) && !e.actor.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleExport = () => {
    const rows = filtered.map(e => ({
      id: e.id,
      recommendation_id: e.recommendation_id,
      action: e.action,
      actor: e.actor,
      timestamp: new Date(e.timestamp).toLocaleString("en-IN"),
      ...e.event_metadata,
    }));
    downloadCSV(rows, "budgetiq_audit_log.csv");
  };

  return (
    <Shell activePath="audit">
      <div className="flex flex-col w-full gap-space-xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-space-sm mb-space-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
              <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">FR-018 · Immutable Event Log</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Audit Log</h1>
            <p className="font-body-sm text-on-surface-variant mt-1">
              Full chronological record of every approve, modify, and reject action — {events.length} total events.
            </p>
          </div>
          <button
            id="btn-export-audit-log-csv"
            onClick={handleExport}
            className="flex items-center gap-space-xs px-space-md py-2 bg-surface-container-lowest text-on-surface font-body-sm font-medium rounded shadow-sm hover:bg-surface-container-low transition-colors border border-outline-variant"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-space-sm">
          <input
            type="text"
            placeholder="Search actor or rec ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded border border-outline-variant bg-surface-container-lowest px-space-md py-1.5 font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary w-56"
          />
          {["all", "approve", "modify", "reject"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-space-md py-1.5 rounded font-code-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <span className="font-code-sm text-outline ml-auto">{filtered.length} events</span>
        </div>

        {/* Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-outline font-body-md">Loading audit events…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-outline font-body-md">No audit events match the current filter.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th className="py-space-md px-space-lg font-label-caps text-label-caps uppercase text-outline tracking-wider">Event ID</th>
                  <th className="py-space-md px-space-md font-label-caps text-label-caps uppercase text-outline tracking-wider">Rec #</th>
                  <th className="py-space-md px-space-md font-label-caps text-label-caps uppercase text-outline tracking-wider">Action</th>
                  <th className="py-space-md px-space-md font-label-caps text-label-caps uppercase text-outline tracking-wider">Actor</th>
                  <th className="py-space-md px-space-md font-label-caps text-label-caps uppercase text-outline tracking-wider text-right">Amount</th>
                  <th className="py-space-md px-space-md font-label-caps text-label-caps uppercase text-outline tracking-wider text-right">Source Before→After</th>
                  <th className="py-space-md px-space-lg font-label-caps text-label-caps uppercase text-outline tracking-wider">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filtered.map(e => {
                  const meta = e.event_metadata;
                  const amount = meta.amount ?? meta.modified_amount ?? null;
                  const prevSrc = typeof meta.previous_source_budget === "number" ? meta.previous_source_budget : null;
                  const newSrc  = typeof meta.new_source_budget === "number" ? meta.new_source_budget : null;
                  return (
                    <tr key={e.id} className="hover:bg-surface transition-colors duration-100">
                      <td className="py-space-sm px-space-lg font-numeric-table text-on-surface font-semibold">EVT-{String(e.id).padStart(4, "0")}</td>
                      <td className="py-space-sm px-space-md font-code-sm text-on-surface-variant">DEC-2025-{String(e.recommendation_id).padStart(3, "0")}</td>
                      <td className="py-space-sm px-space-md">
                        <span className={`inline-flex items-center px-space-sm py-0.5 rounded font-code-sm font-semibold capitalize ${actionStyle[e.action] ?? "bg-surface-container text-on-surface"}`}>
                          {e.action}
                        </span>
                      </td>
                      <td className="py-space-sm px-space-md font-body-sm text-on-surface">{e.actor}</td>
                      <td className="py-space-sm px-space-md text-right font-numeric-table text-on-surface font-semibold">
                        {amount !== null ? formatINR(Number(amount)) : "—"}
                      </td>
                      <td className="py-space-sm px-space-md text-right font-code-sm text-on-surface-variant">
                        {prevSrc !== null && newSrc !== null ? (
                          <span>
                            {formatINR(prevSrc)}
                            <span className="text-outline mx-1">→</span>
                            <span className={newSrc < prevSrc ? "text-error" : "text-primary"}>{formatINR(newSrc)}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-space-sm px-space-lg font-code-sm text-outline">
                        {new Date(e.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
