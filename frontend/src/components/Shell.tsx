"use client";
import Link from "next/link";
import { ReactNode, useState, useEffect } from "react";

interface ShellProps {
  children: ReactNode;
  activePath?: string;
}

export function Shell({ children, activePath = "dashboard" }: ShellProps) {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  
  useEffect(() => {
    setUserName(localStorage.getItem("actor_name") || "Alex Rivera");
    setUserRole(localStorage.getItem("actor_role") || "VP Finance");
  }, []);

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
              href="/dashboard"
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
              href="/recommendations"
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
              href="/approvals"
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
              href="/signals"
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
              href="/reports"
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
              href="/audit"
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
              href="/settings"
              className={`flex items-center gap-space-md px-space-lg py-space-sm transition-colors duration-150 ${
                activePath === "settings"
                  ? "text-primary-container font-medium border-l-2 border-primary-container bg-surface-container-low"
                  : "font-body-md text-body-md text-outline hover:text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>Settings</span>
            </Link>
          </nav>
        </div>
        {/* Footer status */}
        <div className="p-space-md border-t border-outline-variant">
          <div className="flex items-center justify-between px-space-sm py-space-xs text-outline">
            <span className="font-code-sm text-code-sm uppercase">FY25 Q3 Active</span>
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
                onClick={() => {
                  const newName = prompt("Set user name:", userName);
                  if (newName) {
                    localStorage.setItem("actor_name", newName);
                    setUserName(newName);
                  }
                  const newRole = prompt("Set user role (e.g. VP Finance, CFO):", userRole);
                  if (newRole) {
                    localStorage.setItem("actor_role", newRole);
                    setUserRole(newRole);
                  }
                }}
                title="Click to change user profile"
              >
                {userName}
              </span>
              <span className="font-code-sm text-code-sm text-outline mt-0.5">{userRole} &middot; Core Ops</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-headline-md text-[13px] tracking-tight">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
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
