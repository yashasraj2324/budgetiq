"use client";
import { Link, useNavigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { API, apiFetch } from "@/lib/api";

interface ShellProps {
  children: ReactNode;
  activePath?: string;
}

function currentPeriodLabel(calendar: { fiscal_year_start_month?: number; period_type?: string; period_labels?: string[] }): string {
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

export function Shell({ children, activePath = "dashboard" }: ShellProps) {
  const navigate = useNavigate();
  const [userName] = useState(() => typeof window === "undefined" ? "BudgetIQ user" : sessionStorage.getItem("budgetiq_actor_name") || "BudgetIQ user");
  const [userRole] = useState(() => import.meta.env.VITE_AUTH_MODE === "dev" ? "Local developer" : "Authenticated user");
  const [period, setPeriod] = useState<{ fiscal_year: string; label: string }>({ fiscal_year: "FY25", label: "Q3" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [configRes, calendarRes] = await Promise.all([
        apiFetch(`${API}/onboarding/config`).catch(() => null),
        apiFetch(`${API}/organization/fiscal-calendar`).catch(() => null),
      ]);
      if (cancelled) return;
      const config = configRes?.ok ? await configRes.json() : {};
      const calendar = calendarRes?.ok ? await calendarRes.json() : {};
      setPeriod({ fiscal_year: String(config.fiscal_year ?? "FY25"), label: currentPeriodLabel(calendar) });
    })();
    return () => { cancelled = true; };
  }, []);

  const signOut = () => {
    sessionStorage.removeItem("budgetiq_access_token");
    sessionStorage.removeItem("budgetiq_actor_name");
    sessionStorage.removeItem("budgetiq_remember_session");
    navigate("/");
  };

  return (
    <div className="flex h-screen w-full bg-background font-body-md text-on-surface antialiased overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 h-screen w-[240px] bg-surface-container-lowest border-r border-outline-variant z-30 flex flex-col justify-between select-none">
        <div className="flex flex-col">
          {/* Logo */}
          <div className="h-14 flex items-center px-space-lg border-b border-outline-variant">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-md text-headline-md text-on-surface tracking-tight">BudgetIQ</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container mt-1"></span>
            </div>
          </div>
          {/* Workspace label */}
          <div className="px-space-md py-space-sm">
            <span className="font-label-caps text-label-caps uppercase text-outline px-space-sm py-space-xs block">Workspace</span>
          </div>
          {/* Nav */}
          <nav className="flex flex-col">
            <Link
              to="/dashboard"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "dashboard"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
              <span>Dashboard</span>
            </Link>
            <Link
              to="/recommendations"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "recommendations"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">insights</span>
              <span>Recommendations</span>
            </Link>
            <Link
              to="/approvals"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "approvals"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">task_alt</span>
              <span>Approvals</span>
            </Link>
            <Link
              to="/signals"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "signals"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">crisis_alert</span>
              <span>Signals</span>
            </Link>
            <Link
              to="/reports"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "reports"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              <span>Reports</span>
            </Link>
            <Link
              to="/audit"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "audit"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              <span>Audit Log</span>
            </Link>
            <Link
              to="/scenarios"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "scenarios"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">bookmarks</span>
              <span>Scenarios</span>
            </Link>
            <Link
              to="/settings"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "settings"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>Settings</span>
            </Link>
            <Link
              to="/governance"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "governance"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">gavel</span>
              <span>Governance</span>
            </Link>
            <Link
              to="/integrations"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "integrations"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">cable</span>
              <span>Integrations</span>
            </Link>
          </nav>
        </div>
        {/* Footer status */}
        <div className="p-space-md border-t border-outline-variant">
          <div className="flex items-center justify-between px-space-sm py-space-xs text-outline">
            <span className="font-code-sm text-code-sm uppercase">{period.fiscal_year} {period.label} Active</span>
            <span className="w-2 h-2 rounded-full bg-secondary-container"></span>
          </div>
        </div>
      </aside>

      {/* ── Main shell ── */}
      <div className="flex-1 pl-[240px] flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-14 bg-surface-container-lowest border-b border-outline-variant z-20 flex items-center justify-between px-space-xl shrink-0">
          <div className="flex items-center gap-space-md">
            <span className="material-symbols-outlined text-outline text-[20px]">account_balance</span>
            <span className="font-code-sm text-code-sm uppercase text-outline">FP&amp;A Ledger Engine</span>
          </div>
          <div className="flex items-center gap-space-lg">
            <div className="hidden md:flex flex-col text-right">
              <span 
                className="font-body-md text-body-md font-semibold text-on-surface leading-none cursor-pointer hover:text-blue-600 transition-colors"
                title="Authenticated session"
              >
                {userName}
              </span>
              <span className="font-code-sm text-code-sm text-outline mt-0.5">{userRole} &middot; Core Ops</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-headline-md text-[13px] tracking-tight">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="flex items-center gap-1 px-space-md py-1.5 rounded bg-surface-container-low text-outline hover:bg-surface-container hover:text-on-surface transition-colors font-body-sm text-body-sm font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span className="hidden lg:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto bg-background px-space-xl py-space-xl">
          {children}
        </main>
      </div>
    </div>
  );
}
