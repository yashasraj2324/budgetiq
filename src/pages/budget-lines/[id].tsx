"use client";

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { API, apiFetch, apiError } from "@/lib/api";
import { trackEvent } from '@enter-pro/analytics-sdk';
import { formatMoney, currencySymbol, useOrgCurrency } from "@/lib/format";

interface Detail {
  id: number;
  name: string;
  department_name: string;
  allocated_amount: number;
  remaining_budget: number;
  category: string;
  priority_weight: number;
  spend_entries: { period: string; amount_spent: number }[];
  anomaly?: { velocity_multiplier: number; recent_rate: number; baseline_rate: number } | null;
}

export default function BudgetLineDetailPage() {
  const params = useParams<{ id: string }>();
  const { currency } = useOrgCurrency();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [spendPeriod, setSpendPeriod] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [spendError, setSpendError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch(`${API}/budget-lines/${params.id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiError(response, "Unable to load budget line"));
        setDetail(await response.json());
      })
      .catch((reason: Error) => setError(reason.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const addSpend = async (event: React.FormEvent) => {
    event.preventDefault();
    setSpendError("");
    const amount = Number(spendAmount);
    if (!spendPeriod.trim()) {
      setSpendError("Period is required (e.g. FY25-Q2).");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setSpendError("Amount must be a non-negative number.");
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch(`${API}/budget-lines/${params.id}/spend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: spendPeriod.trim(), amount_spent: amount }),
      });
      if (!response.ok) throw new Error(await apiError(response, "Unable to record spend"));
      setSpendPeriod("");
      setSpendAmount("");
      trackEvent('spend_entry_added', { eventType: 'custom', properties: { amount } });
      load();
    } catch (reason) {
      setSpendError(reason instanceof Error ? reason.message : "Unable to record spend");
    } finally {
      setSaving(false);
    }
  };

  const money = (value: number) => formatMoney(value, currency);

  return (
    <Shell activePath="dashboard">
      <div className="max-w-4xl mx-auto w-full space-y-space-lg">
        <Link to="/dashboard" className="text-primary font-medium hover:underline">← Back to dashboard</Link>
        {error && <p role="alert" className="text-error">{error}</p>}
        {!detail && !error && <p className="text-outline">Loading budget line…</p>}
        {detail && (
          <>
            <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg">
              <p className="text-sm text-outline">{detail.department_name} · {detail.category}</p>
              <h1 className="font-headline-lg text-on-surface">{detail.name}</h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md mt-space-lg">
                <div><p className="text-xs text-outline">Allocated</p><p className="font-semibold">{money(detail.allocated_amount)}</p></div>
                <div><p className="text-xs text-outline">Remaining</p><p className="font-semibold">{money(detail.remaining_budget)}</p></div>
                <div><p className="text-xs text-outline">Priority</p><p className="font-semibold">{detail.priority_weight}/100</p></div>
                <div><p className="text-xs text-outline">Status</p><p className="font-semibold">{detail.anomaly ? "Anomaly" : "Normal"}</p></div>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg">
              <h2 className="font-headline-md text-on-surface mb-space-md">Spend history</h2>
              {detail.spend_entries.length === 0 ? <p className="text-outline">No spend entries recorded.</p> : (
                <div className="space-y-2">{detail.spend_entries.map((entry) => (
                  <div key={entry.period} className="flex justify-between border-b border-outline-variant py-2">
                    <span>{entry.period}</span><span className="font-semibold">{money(entry.amount_spent)}</span>
                  </div>
                ))}</div>
              )}
              <form onSubmit={addSpend} className="mt-space-md rounded-lg border border-outline-variant p-space-md space-y-space-sm">
                <h3 className="font-semibold text-on-surface text-sm">Add spend entry</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                  <label className="text-sm text-on-surface-variant">
                    Period
                    <input
                      value={spendPeriod}
                      onChange={(event) => setSpendPeriod(event.target.value)}
                      placeholder="FY25-Q2"
                      className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface text-on-surface"
                      required
                    />
                  </label>
                  <label className="text-sm text-on-surface-variant">
                    Amount spent ({currencySymbol(currency)})
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={spendAmount}
                      onChange={(event) => setSpendAmount(event.target.value)}
                      className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface text-on-surface"
                      required
                    />
                  </label>
                </div>
                {spendError && <p className="text-sm text-error" role="alert">{spendError}</p>}
                <button type="submit" disabled={saving} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
                  {saving ? "Saving…" : "Add spend"}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
