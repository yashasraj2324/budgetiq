"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { API, apiFetch } from "@/lib/api";
import { formatMoney, useOrgCurrency } from "@/lib/format";

interface SpendEntry {
  name: string;
  spend: number;
  anomaly: boolean;
  projected: boolean;
}
interface ForecastPoint { period?: string; amount: number; projected?: boolean; }
interface ForecastResponse { points?: ForecastPoint[]; }
interface AnomalySignal {
  budget_line_id: number;
  budget_line_name: string;
  velocity_multiplier: number;
}
interface BudgetLine { id: number; name: string; allocated_amount: number; }

export function RechartsChart() {
  const { currency } = useOrgCurrency();
  const [data, setData] = useState<SpendEntry[]>([]);
  const [title, setTitle] = useState("Forecasted Burn Velocity");
  const [narrative, setNarrative] = useState("Loading spend data…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [anomalyRes, lineRes] = await Promise.all([
        apiFetch(`${API}/anomalies`).catch(() => null),
        apiFetch(`${API}/budget-lines`).catch(() => null),
      ]);
      const anomalies = anomalyRes?.ok ? (await anomalyRes.json() as AnomalySignal[]) : [];
      const lines: BudgetLine[] = lineRes?.ok ? (await lineRes.json() as BudgetLine[]) : [];
      if (cancelled) return;

      // Pick the most significant anomaly, otherwise the largest budget line.
      let targetId: number | null = null;
      let sourceName = "";
      let multiplier: number | null = null;
      if (anomalies.length) {
        const top = [...anomalies].sort((a, b) => b.velocity_multiplier - a.velocity_multiplier)[0];
        targetId = top.budget_line_id;
        sourceName = top.budget_line_name;
        multiplier = top.velocity_multiplier;
      } else if (lines.length) {
        const top = [...lines].sort((a, b) => b.allocated_amount - a.allocated_amount)[0];
        targetId = top.id;
        sourceName = top.name;
      }

      if (!targetId) {
        if (!cancelled) {
          setTitle("Forecasted Burn Velocity");
          setNarrative("No budget lines with spend data yet — add spend entries to see a forecast.");
        }
        return;
      }

      const forecastRes = await apiFetch(`${API}/budget-lines/${targetId}/forecast?horizon=4`).catch(() => null);
      const forecast: ForecastResponse = forecastRes?.ok ? (await forecastRes.json() as ForecastResponse) : {};
      if (cancelled) return;
      const points = Array.isArray(forecast.points) ? forecast.points : [];
      setData(points.map((p) => ({
        name: p.period?.split("-").pop() ?? "Period",
        spend: p.amount,
        projected: p.projected !== false,
        anomaly: false,
      })));

      if (anomalies.length) {
        const latestActual = [...points].filter((p) => p.projected !== true).slice(-1)[0];
        const periodLabel = latestActual?.period ? ` (latest: ${latestActual.period})` : "";
        setTitle(`${sourceName} — Burn Velocity`);
        setNarrative(
          `${sourceName} shows a ${multiplier?.toFixed(1)}× spend velocity anomaly${periodLabel} — projected overrun unless reallocated.`,
        );
      } else {
        setTitle("Forecasted Burn Velocity");
        setNarrative(`${sourceName} spend trajectory projected across the next four periods. No significant velocity anomaly detected.`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-space-sm">
        <span className="font-headline-md text-headline-md text-on-surface">{title}</span>
        <span className="font-code-sm text-code-sm text-outline">Projected Periods</span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">{narrative}</p>
      <div className="w-full h-48 mt-4">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(195, 198, 215, 0.5)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#626570" }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "rgba(195, 198, 215, 0.2)" }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #c3c6d7", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", background: "#ffffff", color: "#0b1c30" }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any) => [formatMoney(Number(value), currency), "Spend"]) as any}
              />
              <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.anomaly ? "rgba(255, 183, 125, 1)" : entry.projected ? "rgba(37, 99, 235, 0.35)" : "rgba(220, 233, 255, 1)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-outline font-body-sm">No forecast data yet.</div>
        )}
      </div>
    </div>
  );
}
