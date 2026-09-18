"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { API, apiFetch, apiError } from "@/lib/api";

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
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`${API}/budget-lines/${params.id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiError(response, "Unable to load budget line"));
        setDetail(await response.json());
      })
      .catch((reason: Error) => setError(reason.message));
  }, [params.id]);

  const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <Shell activePath="dashboard">
      <div className="max-w-4xl mx-auto w-full space-y-space-lg">
        <Link href="/dashboard" className="text-primary font-medium hover:underline">← Back to dashboard</Link>
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
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
