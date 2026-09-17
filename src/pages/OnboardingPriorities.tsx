import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function OnboardingPrioritiesPage() {
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
      await fetch("http://localhost:8000/api/onboarding/priorities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_priorities: [] }) // MVP stub
      });
      navigate("/onboarding/policies");
    } catch {
      navigate("/onboarding/policies");
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
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 font-mono">Engine Calibration</span>
            </div>

            {/* Primary Heading */}
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-950 leading-tight">
              Define your priorities
            </h1>

            {/* Supporting text */}
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Tell the deterministic engine what matters most to your company this quarter so it can score reallocation opportunities accurately.
            </p>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              These heuristic weights resolve conflicts when multiple departments request budget increases, ensuring capital flows to the highest-ROI initiatives.
            </p>

            {/* 4-Step Progress Indicator */}
            <div className="mt-10 pt-8 border-t border-slate-200">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium mb-4">
                Setup Progress
              </div>

              <div className="flex flex-wrap items-center gap-3 select-none">
                {/* Step 1: Completed */}
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shadow-sm shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm font-semibold text-slate-600 tracking-tight line-through opacity-70 hidden sm:block">Workspace</span>
                </div>

                {/* Divider */}
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Step 2: Completed */}
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shadow-sm shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm font-semibold text-slate-600 tracking-tight line-through opacity-70 hidden sm:block">Data</span>
                </div>

                {/* Divider */}
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Step 3: Active */}
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold font-mono shadow-sm shrink-0">
                    3
                  </span>
                  <span className="text-sm font-bold text-slate-900 tracking-tight hidden sm:block">Priorities</span>
                </div>

                {/* Divider */}
                <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Step 4: Inactive */}
                <div className="flex items-center space-x-2.5 opacity-60">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-medium font-mono shrink-0">
                    4
                  </span>
                  <span className="text-sm font-medium text-slate-600 hidden sm:block">Policies</span>
                </div>
              </div>
            </div>

            {/* Enterprise Governance Callout Card */}
            <div className="mt-10 p-4 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 p-1 rounded bg-slate-100 text-blue-600">
                  <span className="material-symbols-outlined text-[16px]">balance</span>
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wide font-mono">Dynamic Calibration Matrix</h2>
                  <p className="mt-1 text-xs text-slate-500 leading-normal">
                    These weights act as parameters for Qwen-2.5 during the Reallocation Engine's analysis phase. You can rebalance these anytime in System Settings as quarterly OKRs shift.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Next Milestones Preview */}
            <div className="mt-6 pl-1 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                <span>Next: Step 4 &middot; Configure Financial Policies</span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Priorities Card */}
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 sm:p-10">
              
              <div className="border-b border-slate-100 pb-5 mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Strategic Weighting
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Drag the sliders to reflect your organization's current focus. The engine will normalize these to 100%.
                </p>
              </div>

              {/* Slider Grid */}
              <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                
                {/* 1. ARR & Revenue Influence */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <label className="block text-sm font-bold text-slate-900">ARR &amp; Revenue Influence</label>
                      <span className="text-xs text-slate-500">Prioritize investments tied to direct sales inflow.</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded text-blue-700 font-mono text-sm font-semibold">
                      40%
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="100" defaultValue="40" 
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* 2. Strategic OKR Alignment */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <label className="block text-sm font-bold text-slate-900">Strategic OKR Alignment</label>
                      <span className="text-xs text-slate-500">Prioritize cross-functional executive roadmap key results.</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded text-blue-700 font-mono text-sm font-semibold">
                      35%
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="100" defaultValue="35" 
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* 3. Cost Efficiency & Margin Yield */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <label className="block text-sm font-bold text-slate-900">Cost Efficiency &amp; Margin Yield</label>
                      <span className="text-xs text-slate-500">Prioritize normalized COGS / Opex ratio improvements.</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded text-blue-700 font-mono text-sm font-semibold">
                      25%
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="100" defaultValue="25" 
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Micro-reallocation floor */}
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-2">
                    Capital Inflow Threshold
                  </label>
                  <p className="text-xs text-slate-500 mb-3">Ignore micro-reallocations below this threshold to reduce executive friction.</p>
                  <div className="relative max-w-xs">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                      ₹
                    </div>
                    <input
                      type="text"
                      defaultValue="1,00,000"
                      className="w-full pl-7 pr-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors"
                    />
                  </div>
                </div>

                {/* Action Area */}
                <div className="pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={loading}
                    className="order-1 sm:order-2 inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-blue-600/40 cursor-pointer disabled:opacity-50"
                  >
                    <span>{loading ? "Saving..." : "Continue to Policies"}</span>
                    {!loading && <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>}
                  </button>

                  <button 
                    type="button" 
                    className="order-2 sm:order-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors text-center sm:text-left py-1 cursor-pointer"
                  >
                    Use standard enterprise baseline
                  </button>
                </div>
              </form>

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
