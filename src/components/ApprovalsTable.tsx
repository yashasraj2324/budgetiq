"use client";
import { useState, useEffect } from "react";
import { API, apiFetch } from "@/lib/api";

const formatINR = (val: number) =>
  "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 0 });

interface BudgetLine { id: number; name: string; }
interface ReasoningStep { step: number; label: string; detail: string; }
interface Recommendation {
  id: number;
  source_line_id: number;
  target_line_id: number;
  amount: number;
  confidence: number;
  status: string;
  rationale_json?: { reasoning_steps?: ReasoningStep[]; rejection_consequence?: string };
}

const statusStyle: Record<string, string> = {
  approved: "bg-primary-container/20 text-primary",
  rejected:  "bg-error-container/20 text-error",
  modified:  "bg-secondary-fixed text-secondary",
  pending:   "bg-surface-container-high text-on-surface-variant",
};

export function ApprovalsTable({ initialData = [] }: { initialData?: Recommendation[] }) {
  const [data, setData] = useState<Recommendation[]>(initialData);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [modifyRowId, setModifyRowId] = useState<number | null>(null);
  const [modifyAmounts, setModifyAmounts] = useState<Record<number, string>>({});
  const [modifyErrors, setModifyErrors] = useState<Record<number, string>>({});
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    apiFetch(`${API}/budget-lines`)
      .then(r => r.json())
      .then((d: BudgetLine[]) => setLines(d))
      .catch(() => {});
  }, []);

  const lineName = (id: number) => lines.find(l => l.id === id)?.name ?? `Line #${id}`;

  const refresh = () => {
    apiFetch(`${API}/recommendations`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => window.location.reload());
  };

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      const res = await apiFetch(`${API}/recommendations/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "VP Finance" }),
      });
      if (res.ok) {
        refresh();
      } else {
        const body = await res.json().catch(() => ({ detail: "Action failed." }));
        setModifyErrors(prev => ({ ...prev, [id]: body.detail ?? "Action failed." }));
      }
    } catch {
      setModifyErrors(prev => ({ ...prev, [id]: "Network error." }));
    }
    setActionLoading(null);
  };

  const handleModify = async (id: number) => {
    const raw = modifyAmounts[id];
    const amount = parseFloat(raw);
    if (!amount || amount <= 0) {
      setModifyErrors(prev => ({ ...prev, [id]: "Enter a valid positive amount." }));
      return;
    }
    setActionLoading(id);
    try {
      const res = await apiFetch(`${API}/recommendations/${id}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, actor: "VP Finance" }),
      });
      if (res.ok) {
        setModifyRowId(null);
        refresh();
      } else {
        const body = await res.json().catch(() => ({ detail: "Guardrail failed." }));
        setModifyErrors(prev => ({ ...prev, [id]: body.detail ?? "Guardrail failed." }));
      }
    } catch {
      setModifyErrors(prev => ({ ...prev, [id]: "Network error." }));
    }
    setActionLoading(null);
  };

  const openModify = (id: number, amount: number) => {
    setModifyRowId(id);
    setModifyAmounts(prev => ({ ...prev, [id]: String(amount) }));
    setModifyErrors(prev => ({ ...prev, [id]: "" }));
    setExpandedRow(null);
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col mb-space-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-lowest">
              <th className="py-space-md px-space-lg font-label-caps text-label-caps text-outline uppercase tracking-wider font-medium">Decision ID</th>
              <th className="py-space-md px-space-md font-label-caps text-label-caps text-outline uppercase tracking-wider font-medium">Capital Motion (Source → Target)</th>
              <th className="py-space-md px-space-md font-label-caps text-label-caps text-outline uppercase tracking-wider font-medium text-right">Net Value</th>
              <th className="py-space-md px-space-md font-label-caps text-label-caps text-outline uppercase tracking-wider font-medium">Status</th>
              <th className="py-space-md px-space-lg font-label-caps text-label-caps text-outline uppercase tracking-wider font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-outline font-body-md text-body-md">No recommendations found.</td>
              </tr>
            )}
            {data.map((rec) => {
              const steps: ReasoningStep[] = rec.rationale_json?.reasoning_steps ?? [];
              const isExpanded = expandedRow === rec.id;
              const isModifying = modifyRowId === rec.id;
              const isLoading = actionLoading === rec.id;

              return (
                <tr key={rec.id} className="hover:bg-surface transition-colors duration-150 align-top">
                  <td className="py-space-sm px-space-lg">
                    <div className="font-numeric-table text-numeric-table font-semibold text-on-surface">DEC-2025-{String(rec.id).padStart(3, "0")}</div>
                    <div className="font-code-sm text-code-sm text-outline mt-0.5">Automated</div>
                  </td>

                  <td className="py-space-sm px-space-md max-w-sm">
                    {/* Source → Target names */}
                    <div className="font-body-md text-body-md font-medium text-on-surface">
                      <span className="text-secondary font-semibold">{lineName(rec.source_line_id)}</span>
                      <span className="mx-2 text-outline">→</span>
                      <span className="text-primary font-semibold">{lineName(rec.target_line_id)}</span>
                    </div>
                    <div className="font-code-sm text-code-sm text-outline mt-0.5">
                      Confidence: {Math.round(rec.confidence * 100)}% &middot;{" "}
                      <button
                        onClick={() => { setExpandedRow(isExpanded ? null : rec.id); setModifyRowId(null); }}
                        className="text-primary hover:underline"
                      >
                        {isExpanded ? "Hide Trace" : "View Trace"}
                      </button>
                    </div>

                    {/* Reasoning steps trace — replaces raw JSON dump */}
                    {isExpanded && steps.length > 0 && (
                      <div className="mt-space-sm flex flex-col gap-1.5 max-w-md">
                        {steps.map((s, i) => (
                          <div key={i} className="flex gap-space-sm">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-code-sm font-bold text-[11px]">
                              {s.step}
                            </div>
                            <div className="flex-1 bg-surface-container p-space-xs rounded border border-outline-variant">
                              <div className="font-code-sm font-semibold text-on-surface">{s.label}</div>
                              <div className="font-body-sm text-on-surface-variant text-[12px] mt-0.5">{s.detail}</div>
                            </div>
                          </div>
                        ))}
                        {rec.rationale_json?.rejection_consequence && (
                          <div className="mt-1 p-space-xs rounded border border-error/20 bg-error-container/10">
                            <div className="font-code-sm font-semibold text-error text-[11px] uppercase mb-0.5">Rejection Consequence</div>
                            <div className="font-body-sm text-on-surface text-[12px]">{rec.rationale_json.rejection_consequence}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {isExpanded && steps.length === 0 && (
                      <pre className="mt-2 p-2 text-[11px] overflow-x-auto font-mono text-outline leading-tight whitespace-pre-wrap border border-outline-variant rounded bg-surface max-w-sm">
                        {JSON.stringify(rec.rationale_json, null, 2)}
                      </pre>
                    )}

                    {/* Inline modify form */}
                    {isModifying && (
                      <div className="mt-space-sm border border-outline-variant rounded-xl p-space-sm bg-surface-container-low flex flex-col gap-space-xs max-w-sm">
                        <div className="font-label-md font-semibold text-on-surface">Modify Transfer Amount</div>
                        <div className="font-body-sm text-on-surface-variant">AI suggested {formatINR(rec.amount)}. Guardrails enforced.</div>
                        <div className="flex items-center gap-space-xs">
                          <span className="font-body-md text-on-surface font-semibold">₹</span>
                          <input
                            type="number"
                            min="1"
                            value={modifyAmounts[rec.id] ?? ""}
                            onChange={e => {
                              setModifyAmounts(prev => ({ ...prev, [rec.id]: e.target.value }));
                              setModifyErrors(prev => ({ ...prev, [rec.id]: "" }));
                            }}
                            className="flex-1 rounded border border-outline-variant bg-surface-container-lowest px-space-sm py-1.5 font-numeric-table text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                          />
                        </div>
                        {modifyErrors[rec.id] && (
                          <div className="text-error font-body-sm text-[12px]">{modifyErrors[rec.id]}</div>
                        )}
                        <div className="flex gap-space-xs">
                          <button
                            onClick={() => handleModify(rec.id)}
                            disabled={isLoading}
                            className="flex-1 py-1.5 bg-primary text-on-primary rounded font-body-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            {isLoading ? "Processing…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setModifyRowId(null)}
                            disabled={isLoading}
                            className="px-space-md py-1.5 bg-surface-container text-on-surface rounded font-body-sm hover:bg-surface-container-high transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="py-space-sm px-space-md text-right">
                    <div className="font-numeric-table text-numeric-table font-semibold text-on-surface">{formatINR(rec.amount)}</div>
                  </td>

                  <td className="py-space-sm px-space-md">
                    <span className={`inline-flex items-center px-space-sm py-0.5 rounded font-code-sm text-code-sm font-semibold ${statusStyle[rec.status] ?? ""}`}>
                      {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                    </span>
                  </td>

                  <td className="py-space-sm px-space-lg text-right">
                    {rec.status === "pending" && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleAction(rec.id, "approve")}
                          disabled={isLoading}
                          className="px-3 py-1 bg-primary text-on-primary font-body-sm font-medium rounded shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openModify(rec.id, rec.amount)}
                          disabled={isLoading}
                          className="px-3 py-1 bg-secondary-container text-on-secondary-container font-body-sm font-medium rounded shadow-sm hover:bg-secondary-container/80 transition-colors disabled:opacity-50"
                        >
                          Modify
                        </button>
                        <button
                          onClick={() => handleAction(rec.id, "reject")}
                          disabled={isLoading}
                          className="px-3 py-1 bg-surface-container text-on-surface font-body-sm font-medium rounded shadow-sm hover:bg-surface-container-high transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {isLoading && (
                      <span className="text-outline font-body-sm">Processing…</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
