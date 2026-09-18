"use client";
import { Shell } from "@/components/Shell";
import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API, apiFetch } from "@/lib/api";

const formatINR = (val: number) =>
  "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 0 });
interface Recommendation { id: number; amount: number; status: string; confidence: number; rationale_json: { recommendation?: string; reasoning_steps?: { step: number; label: string; detail: string }[]; rejection_consequence?: string }; }

export default function RecommendationDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Modify state
  const [showModify, setShowModify] = useState(false);
  const [modifyAmount, setModifyAmount] = useState("");
  const [modifyError, setModifyError] = useState("");

  useEffect(() => {
    apiFetch(`${API}/recommendations/${params.id}`)
      .then(r => r.json())
      .then(d => { setRec(d); setLoading(false); });
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
              <h1 className="font-headline-lg text-headline-lg text-on-surface">Decision DEC-2025-{rec.id}</h1>
              <p className="font-body-md text-on-surface-variant mt-1">
                Status: <span className="font-semibold capitalize">{rec.status}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="font-numeric-metric-lg text-numeric-metric-lg text-primary font-bold">
                {formatINR(rec.amount)}
              </span>
              <div className="font-code-sm text-code-sm text-outline mt-1">
                Confidence: {Math.round(rec.confidence * 100)}%
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

          {/* Action buttons — Approve / Modify / Reject (pending only) */}
          {rec.status === "pending" && (
            <div className="flex flex-col gap-space-sm">
              {!showModify ? (
                <div className="flex gap-space-md">
                  <button
                    id="btn-approve"
                    onClick={() => handleAction("approve")}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 bg-primary text-on-primary rounded-lg shadow hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
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
                    <span className="font-body-md text-on-surface font-semibold">₹</span>
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
                      className="flex-1 py-2.5 bg-primary text-on-primary rounded-lg shadow hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
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
