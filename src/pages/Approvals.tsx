import { Shell } from "@/components/Shell";
import { ApprovalsTable } from "@/components/ApprovalsTable";
import { useState, useEffect } from "react";

const API = "http://localhost:8000/api";

function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
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

export default function ApprovalsPage() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    Promise.all([
      fetch(`${API}/recommendations`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${API}/audit`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([recs, auditEvents]) => {
        setRecommendations(recs);
        setAudit(auditEvents);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleExport = () => {
    if (!audit.length) { alert("No audit events to export yet."); return; }
    const rows = audit.map((e: any) => ({
      id: e.id,
      recommendation_id: e.recommendation_id,
      action: e.action,
      actor: e.actor,
      timestamp: new Date(e.timestamp).toLocaleString("en-IN"),
      ...e.event_metadata,
    }));
    downloadCSV(rows, "budgetiq_audit_trail.csv");
  };

  return (
    <Shell activePath="approvals">
      <div className="flex flex-col w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
          <div>
            <div className="flex items-center gap-space-sm mb-space-xs">
              <span className="font-label-caps text-label-caps uppercase text-outline tracking-wider">Compliance &amp; Governance</span>
              <span className="text-outline-variant font-mono text-[10px]">&middot;</span>
              <span className="font-code-sm text-code-sm text-primary font-medium">SOC-2 Type II Certified Chain</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Approval History</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Immutable decision provenance ledger and automated compliance audit trail &middot; {recommendations.length} total records
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              id="btn-export-audit-csv"
              onClick={handleExport}
              className="flex items-center gap-space-xs px-space-md py-2 bg-surface-container-lowest text-on-surface font-body-sm text-body-sm font-medium rounded shadow-sm hover:bg-surface-container-low transition-colors duration-150 border border-outline-variant"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export Audit Trail (CSV)</span>
            </button>
          </div>
        </div>
        {loading ? (
          <div className="py-16 text-center text-outline font-body-md">Loading…</div>
        ) : (
          <ApprovalsTable initialData={recommendations} />
        )}
      </div>
    </Shell>
  );
}
