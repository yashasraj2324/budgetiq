"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OnboardingDataPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  
  useEffect(() => {
    const stored = localStorage.getItem("actor_name");
    if (stored) {
      setUserName(`${stored.toLowerCase().replace(/\s+/g, ".")}@enterprise.com`);
    }
  }, []);

  const handleContinue = async () => {
    setLoading(true);
    // In a real app we'd capture connected sources. For MVP, we just ping the endpoint to verify wiring.
    try {
      await fetch("http://localhost:8000/api/onboarding/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_name: "Mock Org", fiscal_year: "Mock", currency: "INR", departments: [], budget_lines: [] })
      });
      router.push("/onboarding/priorities");
    } catch {
      router.push("/onboarding/priorities");
    }
  };

  return (
    <div className="min-h-full min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900" style={{ fontFeatureSettings: "'cv02', 'cv03', 'cv04', 'cv11'" }}>
      {/* Top Enterprise Navigation Header */}
      <header className="w-full bg-white border-b border-slate-200 py-3.5 px-8 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold tracking-tight text-slate-950">BudgetIQ</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"></span>
          </div>
          <span className="text-xs text-slate-400 font-normal">|</span>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-medium">Finance Intelligence Gateway</span>
        </div>

        <div className="hidden md:flex items-center space-x-6 text-xs text-slate-500">
          <div className="flex items-center space-x-1.5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="font-mono">256-Bit Financial Encryption</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-medium text-slate-600">SOC-2 Type II Certified</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-[16px] text-slate-400">person</span>
            <span className="text-slate-500">
              Signed in as <span className="font-medium text-slate-800">{userName}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-12 flex items-center justify-center">
        <div className="w-full grid grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* LEFT SIDE: Onboarding Context & Progress Stepper */}
          <div className="col-span-12 lg:col-span-5 pt-4 pr-0 lg:pr-4">
            {/* Category Pill */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-100 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 font-mono">Data Integration</span>
            </div>

            {/* Primary Heading */}
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-950 leading-tight">
              Connect your data
            </h1>

            {/* Supporting text */}
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Link your General Ledger, ERP systems, or upload static CSV exports to establish the baseline for deterministic anomaly detection.
            </p>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              BudgetIQ needs historical budget vs. actuals (BvA) and real-time ledger data to accurately map your departmental cost pools.
            </p>

            {/* 3-Step Progress Indicator */}
            <div className="mt-10 pt-8 border-t border-slate-200">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium mb-4">
                Setup Progress
              </div>

              <div className="flex items-center space-x-3 select-none">
                {/* Step 1: Completed */}
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm font-semibold text-slate-600 tracking-tight line-through opacity-70">Workspace</span>
                </div>

                {/* Divider */}
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Step 2: Active */}
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold font-mono shadow-sm">
                    2
                  </span>
                  <span className="text-sm font-bold text-slate-900 tracking-tight">Data</span>
                </div>

                {/* Divider */}
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Step 3: Inactive */}
                <div className="flex items-center space-x-2.5 opacity-60">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-medium font-mono">
                    3
                  </span>
                  <span className="text-sm font-medium text-slate-600">Policies</span>
                </div>
              </div>
            </div>

            {/* Trust/Security Callout */}
            <div className="mt-10 p-4 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 p-1 rounded bg-slate-100 text-emerald-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wide font-mono">SOC-2 Read-Only Connectors</h2>
                  <p className="mt-1 text-xs text-slate-500 leading-normal">
                    BudgetIQ integrations use strictly read-only OAuth scopes. We never write back to your source systems without explicit programmatic approval via EnterPro policies.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Data Connections Card */}
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 sm:p-10">
              
              <div className="border-b border-slate-100 pb-5 mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                    Data Sources
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select a connection method to ingest your ledger data.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                  0 connected
                </div>
              </div>

              {/* Data Sources Grid */}
              <div className="space-y-4">
                
                {/* ERP / GL Systems */}
                <div className="group border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                      <span className="material-symbols-outlined text-[20px]">database</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">ERP &amp; General Ledger</h3>
                      <p className="text-xs text-slate-500 mt-1">Direct integration with NetSuite, SAP S/4HANA, Workday Financials, or Microsoft Dynamics.</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">NetSuite</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">SAP</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">+12 more</span>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="shrink-0 px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm bg-white">
                    Connect
                  </button>
                </div>

                {/* FP&A Platforms */}
                <div className="group border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <span className="material-symbols-outlined text-[20px]">donut_small</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">FP&amp;A Planning Tools</h3>
                      <p className="text-xs text-slate-500 mt-1">Import approved budgets and forecasts from Anaplan, Workday Adaptive Planning, or Planful.</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">Anaplan</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">Adaptive</span>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="shrink-0 px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm bg-white">
                    Connect
                  </button>
                </div>

                {/* CSV / Flat File */}
                <div className="group border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer relative overflow-hidden">
                  {/* Subtle active state marker since this is the most common manual onboarding path */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 group-hover:bg-blue-500 transition-colors"></div>
                  
                  <div className="flex items-start gap-4 pl-2">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                      <span className="material-symbols-outlined text-[20px]">upload_file</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Manual CSV / Flat File</h3>
                      <p className="text-xs text-slate-500 mt-1">Upload your GL and Budget vs Actuals (BvA) in standard CSV/XLSX format.</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-100/50 text-amber-700 rounded">Templates Available</span>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="shrink-0 px-4 py-1.5 border border-blue-600 bg-blue-50 rounded text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors shadow-sm">
                    Upload
                  </button>
                </div>

                {/* REST API */}
                <div className="group border border-slate-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                      <span className="material-symbols-outlined text-[20px]">api</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Custom API Ingestion</h3>
                      <p className="text-xs text-slate-500 mt-1">Push ledger entries directly to the BudgetIQ anomaly engine via our SOC-2 certified REST Gateway.</p>
                    </div>
                  </div>
                  <button type="button" className="shrink-0 px-4 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm bg-white">
                    Generate Keys
                  </button>
                </div>

              </div>

              {/* Action Area */}
              <div className="pt-8 mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={loading}
                  className="order-1 sm:order-2 inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-blue-600/40 cursor-pointer disabled:opacity-50"
                >
                  <span>{loading ? "Saving..." : "Continue to Priorities"}</span>
                  {!loading && <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>}
                </button>

                <button 
                  type="button" 
                  className="order-2 sm:order-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors text-center sm:text-left py-1 cursor-pointer"
                >
                  Skip data setup for now
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Enterprise Footer Compliance Strip */}
      <footer className="w-full border-t border-slate-200 bg-white py-3 px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 mt-auto">
        <div className="flex items-center space-x-4 font-mono text-[11px]">
          <span>BudgetIQ Enterprise v4.19</span>
          <span>&middot;</span>
          <span>Deterministic Anomaly Engine</span>
          <span>&middot;</span>
          <span>EnterPro Policy Orchestration Active</span>
        </div>
        <div className="text-[11px] text-slate-400">
          &copy; 2025 BudgetIQ Systems Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
