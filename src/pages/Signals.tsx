import { Shell } from "../components/Shell";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API, apiFetch } from "../lib/api";

const formatINR = (val: number) =>
  "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 0 });

interface AnomalySignal {
  budget_line_id: number;
  budget_line_name: string;
  department_name: string;
  velocity_multiplier: number;
  recent_rate: number;
  baseline_rate: number;
  period_remaining: number;
}

interface BudgetLine {
  id: number;
  name: string;
  remaining_budget: number;
  allocated_amount: number;
  priority_weight: number;
  necessary_future_spend: number;
  safety_reserve: number;
}

function SeverityBadge({ multiplier }: { multiplier: number }) {
  if (multiplier >= 3)
    return <span className="px-2 py-0.5 rounded bg-error-container text-error font-code-sm font-bold">Critical {multiplier.toFixed(1)}×</span>;
  if (multiplier >= 2)
    return <span className="px-2 py-0.5 rounded bg-secondary-fixed text-secondary font-code-sm font-bold">High {multiplier.toFixed(1)}×</span>;
  return <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-code-sm font-bold">Moderate {multiplier.toFixed(1)}×</span>;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<AnomalySignal[]>([]);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<number | null>(null);
  const [genError, setGenError] = useState<Record<number, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiFetch(`${API}/anomalies`).then((r) => r.json()),
      apiFetch(`${API}/budget-lines`).then((r) => r.json()),
    ])
      .then(([aData, lData]) => {
        setSignals(aData);
        setLines(lData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const surplus = (line: BudgetLine) =>
    line.remaining_budget - (line.necessary_future_spend ?? 0) - (line.safety_reserve ?? 0);

  const targetOptions = (sourceId: number) =>
    lines.filter((l) => l.id !== sourceId && l.priority_weight > (lines.find((x) => x.id === sourceId)?.priority_weight ?? 0));

  const handleResolve = async (sourceId: number) => {
    const targets = targetOptions(sourceId);
    if (!targets.length) {
      setGenError((prev) => ({ ...prev, [sourceId]: "No higher-priority target lines available." }));
      return;
    }
    const targetId = targets[0].id; // auto-select highest-priority target
    setGenerating(sourceId);
    setGenError((prev) => ({ ...prev, [sourceId]: "" }));

    try {
      const res = await apiFetch(`${API}/recommendations/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_line_id: sourceId, target_line_id: targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/recommendations/${data.id}`);
      } else {
        const body = await res.json().catch(() => ({ detail: "Generation failed." }));
        setGenError((prev) => ({ ...prev, [sourceId]: body.detail ?? "Generation failed." }));
        setGenerating(null);
      }
    } catch {
      setGenError((prev) => ({ ...prev, [sourceId]: "Network error." }));
      setGenerating(null);
    }
  };

  return (
    <Shell activePath="signals">
      <div className="flex flex-col w-full gap-space-xl max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <div className="flex items-center gap-space-sm mb-space-xs">
            <span className="material-symbols-outlined text-secondary text-[20px]">crisis_alert</span>
            <span className="font-label-caps text-label-caps uppercase text-secondary tracking-wider">Anomaly Detection Engine</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Spend Velocity Signals</h1>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Lines exhibiting statistically significant spend acceleration. Each signal is a candidate for reallocation.
          </p>
        </div>

        {/* Signal cards */}
        {loading ? (
          <div className="py-16 text-center text-outline font-body-md">Scanning for anomalies…</div>
        ) : signals.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-xl text-center">
            <span className="material-symbols-outlined text-[48px] text-outline mb-space-md block">check_circle</span>
            <h2 className="font-headline-md text-on-surface">No Active Anomalies</h2>
            <p className="font-body-md text-on-surface-variant mt-2">All budget lines are within normal velocity ranges.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-space-md">
            {signals.map((sig) => {
              const sourceLine = lines.find((l) => l.id === sig.budget_line_id);
              const surplusAmt = sourceLine ? surplus(sourceLine) : 0;
              const targets = sourceLine ? targetOptions(sig.budget_line_id) : [];
              const isGenerating = generating === sig.budget_line_id;

              return (
                <div
                  key={sig.budget_line_id}
                  className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-space-lg flex flex-col gap-space-md"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-space-md">
                    <div className="flex-1">
                      <div className="flex items-center gap-space-sm flex-wrap">
                        <h2 className="font-headline-md text-on-surface">{sig.budget_line_name}</h2>
                        <SeverityBadge multiplier={sig.velocity_multiplier} />
                      </div>
                      <p className="font-body-sm text-on-surface-variant mt-0.5">{sig.department_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {sourceLine && (
                        <>
                          <div className="font-numeric-metric-lg text-on-surface font-semibold">{formatINR(sourceLine.remaining_budget)}</div>
                          <div className="font-code-sm text-outline">remaining</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Velocity metrics */}
                  <div className="grid grid-cols-3 gap-space-md">
                    <div className="bg-surface-container p-space-sm rounded-lg border border-outline-variant text-center">
                      <div className="font-label-caps text-label-caps uppercase text-outline mb-1">Recent Rate</div>
                      <div className="font-numeric-table text-on-surface font-semibold">{formatINR(sig.recent_rate)}<span className="text-outline font-normal">/wk</span></div>
                    </div>
                    <div className="bg-surface-container p-space-sm rounded-lg border border-outline-variant text-center">
                      <div className="font-label-caps text-label-caps uppercase text-outline mb-1">Baseline Rate</div>
                      <div className="font-numeric-table text-on-surface font-semibold">{formatINR(sig.baseline_rate)}<span className="text-outline font-normal">/wk</span></div>
                    </div>
                    <div className="bg-surface-container p-space-sm rounded-lg border border-outline-variant text-center">
                      <div className="font-label-caps text-label-caps uppercase text-outline mb-1">Periods Left</div>
                      <div className="font-numeric-table text-on-surface font-semibold">{sig.period_remaining} <span className="text-outline font-normal">wks</span></div>
                    </div>
                  </div>

                  {/* Surplus + target preview */}
                  <div className="flex items-center justify-between gap-space-md flex-wrap">
                    <div className="font-body-sm text-on-surface-variant">
                      Transferable surplus:{" "}
                      <span className={`font-semibold ${surplusAmt > 0 ? "text-secondary" : "text-error"}`}>
                        {formatINR(surplusAmt)}
                      </span>
                      {targets.length > 0 && (
                        <span className="ml-space-sm text-outline">
                          → auto-target: <span className="text-primary font-medium">{targets[0].name}</span> (priority {targets[0].priority_weight})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {genError[sig.budget_line_id] && (
                        <div className="font-body-sm text-error text-right">{genError[sig.budget_line_id]}</div>
                      )}
                      <button
                        id={`btn-resolve-${sig.budget_line_id}`}
                        onClick={() => handleResolve(sig.budget_line_id)}
                        disabled={isGenerating || surplusAmt <= 0}
                        className="flex items-center gap-space-xs px-space-md py-2 bg-primary text-on-primary rounded-lg shadow hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <>
                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                            Running AI…
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                            Generate Reallocation
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
