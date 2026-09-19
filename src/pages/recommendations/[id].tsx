"use client";
import { Shell } from "@/components/Shell";
import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API, apiFetch } from "@/lib/api";
import { trackEvent } from '@enter-pro/analytics-sdk';
import { decisionId, currencySymbol, formatMoney, useOrgCurrency } from "@/lib/format";

interface Recommendation {
  id: number;
  amount: number;
  status: string;
  confidence: number;
  source_line_id: number;
  target_line_id: number;
  created_at?: string | null;
  escalation?: { overdue?: boolean; hours_overdue?: number; escalate_to?: string } | null;
  rationale_json: { recommendation?: string; reasoning_steps?: { step: number; label: string; detail: string }[]; rejection_consequence?: string };
}

interface BudgetLine {
  id: number;
  name: string;
  priority_weight: number;
  remaining_budget: number;
  necessary_future_spend: number;
  safety_reserve: number;
  policy_maximum_transfer: number;
}

const statusPill: Record<string, string> = {
  pending: "bg-surface-container-high text-on-surface",
  approved: "bg-success-container text-success",
  rejected: "bg-error-container text-error",
  modified: "bg-secondary-fixed text-secondary",
};

export default function RecommendationDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { currency } = useOrgCurrency();
  const formatINR = (val: number) => formatMoney(val, currency);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Modify state
  const [showModify, setShowModify] = useState(false);
  const [modifyAmount, setModifyAmount] = useState("");
  const [modifyError, setModifyError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch(`${API}/recommendations/${params.id}`).then((r) => r.json()),
      apiFetch(`${API}/budget-lines`).then((r) => r.json()).catch(() => []),
    ]).then(([d, lineData]) => {
      setRec(d as Recommendation);
      setLines((lineData as BudgetLine[]) ?? []);
      setLoading(false);
    });
  }, [params.id]);

  const handleAction = async (action: "approve" | "reject") => {
    setActionLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${API}/recommendations/${params.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "VP Finance" }),
      });
      if (res.ok) {
        trackEvent(action === "approve" ? 'recommendation_approved' : 'recommendation_rejected', { eventType: 'conversion' });
        navigate("/approvals");
      } else {
        const body = await res.json();
        setError(body.detail || "Action failed.");
        setActionLoading(false);
      }
    } catch {
      setError("Network error.");
      setActionLoading(false);
    }
  };

  const handleModify = async () => {
    setModifyError("");
    const amount = parseFloat(modifyAmount);
    if (!amount || amount <= 0) { setModifyError("Enter a valid positive amount."); return; }

    setActionLoading(true);
    try {
      const res = await apiFetch(`${API}/recommendations/${params.id}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, actor: "VP Finance" }),
      });
      if (res.ok) {
        trackEvent('recommendation_modified', { eventType: 'conversion', properties: { amount } });
        navigate("/approvals");
      } else {
        const body = await res.json();
        setModifyError(body.detail || "Guardrail validation failed.");
        setActionLoading(false);
      }
    } catch {
      setModifyError("Network error.");
      setActionLoading(false);
    }
  };

  if (loading) return <Shell><div className="p-8 text-on-surface-variant">Loading...</div></Shell>;
  if (!rec) return <Shell><div className="p-8 text-error">Recommendation not found.</div></Shell>;

  const steps: { step: number; label: string; detail: string }[] =
    rec.rationale_json?.reasoning_steps ?? [];
  const rejectionConsequence = rec.rationale_json?.rejection_consequence ?? "";
  const source = lines.find((l) => l.id === rec.source_line_id);
  const target = lines.find((l) => l.id === rec.target_line_id);
  const sourceSurplus = source ? source.remaining_budget - source.necessary_future_spend - source.safety_reserve : null;
  const policyCap = source && source.policy_maximum_transfer > 0 ? source.policy_maximum_transfer : null;

  return (
    <Shell activePath="recommendations">
      <div className="max-w-3xl mx-auto flex flex-col gap-space-lg">
        <Link to="/recommendations" className="text-outline hover:text-on-surface flex items-center gap-1 font-body-sm">
          &larr; Back to Recommendations
        </Link>

        {/* Header card */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant">
          <div className="flex justify-between items-start mb-space-md">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">Decision {decisionId(rec.created_at, rec.id)}</h1>
              <p className="font-body-md text-on-surface-variant mt-1">
                Status: <span className="font-semibold capitalize">{rec.status}</span>
              </p>
            </div>
          </div>

          {/* Hero: flow chips + guarded transfer amount */}
          <div className="flex flex-col gap-space-md mb-space-md bg-surface-container-low rounded-xl border border-outline-variant p-space-lg">
            <div className="flex items-center gap-space-md flex-wrap">
              <div className="flex-1 min-w-[180px] bg-surface-container-lowest rounded-lg border border-outline-variant px-space-md py-2">
                <div className="font-label-caps text-label-caps uppercase text-outline">Source</div>
                <div className="font-body-md text-on-surface font-semibold">{source?.name ?? `Line #${rec.source_line_id}`}</div>
                {source && (
                  <div className="font-code-sm text-code-sm text-on-surface-variant">
                    priority {source.priority_weight} · surplus {formatINR(Math.max(0, sourceSurplus ?? 0))}
                  </div>
                )}
              </div>
              <span className="material-symbols-outlined text-outline" aria-hidden="true">arrow_forward</span>
              <div className="flex-1 min-w-[180px] bg-success-container rounded-lg px-space-md py-2">
                <div className="font-label-caps text-label-caps uppercase text-on-success-container">Target</div>
                <div className="font-body-md text-on-success-container font-semibold">{target?.name ?? `Line #${rec.target_line_id}`}</div>
                {target && <div className="font-code-sm text-code-sm text-on-success-container">priority {target.priority_weight}</div>}
              </div>
            </div>
            <div className="flex items-end justify-between gap-space-md flex-wrap">
              <div>
                <div className="font-label-caps text-label-caps uppercase text-outline">Transfer Amount</div>
                <div className="font-numeric-metric-lg text-numeric-metric-lg text-on-surface font-bold text-3xl tracking-tight">
                  {formatINR(rec.amount)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-code-sm text-code-sm font-semibold">
                    Confidence {Math.round(rec.confidence * 100)}%
                  </span>
                  <span className={`px-2 py-0.5 rounded-full capitalize font-code-sm text-code-sm font-semibold ${statusPill[rec.status] ?? "bg-surface-container text-on-surface"}`}>
                    {rec.status}
                  </span>
                </div>
                {sourceSurplus !== null && (
                  <div className="font-code-sm text-code-sm text-outline">
                    From source surplus {formatINR(Math.max(0, sourceSurplus))}
                    {policyCap ? ` · capped by policy ${formatINR(policyCap)}` : " · no policy cap"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI rationale summary */}
          <div className="bg-surface-container-low p-space-md rounded-lg mb-space-md border border-outline-variant">
            <h3 className="font-label-caps text-label-caps uppercase text-outline mb-space-xs">AI Recommendation</h3>
            <p className="font-body-md text-on-surface">{rec.rationale_json?.recommendation}</p>
          </div>

          {/* Reasoning steps — the F6 explainability trace */}
          {steps.length > 0 && (
            <div className="mb-space-md">
              <h3 className="font-label-caps text-label-caps uppercase text-outline mb-space-sm">
                Reasoning Trace ({steps.length} steps)
              </h3>
              <ol className="flex flex-col gap-2">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-space-md">
                    {/* Step number bubble */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-code-sm text-code-sm font-bold">
                      {s.step}
                    </div>
                    {/* Step content */}
                    <div className="flex-1 bg-surface-container p-space-sm rounded-lg border border-outline-variant">
                      <div className="font-label-md text-on-surface font-semibold mb-0.5">{s.label}</div>
                      <div className="font-body-sm text-on-surface-variant">{s.detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Rejection consequence — always from API */}
          {rejectionConsequence && (
            <div className="bg-error-container/20 p-space-md rounded-lg mb-space-md border border-error/20">
              <h3 className="font-label-caps text-label-caps uppercase text-error mb-space-xs">
                Rejection Consequence
              </h3>
              <p className="font-body-md text-on-surface">{rejectionConsequence}</p>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-error-container text-on-error-container rounded-lg px-space-md py-space-sm mb-space-md font-body-sm">
              {error}
            </div>
          )}

          {/* Escalation banner — overdue approvals are surfaced, not hidden */}
          {rec.escalation?.overdue && (
            <div className="bg-secondary-fixed text-secondary rounded-lg px-space-md py-space-sm mb-space-md font-body-sm border border-secondary/30 flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              <span>
                Overdue by {rec.escalation.hours_overdue?.toFixed(1)}h — escalated to{" "}
                <span className="font-semibold">{rec.escalation.escalate_to || "finance approver"}</span>.
              </span>
            </div>
          )}

          {/* Action buttons — Approve / Modify / Reject (pending only) */}
          {rec.status === "pending" && (
            <div className="flex flex-col gap-space-sm">
              {!showModify ? (
                <div className="flex gap-space-md">
                  <button
                    id="btn-approve"
                    onClick={() => handleAction("approve")}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 bg-primary text-on-primary rounded-lg shadow hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 font-medium disabled:opacity-50"
                  >
                    {actionLoading ? "Processing…" : "Approve"}
                  </button>
                  <button
                    id="btn-modify"
                    onClick={() => { setShowModify(true); setModifyAmount(String(rec.amount)); }}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 bg-secondary-container text-on-secondary-container rounded-lg shadow hover:bg-secondary-container/80 transition-colors font-medium disabled:opacity-50"
                  >
                    Modify Amount
                  </button>
                  <button
                    id="btn-reject"
                    onClick={() => handleAction("reject")}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 bg-surface-container-high text-on-surface rounded-lg shadow hover:bg-surface-container-highest transition-colors font-medium disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                /* Inline modify form */
                <div className="border border-outline-variant rounded-xl p-space-md flex flex-col gap-space-sm bg-surface-container-low">
                  <h4 className="font-label-md font-semibold text-on-surface">
                    Modify Transfer Amount
                  </h4>
                  <p className="font-body-sm text-on-surface-variant">
                    AI suggested {formatINR(rec.amount)}. Enter your custom amount — guardrails apply.
                  </p>
                  <div className="flex items-center gap-space-sm">
                    <span className="font-body-md text-on-surface font-semibold">{currencySymbol(currency)}</span>
                    <input
                      id="modify-amount-input"
                      type="number"
                      min="1"
                      value={modifyAmount}
                      onChange={e => { setModifyAmount(e.target.value); setModifyError(""); }}
                      className="flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-space-md py-2 font-numeric-table text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {modifyError && (
                    <div className="text-error font-body-sm px-1">{modifyError}</div>
                  )}
                  <div className="flex gap-space-sm">
                    <button
                      id="btn-confirm-modify"
                      onClick={handleModify}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 bg-primary text-on-primary rounded-lg shadow hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 font-medium disabled:opacity-50"
                    >
                      {actionLoading ? "Processing…" : "Confirm Modification"}
                    </button>
                    <button
                      id="btn-cancel-modify"
                      onClick={() => { setShowModify(false); setModifyError(""); }}
                      disabled={actionLoading}
                      className="px-space-lg py-2.5 bg-surface-container text-on-surface rounded-lg shadow hover:bg-surface-container-high transition-colors font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
