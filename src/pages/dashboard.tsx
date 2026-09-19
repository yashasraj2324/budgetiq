"use client";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { RechartsChart } from "@/components/RechartsChart";
import { Shell } from "@/components/Shell";
import { API, apiError, apiFetch } from "@/lib/api";
import { formatCompact, formatMoney } from "@/lib/format";

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
  departments?: { id: number; name: string; budget_lines: Omit<BudgetLineRow, 'department_name'>[] }[];
  budget_lines?: BudgetLineRow[];
  pagination?: { page: number; page_size: number; total: number; pages: number };
  scenario?: string;
}

interface OrgConfig {
  org_name?: string;
  fiscal_year?: string;
  currency?: string;
}

interface FiscalCalendar {
  fiscal_year_start_month?: number;
  period_type?: string;
  period_labels?: string[];
}

function currentPeriodLabel(calendar: FiscalCalendar): string {
  const start = Number(calendar.fiscal_year_start_month) || 4;
  const now = new Date();
  const month = now.getMonth() + 1;
  const idx = ((month - start) + 12) % 12;
  const type = calendar.period_type ?? "quarterly";
  if (type === "monthly") {
    const labels = calendar.period_labels?.length === 12
      ? calendar.period_labels
      : ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    return labels[idx] ?? `M${idx + 1}`;
  }
  const quarter = Math.floor(idx / 3);
  const labels = calendar.period_labels?.length ? calendar.period_labels : ["Q1", "Q2", "Q3", "Q4"];
  return labels[quarter] ?? `Q${quarter + 1}`;
}

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [anomalies, setAnomalies] = useState<{ budget_line_id: number }[]>([]);
  const [syncedAt, setSyncedAt] = useState("—");
  const [error, setError] = useState("");
  const [config, setConfig] = useState<OrgConfig>({});
  const [calendar, setCalendar] = useState<FiscalCalendar>({});
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [configRes, calendarRes] = await Promise.all([
        apiFetch(`${API}/onboarding/config`).catch(() => null),
        apiFetch(`${API}/organization/fiscal-calendar`).catch(() => null),
      ]);
      if (cancelled) return;
      if (configRes?.ok) setConfig(await configRes.json());
      if (calendarRes?.ok) setCalendar(await calendarRes.json());
    })();
    return () => { cancelled = true; };
  }, []);

  const params = {
    department_id: searchParams.get("department_id") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    scenario: searchParams.get("scenario") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    page_size: searchParams.get("page_size") ?? undefined,
  };
  const query = new URLSearchParams();
  if (params.department_id) query.set("department_id", params.department_id);
  if (params.category && !["over-allocated", "variance", "scenario"].includes(params.category)) {
    query.set("category", params.category);
  }
  if (params.search) query.set("search", params.search);
  if (params.scenario) query.set("scenario", params.scenario);
  if (params.page) query.set("page", params.page);
  if (params.page_size) query.set("page_size", params.page_size);
  const queryString = query.toString();

  useEffect(() => {
    let cancelled = false;
    setError("");
    (async () => {
      try {
        const res = await apiFetch(`${API}/dashboard${queryString ? `?${queryString}` : ""}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(await apiError(res, "Unable to load dashboard"));
          return;
        }
        setData(await res.json());
        setSyncedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        const res2 = await apiFetch(`${API}/anomalies`);
        if (!cancelled && res2.ok) setAnomalies(await res2.json());
      } catch {
        if (!cancelled) setError("Unable to reach the BudgetIQ API.");
      }
    })();
    return () => { cancelled = true; };
  }, [queryString]);

  const formatCurrency = (val: number) => formatCompact(val, currency);
  const formatINR = (val: number) => formatMoney(val, currency);
  const orgName = config.org_name?.trim() || "Executive Portfolio Ledger";
  const fiscalYear = config.fiscal_year?.trim() || "FY25";
  const currency = config.currency?.trim() || "INR";
  const periodLabel = currentPeriodLabel(calendar);

  const applySearch = () => {
    const q = new URLSearchParams(searchParams.toString());
    if (searchInput.trim()) q.set("search", searchInput.trim());
    else q.delete("search");
    navigate(`/dashboard${q.toString() ? `?${q.toString()}` : ""}`);
  };

  if (error) {
    return (
      <Shell activePath="dashboard">
        <div className="flex items-center justify-center h-full">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-xl text-center max-w-md">
            <p className="font-headline-md text-on-surface">Dashboard unavailable</p>
            <p className="font-body-sm text-on-surface-variant mt-2">{error}</p>
          </div>
        </div>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell activePath="dashboard">
        <div className="flex flex-col w-full gap-space-xl" aria-busy="true" aria-label="Loading dashboard">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest p-space-lg rounded shadow-sm h-32 animate-pulse" />
            ))}
          </div>
          <div className="bg-surface-container-lowest rounded shadow-sm h-72 animate-pulse" />
        </div>
      </Shell>
    );
  }

  let all_budget_lines: BudgetLineRow[] = [];
  if (data.budget_lines) {
    all_budget_lines = data.budget_lines;
  } else if (data && data.departments) {
    data.departments.forEach((d) => {
      d.budget_lines.forEach((bl) => {
        all_budget_lines.push({ ...bl, department_name: d.name });
      });
    });
  }
  if (!data.pagination && params.category === "over-allocated") {
    all_budget_lines = all_budget_lines.filter((line) => line.remaining_budget < 0);
  } else if (!data.pagination && params.category === "variance") {
    all_budget_lines = all_budget_lines.filter((line) => {
      const spent = line.allocated_amount - line.remaining_budget;
      return line.allocated_amount > 0 && Math.abs(spent / line.allocated_amount - 1) > 0.05;
    });
  }


  return (
    <Shell activePath="dashboard">
      <div className="flex flex-col w-full gap-space-xl">
        {/* Top Meta & Quick Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-space-sm">
              <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{orgName}</span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm uppercase">{periodLabel} Live Sync</span>
              <span className="text-xs text-outline font-medium">Last synced: {syncedAt}</span>
            </div>
            <p className="font-body-sm text-body-sm text-outline">Real-time ledger audit trail across {data.departments?.length ?? 0} operating departments.</p>
          </div>
          <div className="flex items-center gap-space-sm">
            <div className="flex items-center bg-surface-container-lowest px-space-md py-1 rounded shadow-sm gap-space-xs text-outline">
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              <span className="font-code-sm text-code-sm text-on-surface">{fiscalYear} &middot; {periodLabel}</span>
            </div>
            <Link to="/scenarios" className="flex items-center gap-space-xs px-space-md py-1 bg-surface-container-lowest text-outline font-body-sm text-body-sm rounded shadow-sm transition-colors duration-150">
              <span className="material-symbols-outlined text-[16px] text-outline">tune</span>
              <span>Saved Scenarios</span>
            </Link>
            <form
              onSubmit={(event) => { event.preventDefault(); applySearch(); }}
              className="flex items-center gap-space-xs px-space-md py-1 bg-surface-container-lowest text-outline font-body-sm text-body-sm rounded shadow-sm border border-outline-variant"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">search</span>
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search lines…"
                className="bg-transparent outline-none text-on-surface w-36"
              />
            </form>
            <a href={`${API}/dashboard/export.csv${queryString ? `?${queryString}` : ""}`} className="flex items-center gap-space-xs px-space-md py-1 bg-surface-container-low text-outline font-body-sm text-body-sm font-medium rounded shadow-sm transition-colors duration-150">
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Metric Bento Cards — 4 dedicated cards per FR-001 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">

          {/* Card 1: Total Budget */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-caps text-label-caps uppercase text-outline">Total Allocated</span>
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-container/15 text-primary"><span className="material-symbols-outlined text-[18px]">account_balance_wallet</span></span>
            </div>
            <div className="my-space-md">
              <div className="font-numeric-metric-lg text-numeric-metric-lg text-on-surface tracking-tight font-semibold">
                {formatCurrency(data.total_budget)}
              </div>
              <div className="font-code-sm text-code-sm text-outline mt-1">{currency} &middot; {fiscalYear} {periodLabel}</div>
            </div>
            <div className="pt-space-sm text-right">
              <span className="font-code-sm text-code-sm text-outline">Fiscal envelope</span>
            </div>
          </div>

          {/* Card 2: Total Remaining */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-caps text-label-caps uppercase text-outline">Total Remaining</span>
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary"><span className="material-symbols-outlined text-[18px]">savings</span></span>
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
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-caps text-label-caps uppercase text-outline">Reallocatable</span>
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-success-container text-success"><span className="material-symbols-outlined text-[18px]">swap_horiz</span></span>
            </div>
            <div className="my-space-md">
              <div className="font-numeric-metric-lg text-numeric-metric-lg text-success tracking-tight font-semibold">
                {formatINR(data.reallocatable)}
              </div>
              <div className="font-code-sm text-code-sm text-outline mt-1">After reserves &amp; future spend</div>
            </div>
            <div className="pt-space-sm flex items-center justify-between">
              <span className="font-code-sm text-code-sm text-outline">Transferable surplus</span>
              <Link to="/recommendations" className="font-code-sm text-code-sm text-success font-medium hover:underline">Generate &rarr;</Link>
            </div>
          </div>

          {/* Card 4: Pending + Anomalies */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="font-label-caps text-label-caps uppercase text-outline">Pending Reviews</span>
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary-fixed/40 text-secondary"><span className="material-symbols-outlined text-[18px]">verified_user</span></span>
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
        <div className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-space-lg bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-space-sm">
                <span className="font-headline-md text-headline-md text-on-surface">Budget Lines</span>
                <span className="px-2 py-0.5 rounded bg-surface-container-low text-outline font-code-sm text-code-sm">{all_budget_lines.length} Active Feeds</span>
              </div>
              <span className="font-body-sm text-body-sm text-outline">Fiscal {fiscalYear} &middot; {periodLabel} Department Breakdown</span>
            </div>
            <div className="flex items-center gap-space-xs bg-surface-container-low p-0.5 rounded">
              <Link to="/dashboard" className="px-space-md py-1 rounded bg-surface-container-lowest shadow-sm font-body-sm text-body-sm font-medium text-outline">All Departments</Link>
              <Link to="/dashboard?category=over-allocated" className="px-space-md py-1 rounded text-outline font-body-sm text-body-sm transition-colors">Over-allocated</Link>
              <Link to="/dashboard?category=variance" className="px-space-md py-1 rounded text-outline font-body-sm text-body-sm transition-colors">Variance &gt; 5%</Link>
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
                  const hasAnomaly = (anomalies as { budget_line_id: number }[]).some(a => a.budget_line_id === line.id);
                  
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
                        <Link to={`/budget-lines/${line.id}`} className="inline-flex items-center gap-1 bg-surface-container text-outline px-3 py-1.5 rounded font-body-sm text-body-sm font-medium transition-colors duration-150">
                          <span>View</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          <div className="px-space-lg py-space-md bg-surface-container-lowest flex items-center justify-between">
            <span className="font-code-sm text-code-sm text-outline">Displaying {all_budget_lines.length}{data.pagination ? ` of ${data.pagination.total}` : ""} ledger lines</span>
            <div className="flex items-center gap-space-sm">
              {(() => {
                const current = data.pagination?.page ?? 1;
                const pages = data.pagination?.pages ?? 1;
                const base = (p: number) => {
                  const q = new URLSearchParams(searchParams.toString());
                  q.set("page", String(p));
                  return `/dashboard?${q.toString()}`;
                };
                return <>
                  <Link to={base(Math.max(1, current - 1))} className={`px-space-md py-1 rounded bg-surface-container-low text-outline font-body-sm text-body-sm ${current <= 1 ? "pointer-events-none opacity-50" : ""}`}>Previous</Link>
                  <span className="font-code-sm text-code-sm font-medium text-on-surface">Page {current} / {pages}</span>
                  <Link to={base(Math.min(pages, current + 1))} className={`px-space-md py-1 rounded bg-surface-container-low text-outline font-body-sm text-body-sm ${current >= pages ? "pointer-events-none opacity-50" : ""}`}>Next</Link>
                </>;
              })()}
            </div>
          </div>
        </div>

        

        <RechartsChart />
      </div>
    </Shell>
  );
}
