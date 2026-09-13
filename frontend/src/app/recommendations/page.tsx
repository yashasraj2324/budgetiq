"use client";
import { Shell } from "@/components/Shell";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "bg-secondary-fixed text-secondary",
    approved: "bg-primary-container/30 text-primary",
    modified: "bg-surface-container-high text-on-surface",
    rejected: "bg-error-container/30 text-error",
  };
  return (
    <span className={`px-2 py-0.5 rounded font-code-sm text-code-sm capitalize font-semibold ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<any[]>([]);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sourceId, setSourceId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const router = useRouter();

  const loadData = () => {
    Promise.all([
      fetch(`${API}/recommendations`).then(r => r.json()),
      fetch(`${API}/budget-lines`).then(r => r.json()),
    ]).then(([recData, lineData]) => {
      setRecs(recData);
      setLines(lineData);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  // Lines that have transferable surplus (source candidates)
  const sourceOptions = lines.filter(l =>
    (l.remaining_budget - (l.necessary_future_spend ?? 0) - (l.safety_reserve ?? 0)) > 0
  );

  const handleGenerate = async () => {
    if (!sourceId || !targetId) { setGenError("Please select both a source and target line."); return; }
    if (sourceId === targetId) { setGenError("Source and target must be different."); return; }
    setGenError("");
    setGenerating(true);

    const res = await fetch(`${API}/recommendations/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_line_id: parseInt(sourceId), target_line_id: parseInt(targetId) }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/recommendations/${data.id}`);
    } else {
      const body = await res.json().catch(() => ({ detail: "Unknown error" }));
      setGenError(body.detail ?? "Generation failed. Check backend logs.");
      setGenerating(false);
    }
  };

  const lineName = (id: number) => lines.find(l => l.id === id)?.name ?? `Line #${id}`;

  return (
    <Shell activePath="recommendations">
      <div className="flex flex-col w-full gap-space-lg">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Recommendations Engine</h1>
            <p className="font-body-sm text-on-surface-variant mt-0.5">AI-generated budget reallocation recommendations with explainability trace</p>
          </div>
          <button
            id="btn-open-generate-modal"
            onClick={() => { setShowModal(true); setGenError(""); }}
            className="flex items-center gap-space-xs px-space-md py-2 bg-primary-container text-on-primary-container rounded-lg shadow hover:bg-primary hover:text-on-primary transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Generate New
          </button>
        </div>

        {/* Recommendations table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-outline">
                <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">ID</th>
                <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Source → Target</th>
                <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Amount</th>
                <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Status</th>
                <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading && (
                <tr><td colSpan={5} className="py-8 text-center text-outline">Loading…</td></tr>
              )}
              {!loading && recs.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-outline">No recommendations yet. Generate one to get started.</td></tr>
              )}
              {recs.map(rec => (
                <tr key={rec.id} className="hover:bg-surface-container transition-colors duration-100">
                  <td className="py-3 px-space-lg font-code-sm text-outline">DEC-2025-{rec.id}</td>
                  <td className="py-3 px-space-lg font-body-md text-on-surface">
                    <span className="text-secondary font-medium">{lineName(rec.source_line_id)}</span>
                    <span className="mx-2 text-outline">→</span>
                    <span className="text-primary font-medium">{lineName(rec.target_line_id)}</span>
                  </td>
                  <td className="py-3 px-space-lg font-numeric-table text-right text-on-surface font-semibold">
                    {formatINR(rec.amount)}
                  </td>
                  <td className="py-3 px-space-lg">
                    <StatusBadge status={rec.status} />
                  </td>
                  <td className="py-3 px-space-lg text-right">
                    <button
                      onClick={() => router.push(`/recommendations/${rec.id}`)}
                      className="text-primary hover:underline font-medium font-body-sm"
                    >
                      View Details &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant w-full max-w-lg mx-4 p-space-xl flex flex-col gap-space-md">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Generate Recommendation</h2>
                <p className="font-body-sm text-on-surface-variant mt-0.5">Select source (surplus) and target (underfunded) budget lines</p>
              </div>
              <button
                id="btn-close-modal"
                onClick={() => { setShowModal(false); setGenError(""); }}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Source line selector */}
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps uppercase text-secondary">
                Source Line (has surplus)
              </label>
              <select
                id="select-source-line"
                value={sourceId}
                onChange={e => { setSourceId(e.target.value); setGenError(""); }}
                className="rounded-lg border border-outline-variant bg-surface-container px-space-md py-2.5 font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— Select source —</option>
                {sourceOptions.map(l => {
                  const surplus = l.remaining_budget - (l.necessary_future_spend ?? 0) - (l.safety_reserve ?? 0);
                  return (
                    <option key={l.id} value={l.id}>
                      {l.name} · surplus {formatINR(surplus)} · priority {l.priority_weight}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Target line selector */}
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps uppercase text-primary">
                Target Line (needs funding)
              </label>
              <select
                id="select-target-line"
                value={targetId}
                onChange={e => { setTargetId(e.target.value); setGenError(""); }}
                className="rounded-lg border border-outline-variant bg-surface-container px-space-md py-2.5 font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">— Select target —</option>
                {lines.filter(l => l.id !== parseInt(sourceId || "0")).map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} · remaining {formatINR(l.remaining_budget)} · priority {l.priority_weight}
                  </option>
                ))}
              </select>
            </div>

            {genError && (
              <div className="bg-error-container/20 text-error rounded-lg px-space-md py-space-sm font-body-sm border border-error/20">
                {genError}
              </div>
            )}

            <div className="flex gap-space-md pt-2">
              <button
                id="btn-confirm-generate"
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 py-2.5 bg-primary text-on-primary rounded-lg shadow hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-space-xs"
              >
                {generating ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    Running AI Reasoning…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    Generate
                  </>
                )}
              </button>
              <button
                onClick={() => { setShowModal(false); setGenError(""); }}
                disabled={generating}
                className="px-space-lg py-2.5 bg-surface-container text-on-surface rounded-lg hover:bg-surface-container-high transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
