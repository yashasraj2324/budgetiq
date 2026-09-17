import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function OnboardingPoliciesPage() {
  const navigate = useNavigate();
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
    try {
      await fetch("http://localhost:8000/api/onboarding/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_policies: [] }) // MVP stub
      });
      navigate("/dashboard");
    } catch {
      navigate("/dashboard");
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
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 font-mono">EnterPro Governance</span>
            </div>

            {/* Primary Heading */}
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-950 leading-tight">
              Configure financial policies
            </h1>

            {/* Supporting text */}
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Establish the autonomous governance rules for how BudgetIQ handles anomalies and capital reallocations.
            </p>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Define your multi-tiered approval state machine rules for autonomous vs. human-in-the-loop sign-offs.
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

                {/* Step 2: Completed */}
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm font-semibold text-slate-600 tracking-tight line-through opacity-70">Data</span>
                </div>

                {/* Divider */}
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Step 3: Active */}
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold font-mono shadow-sm">
                    3
                  </span>
                  <span className="text-sm font-bold text-slate-900 tracking-tight">Policies</span>
                </div>
              </div>
            </div>

            {/* Enterprise Governance Callout Card */}
            <div className="mt-10 p-4 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 p-1 rounded bg-slate-100 text-emerald-600">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wide font-mono">Immutable Provenance Logging</h2>
                  <p className="mt-1 text-xs text-slate-500 leading-normal">
                    Even when Auto-Execute is enabled, every AI-driven reallocation is cryptographically signed and logged with a complete 5-step explainability trace for auditor review.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Next Milestones Preview */}
            <div className="mt-6 pl-1 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                <span className="text-slate-800 font-medium">Next: Go to your live dashboard</span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Policies Card */}
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 sm:p-10">
              
              <div className="border-b border-slate-100 pb-5 mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Default Governance Policies
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  You can adjust these thresholds later in System Settings.
                </p>
              </div>

              {/* Policy Toggles Grid */}
              <div className="space-y-4">
                
                {/* Auto-Execute Floor */}
                <div className="border border-slate-200 rounded-lg p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <span className="material-symbols-outlined text-[20px]">bolt</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">Automatic Reallocation Floor</h3>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold">Recommended</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Reallocations below ₹50,000 within the same department are auto-approved if strategic priority delta &gt; 3.0.</p>
                      </div>
                      
                      {/* CSS-only Toggle Switch (Checked by default) */}
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-9 h-5 bg-slate-200 hover:bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Human-in-the-loop Gate */}
                <div className="border border-slate-200 rounded-lg p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <span className="material-symbols-outlined text-[20px]">person_check</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">VP Finance Human-in-the-loop</h3>
                        <p className="text-xs text-slate-500 mt-1">Mandatory review for all cross-department reallocations or any moves between ₹50,000 and ₹1,000,000.</p>
                      </div>
                      
                      {/* CSS-only Toggle Switch (Checked by default) */}
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-9 h-5 bg-slate-200 hover:bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-medium">Default Approver:</span>
                      <span className="text-[10px] font-mono px-2 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        {userName || "Alex Rivera"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dual-Sign Overwrite */}
                <div className="border border-slate-200 rounded-lg p-5 flex items-start gap-4 opacity-80">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                    <span className="material-symbols-outlined text-[20px]">gavel</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">CFO &amp; Board Dual-Sign</h3>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">Locked Rule</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Required for strategic motions exceeding ₹10,00,000 or moves affecting foundational growth reserves.</p>
                      </div>
                      
                      {/* CSS-only Toggle Switch (Checked and Disabled) */}
                      <label className="relative inline-flex items-center cursor-not-allowed shrink-0 mt-1 opacity-70">
                        <input type="checkbox" className="sr-only peer" defaultChecked disabled />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
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
                  <span>{loading ? "Completing Setup..." : "Complete Setup"}</span>
                  {!loading && <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>}
                </button>

                <button 
                  type="button" 
                  className="order-2 sm:order-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors text-center sm:text-left py-1 cursor-pointer"
                >
                  Reset to enterprise defaults
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
