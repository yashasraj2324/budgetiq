"use client";
import { Shell } from "@/components/Shell";
import { useState, useEffect } from "react";

const API = "http://localhost:8000/api";

const formatINR = (val: number) =>
  "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 0 });

interface BudgetLine {
  id: number;
  name: string;
  department_id: number;
  allocated_amount: number;
  remaining_budget: number;
  priority_weight: number;
  necessary_future_spend: number;
  safety_reserve: number;
}

interface AuditEvent {
  id: number;
  recommendation_id: number;
  action: string;
  actor: string;
  event_metadata: Record<string, any>;
  timestamp: string;
}

function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? "";
        return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
      }).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const actionColor: Record<string, string> = {
  approve: "bg-primary-container/20 text-primary",
  modify:  "bg-secondary-fixed text-secondary",
  reject:  "bg-error-container/20 text-error",
};

export default function ReportsPage() {
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/budget-lines`).then(r => r.json()),
      fetch(`${API}/audit`).then(r => r.json()),
    ]).then(([lData, aData]) => {
      setLines(lData);
      setAudit(aData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const exportBudgetCSV = () => {
    const rows = lines.map(l => ({
      id: l.id,
      name: l.name,
      department_id: l.department_id,
      allocated_amount: l.allocated_amount,
      remaining_budget: l.remaining_budget,
      spent: l.allocated_amount - l.remaining_budget,
      spent_pct: ((l.allocated_amount - l.remaining_budget) / l.allocated_amount * 100).toFixed(1),
      priority_weight: l.priority_weight,
      necessary_future_spend: l.necessary_future_spend,
      safety_reserve: l.safety_reserve,
    }));
    downloadCSV(rows, "budgetiq_budget_lines.csv");
  };

  const exportAuditCSV = () => {
    const rows = audit.map(e => ({
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
    <Shell activePath="reports">
      <div className="flex flex-col w-full gap-space-xl max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Financial Reports &amp; Exports</h1>
            <p className="font-body-sm text-on-surface-variant mt-1">Budget line summary and full audit trail</p>
          </div>
          <div className="flex gap-space-sm">
            <button
              id="btn-export-budget-csv"
              onClick={exportBudgetCSV}
              className="flex items-center gap-space-xs px-space-md py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg hover:bg-surface-container-low transition-colors font-body-sm font-medium shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">download</span>
              Budget CSV
            </button>
            <button
              id="btn-export-audit-csv"
              onClick={exportAuditCSV}
              className="flex items-center gap-space-xs px-space-md py-2 bg-primary-container text-on-primary-container rounded-lg hover:bg-primary hover:text-on-primary transition-colors font-body-sm font-medium shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              Audit CSV
            </button>
          </div>
        </div>

        {/* Budget Summary Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Budget Line Summary</h2>
              <p className="font-body-sm text-on-surface-variant">Live remaining calculated from actual spend entries</p>
            </div>
            <span className="font-code-sm text-outline">{lines.length} lines</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-outline border-b border-outline-variant bg-surface-container">
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Line Item</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Allocated</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Spent</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Remaining</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Utilisation</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading && (
                  <tr><td colSpan={6} className="py-8 text-center text-outline">Loading…</td></tr>
                )}
                {!loading && lines.map(l => {
                  const spent = l.allocated_amount - l.remaining_budget;
                  const pct = l.allocated_amount > 0 ? (spent / l.allocated_amount) * 100 : 0;
                  const overrun = pct > 90;
                  return (
                    <tr key={l.id} className="hover:bg-surface-container transition-colors duration-100">
                      <td className="py-3 px-space-lg font-body-md text-on-surface font-medium">{l.name}</td>
                      <td className="py-3 px-space-lg font-numeric-table text-right text-on-surface">{formatINR(l.allocated_amount)}</td>
                      <td className="py-3 px-space-lg font-numeric-table text-right text-on-surface">{formatINR(spent)}</td>
                      <td className={`py-3 px-space-lg font-numeric-table text-right font-semibold ${overrun ? "text-error" : "text-primary"}`}>
                        {formatINR(l.remaining_budget)}
                      </td>
                      <td className="py-3 px-space-lg min-w-[160px]">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-20 h-2 bg-surface-container-high rounded overflow-hidden">
                            <div
                              className={`h-full rounded ${overrun ? "bg-error" : "bg-primary-container"}`}
                              style={{ width: Math.min(100, pct) + "%" }}
                            />
                          </div>
                          <span className="font-numeric-table font-semibold text-on-surface">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-space-lg text-right font-numeric-table text-on-surface">{l.priority_weight}/100</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Audit Trail</h2>
              <p className="font-body-sm text-on-surface-variant">All approve / modify / reject actions with before-and-after budget snapshots</p>
            </div>
            <span className="font-code-sm text-outline">{audit.length} events</span>
          </div>
          {loading ? (
            <div className="py-8 text-center text-outline font-body-sm">Loading…</div>
          ) : audit.length === 0 ? (
            <div className="py-8 text-center text-outline font-body-sm">No audit events yet. Approve or reject a recommendation to generate events.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-outline border-b border-outline-variant bg-surface-container">
                    <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Rec #</th>
                    <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Action</th>
                    <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Actor</th>
                    <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Amount</th>
                    <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Src Before → After</th>
                    <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {audit.map(e => {
                    const meta = e.event_metadata;
                    const amount = meta.amount ?? meta.modified_amount ?? "—";
                    return (
                      <tr key={e.id} className="hover:bg-surface-container transition-colors duration-100">
                        <td className="py-3 px-space-lg font-code-sm text-outline">DEC-2025-{e.recommendation_id}</td>
                        <td className="py-3 px-space-lg">
                          <span className={`px-2 py-0.5 rounded font-code-sm text-code-sm capitalize font-semibold ${actionColor[e.action] ?? ""}`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="py-3 px-space-lg font-body-sm text-on-surface">{e.actor}</td>
                        <td className="py-3 px-space-lg font-numeric-table text-right text-on-surface font-semibold">
                          {typeof amount === "number" ? formatINR(amount) : amount}
                        </td>
                        <td className="py-3 px-space-lg font-numeric-table text-right text-outline text-xs">
                          {typeof meta.previous_source_budget === "number"
                            ? `${formatINR(meta.previous_source_budget)} → ${formatINR(meta.new_source_budget)}`
                            : "—"}
                        </td>
                        <td className="py-3 px-space-lg font-code-sm text-on-surface-variant">
                          {new Date(e.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
