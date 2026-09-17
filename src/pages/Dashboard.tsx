import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { RechartsChart } from "@/components/RechartsChart";
import { Shell } from "@/components/Shell";

interface BudgetLineRow {
  id: number;
  name: string;
  department_id: number;
  department_name: string;
  allocated_amount: number;
  remaining_budget: number;
  priority_weight: number;
  category: string;
}

interface DashboardData {
  total_budget: number;
  total_remaining: number;
  reallocatable: number;
  pending_recommendations: number;
  anomaly_count: number;
  departments?: { id: number; name: string; budget_lines: Omit<BudgetLineRow, "department_name">[] }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    total_budget: 25000000,
    total_remaining: 18450000,
    reallocatable: 1200000,
    pending_recommendations: 3,
    anomaly_count: 1,
  });
  const [anomalies, setAnomalies] = useState<{ budget_line_id: number }[]>([]);
  const [syncedAt, setSyncedAt] = useState("—");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("http://localhost:8000/api/dashboard", { cache: "no-store" });
        if (res.ok) {
          const d = await res.json();
          if (!cancelled) {
            setData(d);
            setSyncedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
          }
        }
        const res2 = await fetch("http://localhost:8000/api/anomalies", { cache: "no-store" });
        if (res2.ok && !cancelled) {
          setAnomalies(await res2.json());
        }
      } catch {
        /* backend offline — fall back to demo data */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const formatCurrency = (val: number) => "₹" + (val / 100000).toFixed(1) + "L";
  const formatINR = (val: number) => "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const all_budget_lines: BudgetLineRow[] = [];
  if (data && data.departments) {
    data.departments.forEach((d) => {
      d.budget_lines.forEach((bl) => {
        all_budget_lines.push({ ...bl, department_name: d.name });
      });
    });
  }

  return (
    <Shell activePath="dashboard">
      <div className="flex flex-col w-full gap-space-xl">
        {/* Top Meta & Quick Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-space-sm">
              <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Executive Portfolio Ledger</span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm uppercase">Q2 Live Sync</span>
              <span className="text-xs text-outline font-medium">Last synced: {syncedAt}</span>
            </div>
            <p className="font-body-sm text-body-sm text-outline">Real-time ledger audit trail across {data.departments?.length ?? 0} operating departments.</p>
          </div>
          <div className="flex items-center gap-space-sm">
            <div className="flex items-center bg-surface-container-lowest px-space-md py-1 rounded shadow-sm gap-space-xs text-outline">
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              <span className="font-code-sm text-code-sm text-on-surface">FY25 &middot; Apr 01 &ndash; Jun 30</span>
            </div>
            <button className="flex items-center gap-space-xs px-space-md py-1 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low font-body-sm text-body-sm rounded shadow-sm transition-colors duration-150">
              <span className="material-symbols-outlined text-[16px] text-outline">tune</span>
              <span>Filter Scenarios</span>
            </button>
            <button className="flex items-center gap-space-xs px-space-md py-1 bg-primary-container hover:bg-primary text-on-primary font-body-sm text-body-sm font-medium rounded shadow-sm transition-colors duration-150">
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Metric Bento Cards — 4 dedicated cards per FR-001 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">

          {/* Card 1: Total Budget */}
          <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-caps text-label-caps uppercase text-outline">Total Allocated</span>
              <span className="material-symbols-outlined text-outline text-[18px]">account_balance_wallet</span>
            </div>
            <div className="my-space-md">
              <div className="font-numeric-metric-lg text-numeric-metric-lg text-on-surface tracking-tight font-semibold">
                {formatCurrency(data.total_budget)}
              </div>
              <div className="font-code-sm text-code-sm text-outline mt-1">INR &middot; FY25 Q2</div>
            </div>
            <div className="pt-space-sm text-right">
              <span className="font-code-sm text-code-sm text-outline">Fiscal envelope</span>
            </div>
          </div>

          {/* Card 2: Total Remaining */}
          <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-caps text-label-caps uppercase text-outline">Total Remaining</span>
              <span className="material-symbols-outlined text-primary text-[18px]">savings</span>
            </div>
            <div className="my-space-md">
              <div className="font-numeric-metric-lg text-numeric-metric-lg text-primary tracking-tight font-semibold">
                {formatCurrency(data.total_remaining)}
              </div>
              <div className="font-code-sm text-code-sm text-outline mt-1">
                {data.total_budget > 0 ? ((data.total_remaining / data.total_budget) * 100).toFixed(1) : 0}% of budget
              </div>
            </div>
            <div className="pt-space-sm">
              <div className="w-full h-1.5 bg-surface-container-high rounded overflow-hidden">
                <div className="h-full bg-primary rounded" style={{ width: data.total_budget > 0 ? Math.min(100, (data.total_remaining / data.total_budget) * 100) + "%" : "0%" }} />
              </div>
            </div>
          </div>

          {/* Card 3: Reallocatable Surplus */}
          <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-caps text-label-caps uppercase text-outline">Reallocatable</span>
              <span className="material-symbols-outlined text-secondary text-[18px]">swap_horiz</span>
            </div>
            <div className="my-space-md">
              <div className="font-numeric-metric-lg text-numeric-metric-lg text-secondary tracking-tight font-semibold">
                {formatINR(data.reallocatable)}
              </div>
              <div className="font-code-sm text-code-sm text-outline mt-1">After reserves &amp; future spend</div>
            </div>
            <div className="pt-space-sm flex items-center justify-between">
              <span className="font-code-sm text-code-sm text-outline">Transferable surplus</span>
              <Link to="/recommendations" className="font-code-sm text-code-sm text-secondary font-medium hover:underline">Generate &rarr;</Link>
            </div>
          </div>

          {/* Card 4: Pending + Anomalies */}
          <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-caps text-label-caps uppercase text-outline">Pending Reviews</span>
              <span className="material-symbols-outlined text-primary-container text-[18px]">verified_user</span>
            </div>
            <div className="my-space-md flex flex-col gap-space-xs">
              <div className="flex items-baseline gap-space-sm">
                <span className="font-numeric-metric-lg text-numeric-metric-lg text-primary-container font-bold">{data.pending_recommendations}</span>
                <span className="font-code-sm text-code-sm text-primary-container px-1.5 py-0.5 bg-surface-container-high rounded font-medium">Pending</span>
              </div>
              {data.anomaly_count > 0 && (
                <div className="flex items-center gap-space-xs">
                  <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse" />
                  <span className="font-body-sm text-body-sm text-secondary font-medium">{data.anomaly_count} anomaly detected</span>
                </div>
              )}
            </div>
            <div className="pt-space-sm flex items-center justify-between">
              <Link to="/approvals" className="font-code-sm text-code-sm text-primary-container font-medium hover:underline">Approve Batch &rarr;</Link>
              <Link to="/signals" className="font-code-sm text-code-sm text-secondary font-medium hover:underline">Signals &rarr;</Link>
            </div>
          </div>

        </div>

        {/* Budget Lines Table */}
        <div className="bg-surface-container-lowest rounded shadow-sm flex flex-col overflow-hidden">
          <div className="p-space-lg bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-space-sm">
                <span className="font-headline-md text-headline-md text-on-surface">Budget Lines</span>
                <span className="px-2 py-0.5 rounded bg-surface-container-low text-outline font-code-sm text-code-sm">{all_budget_lines.length} Active Feeds</span>
              </div>
              <span className="font-body-sm text-body-sm text-outline">Fiscal Year 2025 &middot; Q2 Department Breakdown</span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-low p-0.5 rounded">
              <button className="px-space-md py-1 rounded bg-surface-container-lowest shadow-sm font-body-sm text-body-sm font-medium text-on-surface">All Departments</button>
              <button className="px-space-md py-1 rounded text-outline hover:text-on-surface font-body-sm text-body-sm transition-colors">Over-allocated</button>
              <button className="px-space-md py-1 rounded text-outline hover:text-on-surface font-body-sm text-body-sm transition-colors">Variance &gt; 5%</button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-outline">
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Department</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Line Item</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Allocated</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider">Spent %</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-center">Status</th>
                  <th className="py-2.5 px-space-lg font-label-caps text-label-caps uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {all_budget_lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-outline">No budget lines found.</td>
                  </tr>
                )}
                {all_budget_lines.map((line, i) => {
                  const spent = line.allocated_amount - line.remaining_budget;
                  const spentPct = line.allocated_amount > 0 ? (spent / line.allocated_amount) * 100 : 0;
                  const hasAnomaly = anomalies.some((a) => a.budget_line_id === line.id);

                  return (
                    <tr key={i} className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors duration-100">
                      <td className="py-3 px-space-lg font-body-md text-body-md text-on-surface font-medium">{line.department_name}</td>
                      <td className="py-3 px-space-lg font-body-md text-body-md text-on-surface-variant">{line.name}</td>
                      <td className="py-3 px-space-lg font-numeric-table text-numeric-table text-right text-on-surface font-medium">{formatCurrency(line.allocated_amount)}</td>
                      <td className="py-3 px-space-lg min-w-[170px]">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-24 h-2 bg-surface-container-high rounded overflow-hidden">
                            <div className={`h-full rounded ${hasAnomaly ? "bg-secondary-container" : "bg-primary-container"}`} style={{ width: Math.min(100, spentPct) + "%" }}></div>
                          </div>
                          <span className="font-numeric-table text-numeric-table font-semibold text-on-surface">{spentPct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-space-lg text-center">
                        {hasAnomaly ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary-fixed text-secondary font-code-sm text-code-sm font-semibold">
                            <span className="material-symbols-outlined text-[13px]">emergency_home</span>
                            <span>Anomaly</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-on-surface font-code-sm text-code-sm font-semibold">
                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                            <span>Normal</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-space-lg text-right">
                        {hasAnomaly ? (
                          <Link to="/recommendations" className="inline-flex items-center gap-1 bg-primary-container hover:bg-primary text-on-primary px-3 py-1.5 rounded font-body-sm text-body-sm font-medium shadow-sm transition-colors duration-150">
                            <span>Resolve</span>
                          </Link>
                        ) : (
                          <button className="inline-flex items-center gap-1 bg-surface-container hover:bg-surface-container-high text-on-surface px-3 py-1.5 rounded font-body-sm text-body-sm font-medium shadow-sm transition-colors duration-150" disabled>
                            <span>View</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-space-lg py-space-md bg-surface-container-lowest flex items-center justify-between">
            <span className="font-code-sm text-code-sm text-outline">Displaying {all_budget_lines.length} total ledger lines</span>
            <div className="flex items-center gap-space-sm">
              <button className="px-space-md py-1 rounded bg-surface-container-low text-outline font-body-sm text-body-sm hover:text-on-surface transition-colors" disabled>Previous</button>
              <span className="font-code-sm text-code-sm font-medium text-on-surface">Page 1 / 1</span>
              <button className="px-space-md py-1 rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm hover:bg-surface-container transition-colors">Next</button>
            </div>
          </div>
        </div>

        <RechartsChart />
      </div>
    </Shell>
  );
}
