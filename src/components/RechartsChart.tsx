import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { API, apiFetch } from "../lib/api";

interface SpendEntry {
  name: string;
  spend: number;
  anomaly: boolean;
  projected: boolean;
}
interface ForecastPoint { period?: string; amount: number; projected?: boolean; }
interface ForecastResponse { points?: ForecastPoint[]; }

export function RechartsChart() {
  const [data, setData] = useState<SpendEntry[]>([]);

  useEffect(() => {
    apiFetch(`${API}/budget-lines/2/forecast?horizon=4`)
      .then((r) => r.json())
      .then((d: ForecastResponse) => {
        const points = Array.isArray(d?.points) ? d.points : [];
        setData(points.map((p) => ({
          name: p.period?.split("-").pop() ?? "Period",
          spend: p.amount,
          projected: p.projected !== false,
          anomaly: false,
        })));
      })
      .catch(() => setData([]));
  }, []);

  return (
    <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-space-sm">
        <span className="font-headline-md text-headline-md text-on-surface">Forecasted Burn Velocity</span>
        <span className="font-code-sm text-code-sm text-outline">P95 Confidence Window</span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
        Regional Events spend velocity shows a 2.8× anomalous spike in W09 — projected overrun unless reallocated.
      </p>
      <div className="w-full h-48 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
              formatter={((value: any) => ["₹" + Number(value).toLocaleString("en-IN"), "Spend"]) as any}
            />
            <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.anomaly ? "#ffb4ab" : entry.projected ? "#c3e7ff" : "#e0e2ec"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
