"use client";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, apiFetch } from "@/lib/api";
import { trackEvent } from '@enter-pro/analytics-sdk';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userName] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem("budgetiq_actor_name");
    return stored ? `${stored.toLowerCase().replace(/\s+/g, ".")}@enterprise.com` : "";
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const response = await apiFetch(`${API}/onboarding/data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_name: fd.get("org_name") || "My Organization",
          fiscal_year: fd.get("financial_year") || "FY 2025",
          currency: fd.get("base_currency") || "INR",
          departments: [],
          budget_lines: []
        })
      });
      if (!response.ok) {
        throw new Error("Workspace setup could not be saved.");
      }
      trackEvent('onboarding_step_completed', { eventType: 'conversion', properties: { step: 'workspace' } });
      navigate("/onboarding/data");
    } catch (error) {
      setLoading(false);
      window.alert(error instanceof Error ? error.message : "Workspace setup could not be saved.");
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
            <span className="font-medium text-slate-600">Enterprise security controls</span>
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
            {/* Category Pill / Product Subtitle */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-100 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 font-mono">Finance Intelligence</span>
            </div>

            {/* Primary Heading */}
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-950 leading-tight">
              Set up your finance workspace
            </h1>

            {/* Supporting text */}
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              Create your workspace to start monitoring budget allocation, spending patterns, and financial priorities.
            </p>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Start turning financial signals into clear, explainable allocation decisions across every departmental cost pool.
            </p>

            {/* Subtle 3-Step Progress Indicator */}
            <div className="mt-10 pt-8 border-t border-slate-200">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium mb-4">
                Setup Progress
              </div>

              <div className="flex items-center space-x-3 select-none">
                {/* Step 1: Active */}
                <div className="flex items-center space-x-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold font-mono shadow-sm">
                    1
                  </span>
                  <span className="text-sm font-semibold text-slate-900 tracking-tight">Workspace</span>
                </div>

                {/* Divider */}
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Step 2: Inactive */}
                <div className="flex items-center space-x-2.5 opacity-60">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-medium font-mono">
                    2
                  </span>
                  <span className="text-sm font-medium text-slate-600">Data</span>
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

            {/* Enterprise Governance Callout Card */}
            <div className="mt-10 p-4 rounded-lg bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 p-1 rounded bg-slate-100 text-slate-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wide font-mono">Enterprise Isolation Model</h2>
                  <p className="mt-1 text-xs text-slate-500 leading-normal">
                    Workspace initialization saves organization details and establishes the tenant boundary for this deployment.
                  </p>
                </div>
              </div>
            </div>

            {/* Next Milestones Preview */}
            <div className="mt-6 pl-1 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                <span>Next: Step 2 · Manual budget-line setup</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                <span>Followed by: Step 3 &middot; Configure Financial Policies</span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Create Workspace Card */}
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 sm:p-10">
              {/* Card Header */}
              <div className="border-b border-slate-100 pb-6 mb-7">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Create your workspace
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  Tell us a few details about your organization.
                </p>
              </div>

              {/* Form Grid */}
              <form className="space-y-8" onSubmit={handleSubmit}>
                {/* Company Name */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="company-name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono">
                      Company Name <span className="text-blue-600 font-sans text-sm">*</span>
                    </label>
                    <span className="text-xs text-slate-400">Required</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      id="company-name"
                      name="company_name"
                      placeholder="Enter company name"
                      defaultValue="Acme Technologies Inc."
                      className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors placeholder:text-slate-400"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-emerald-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">Will be used to identify your organization across audit provenance trails.</p>
                </div>

                {/* Two-Column Fields: Industry & Company Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Industry Dropdown */}
                  <div>
                    <label htmlFor="industry" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-2">
                      Industry <span className="text-blue-600 font-sans text-sm">*</span>
                    </label>
                    <select
                      id="industry"
                      name="industry"
                      defaultValue="saas"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors cursor-pointer"
                      style={{
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='1.75'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                        backgroundPosition: "right 14px center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "16px 16px",
                        appearance: "none",
                      }}
                    >
                      <option value="" disabled>Select industry</option>
                      <option value="saas">SaaS / Technology</option>
                      <option value="fin_services">Financial Services</option>
                      <option value="retail">Retail</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="prof_services">Professional Services</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Company Size Dropdown */}
                  <div>
                    <label htmlFor="company-size" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-2">
                      Company Size <span className="text-blue-600 font-sans text-sm">*</span>
                    </label>
                    <select
                      id="company-size"
                      name="company_size"
                      defaultValue="201-500"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors cursor-pointer"
                      style={{
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='1.75'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                        backgroundPosition: "right 14px center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "16px 16px",
                        appearance: "none",
                      }}
                    >
                      <option value="" disabled>Select employees</option>
                      <option value="1-50">1 - 50</option>
                      <option value="51-200">51 - 200</option>
                      <option value="201-500">201 - 500</option>
                      <option value="501-1000">501 - 1,000</option>
                      <option value="1001-5000">1,001 - 5,000</option>
                      <option value="5000+">5,000+</option>
                    </select>
                  </div>
                </div>

                {/* Three-Column Fields: Base Currency, Financial Year, Current Planning Period */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  {/* Base Currency */}
                  <div>
                    <label htmlFor="base-currency" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-2">
                      Base Currency <span className="text-blue-600 font-sans text-sm">*</span>
                    </label>
                    <select
                      id="base-currency"
                      name="base_currency"
                      defaultValue="INR"
                      className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors cursor-pointer"
                      style={{
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='1.75'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                        backgroundPosition: "right 14px center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "16px 16px",
                        appearance: "none",
                      }}
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  {/* Financial Year */}
                  <div>
                    <label htmlFor="financial-year" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-2">
                      Financial Year <span className="text-blue-600 font-sans text-sm">*</span>
                    </label>
                    <select
                      id="financial-year"
                      name="financial_year"
                      defaultValue="apr-mar"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors cursor-pointer"
                      style={{
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='1.75'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                        backgroundPosition: "right 14px center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "16px 16px",
                        appearance: "none",
                      }}
                    >
                      <option value="apr-mar">April &ndash; March</option>
                      <option value="jan-dec">January &ndash; December</option>
                    </select>
                  </div>

                  {/* Current Planning Period */}
                  <div>
                    <label htmlFor="planning-period" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono mb-2">
                      Period <span className="text-blue-600 font-sans text-sm">*</span>
                    </label>
                    <select
                      id="planning-period"
                      name="planning_period"
                      defaultValue="Q3"
                      className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-colors cursor-pointer"
                      style={{
                        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='1.75'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                        backgroundPosition: "right 14px center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "16px 16px",
                        appearance: "none",
                      }}
                    >
                      <option value="Q1">Q1</option>
                      <option value="Q2">Q2</option>
                      <option value="Q3">Q3</option>
                      <option value="Q4">Q4</option>
                    </select>
                  </div>
                </div>

                {/* Privacy / Security Note Banner */}
                <div className="pt-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-2.5 text-xs text-slate-600">
                    <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>Your financial data remains under your organization&apos;s control.</span>
                  </div>
                </div>

                {/* Action Area: Primary Button & Secondary Subtle Link */}
                <div className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={loading}
                    className="order-1 sm:order-2 inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-blue-600/40 cursor-pointer disabled:opacity-50"
                  >
                    <span>{loading ? "Saving..." : "Continue"}</span>
                    {!loading && <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>}
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
          <span>Data source: manual and CSV ingestion</span>
        </div>
        <div className="text-[11px] text-slate-400">
          &copy; 2025 BudgetIQ Systems Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
