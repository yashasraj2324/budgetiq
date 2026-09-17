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
  policy_maximum_transfer: number;
  necessary_future_spend: number;
  safety_reserve: number;
}

interface Department {
  id: number;
  name: string;
  priority_weight: number;
}

function ConfigRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between py-space-sm border-b border-outline-variant last:border-0">
      <div>
        <div className="font-body-md text-on-surface font-medium">{label}</div>
        {note && <div className="font-body-sm text-on-surface-variant mt-0.5">{note}</div>}
      </div>
      <div className="font-code-sm text-on-surface bg-surface-container px-space-md py-1 rounded font-semibold">
        {value}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/budget-lines`).then((r) => r.json()),
      fetch(`${API}/departments`).then((r) => r.json()),
    ])
      .then(([lData, dData]) => {
        setLines(lData);
        setDepts(dData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const deptName = (id: number) => depts.find((d) => d.id === id)?.name ?? "—";

  return (
    <Shell activePath="settings">
      <div className="flex flex-col w-full gap-space-xl max-w-4xl mx-auto">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Workspace Settings</h1>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Organisation configuration and policy limits — read from the active data source.
          </p>
        </div>

        {/* Org Config */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-outline text-[20px]">business</span>
            Organisation Config
          </h2>
          <ConfigRow label="Organisation" value="BudgetIQ Demo Org" />
          <ConfigRow label="Fiscal Year" value="FY 2025" />
          <ConfigRow label="Currency" value="INR (₹)" note="Indian Rupee — all amounts in ₹" />
          <ConfigRow label="Active Period" value="Q2 · Apr 01 – Jun 30" />
          <ConfigRow label="Database Engine" value="MongoDB" note="MVP Stage 1 — PostgreSQL planned for Stage 2" />
        </div>

        {/* Departments */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-outline text-[20px]">apartment</span>
            Departments &amp; Priority Weights
          </h2>
          {loading ? (
            <div className="text-outline font-body-sm py-4 text-center">Loading…</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-outline border-b border-outline-variant">
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider">Department</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider text-right">Priority Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {depts.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 font-body-md text-on-surface font-medium">{d.name}</td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex items-center gap-space-sm">
                        <div className="w-24 h-1.5 bg-surface-container-high rounded overflow-hidden">
                          <div className="h-full bg-primary rounded" style={{ width: d.priority_weight + "%" }} />
                        </div>
                        <span className="font-numeric-table text-on-surface font-semibold">{d.priority_weight}/100</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Policy limits per line */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-outline text-[20px]">policy</span>
            Transfer Policy Limits (per Budget Line)
          </h2>
          <p className="font-body-sm text-on-surface-variant mb-space-md">
            <code className="font-code-sm bg-surface-container px-1 py-0.5 rounded">policy_maximum_transfer</code> — the hard ceiling on any single reallocation from that line, enforced by the guardrail engine.
          </p>
          {loading ? (
            <div className="text-outline font-body-sm py-4 text-center">Loading…</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-outline border-b border-outline-variant">
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider">Department</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider">Line Item</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider text-right">Policy Max</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider text-right">Safety Reserve</th>
                  <th className="py-2 font-label-caps text-label-caps uppercase tracking-wider text-right">Necessary Future</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {lines.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-container transition-colors duration-100 group">
                    <td className="py-2.5 font-body-sm text-on-surface-variant">{deptName(l.department_id)}</td>
                    <td className="py-2.5 font-body-md text-on-surface font-medium">{l.name}</td>
                    <td className="py-2.5 text-right font-numeric-table font-semibold group-hover:bg-surface-container-high transition-colors cursor-pointer rounded"
                        onClick={async () => {
                          const val = prompt(`Set new Policy Max Transfer for ${l.name}:`, l.policy_maximum_transfer.toString());
                          if (val !== null && !isNaN(Number(val))) {
                            await fetch(`${API}/budget-lines/${l.id}/policy`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policy_maximum_transfer: Number(val) }) });
                            setLines((prev) => prev.map((x) => x.id === l.id ? { ...x, policy_maximum_transfer: Number(val) } : x));
                          }
                        }}>
                      {formatINR(l.policy_maximum_transfer)}
                      <span className="material-symbols-outlined text-[14px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                    </td>
                    <td className="py-2.5 text-right font-numeric-table font-semibold text-outline group-hover:bg-surface-container-high transition-colors cursor-pointer rounded"
                        onClick={async () => {
                          const val = prompt(`Set new Safety Reserve for ${l.name}:`, l.safety_reserve.toString());
                          if (val !== null && !isNaN(Number(val))) {
                            await fetch(`${API}/budget-lines/${l.id}/policy`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ safety_reserve: Number(val) }) });
                            setLines((prev) => prev.map((x) => x.id === l.id ? { ...x, safety_reserve: Number(val) } : x));
                          }
                        }}>
                      {formatINR(l.safety_reserve)}
                      <span className="material-symbols-outlined text-[14px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                    </td>
                    <td className="py-2.5 text-right font-numeric-table font-semibold text-outline group-hover:bg-surface-container-high transition-colors cursor-pointer rounded"
                        onClick={async () => {
                          const val = prompt(`Set new Necessary Future Spend for ${l.name}:`, l.necessary_future_spend.toString());
                          if (val !== null && !isNaN(Number(val))) {
                            await fetch(`${API}/budget-lines/${l.id}/policy`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ necessary_future_spend: Number(val) }) });
                            setLines((prev) => prev.map((x) => x.id === l.id ? { ...x, necessary_future_spend: Number(val) } : x));
                          }
                        }}>
                      {formatINR(l.necessary_future_spend)}
                      <span className="material-symbols-outlined text-[14px] text-outline ml-1 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
