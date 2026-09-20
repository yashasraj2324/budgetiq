// Deterministic financial engine: anomaly detection, guardrail math, forecast.
import { num, money } from "./helpers.ts";

export function detectVelocityAnomaly(
  spend: number[],
  recentWindow = 2,
  threshold = 2.0,
  periodsInCycle = 12,
): { detected: boolean; velocity_multiplier: number; recent_rate: number; baseline_rate: number; period_remaining: number } {
  if (spend.length < recentWindow + 1) {
    return { detected: false, velocity_multiplier: 1, recent_rate: 0, baseline_rate: 0, period_remaining: 0 };
  }
  const recent = spend.slice(-recentWindow);
  const baseline = spend.slice(0, -recentWindow);
  const recentRate = recent.reduce((a, b) => a + b, 0) / recent.length;
  const baselineRate = baseline.length ? baseline.reduce((a, b) => a + b, 0) / baseline.length : recentRate;
  if (baselineRate === 0) {
    return { detected: false, velocity_multiplier: 1, recent_rate: recentRate, baseline_rate: 0, period_remaining: 0 };
  }
  const multiplier = recentRate / baselineRate;
  return {
    detected: multiplier >= threshold,
    velocity_multiplier: Math.round(multiplier * 100) / 100,
    recent_rate: recentRate,
    baseline_rate: baselineRate,
    period_remaining: Math.max(0, periodsInCycle - spend.length),
  };
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Structural (allocation-level) anomalies need no spend history — they are
// universal, deterministic checks that apply to any budget-lines CSV:
//  1. underfunded        remaining < committed future spend + reserve
//  2. allocation_outlier allocation > 6x the org median at low priority
//  3. token_allocation   a near-zero allocation (placeholder value)
//  4. priority_mismatch  median-level funding on a line with priority <= 30
export function structuralAnomalies(
  line: { allocated_amount: unknown; priority_weight: unknown; necessary_future_spend: unknown; safety_reserve: unknown },
  remaining: number,
  medianAllocation: number,
): { type: "underfunded" | "allocation_outlier" | "token_allocation" | "priority_mismatch"; deficit?: number }[] {
  const out: { type: "underfunded" | "allocation_outlier" | "token_allocation" | "priority_mismatch"; deficit?: number }[] = [];
  const allocated = num(line.allocated_amount);
  const priority = Number(line.priority_weight);
  const commitments = num(line.necessary_future_spend) + num(line.safety_reserve);
  if (remaining < commitments) {
    out.push({ type: "underfunded", deficit: money(commitments - remaining) });
  }
  if (medianAllocation > 0 && allocated > 6 * medianAllocation && priority < 60) {
    out.push({ type: "allocation_outlier" });
  }
  if (allocated > 0 && allocated < 100) {
    out.push({ type: "token_allocation" });
  }
  if (medianAllocation > 0 && priority <= 30 && allocated >= medianAllocation * 0.8) {
    out.push({ type: "priority_mismatch" });
  }
  return out;
}

export function calculateTransfer(
  remainingBudget: number,
  necessaryFutureSpend: number,
  safetyReserve: number,
  targetFundingGap: number,
  policyMaximum: number,
): { transfer: number; source_surplus: number; target_funding_gap: number; capped_by: string } {
  const sourceSurplus = remainingBudget - necessaryFutureSpend - safetyReserve;
  if (sourceSurplus <= 0) {
    return { transfer: 0, source_surplus: sourceSurplus, target_funding_gap: targetFundingGap, capped_by: "source_surplus" };
  }
  // A policy_maximum of 0 means "not configured" (the schema default), so it is
  // treated as uncapped — otherwise a fresh workspace could never generate.
  const limits: Record<string, number> = { source_surplus: sourceSurplus, target_funding_gap: targetFundingGap };
  if (policyMaximum > 0) limits.policy_maximum = policyMaximum;
  let cappedBy: string = "source_surplus";
  let min = Infinity;
  for (const [key, value] of Object.entries(limits)) {
    if (value < min) { min = value; cappedBy = key; }
  }
  return { transfer: Math.max(0, min), source_surplus: sourceSurplus, target_funding_gap: targetFundingGap, capped_by: cappedBy };
}

export function validateCustomAmount(amount: number, sourceSurplus: number, targetFundingGap: number, policyMaximum: number): string | null {
  if (amount > sourceSurplus) return `Exceeds source surplus (₹${sourceSurplus.toLocaleString("en-IN", { maximumFractionDigits: 0 })})`;
  if (amount > targetFundingGap) return `Exceeds target funding gap (₹${targetFundingGap.toLocaleString("en-IN", { maximumFractionDigits: 0 })})`;
  if (policyMaximum > 0 && amount > policyMaximum) return `Exceeds policy maximum (₹${policyMaximum.toLocaleString("en-IN", { maximumFractionDigits: 0 })})`;
  return null;
}

export function forecastSpend(
  entries: { period: string; amount_spent: number }[],
  horizon: number,
): { period: string; amount: number; projected: boolean; lower_bound?: number; upper_bound?: number }[] {
  horizon = Math.max(1, Math.min(Math.floor(horizon), 52));
  const actual = entries.map((e) => ({ period: String(e.period), amount: num(e.amount_spent), projected: false }));
  if (actual.length < 3) return actual;

  const values = actual.map((p) => p.amount);
  const n = values.length;
  const xbar = (n - 1) / 2;
  const ybar = values.reduce((a, b) => a + b, 0) / n;
  let denom = 0;
  let numer = 0;
  for (let i = 0; i < n; i++) {
    denom += (i - xbar) ** 2;
    numer += (i - xbar) * (values[i] - ybar);
  }
  const slope = denom ? numer / denom : 0;
  const intercept = ybar - slope * xbar;

  const residuals = values.map((v, i) => Math.abs(v - (intercept + slope * i)));
  const margin = (residuals.reduce((a, b) => a + b, 0) / n) * 1.96;

  const last = actual[n - 1].period;
  const m = last.match(/^(.*)-W(\d+)$/);
  const prefix = m ? m[1] : "";
  const start = m ? Number(m[2]) : n;

  const points: { period: string; amount: number; projected: boolean; lower_bound?: number; upper_bound?: number }[] = [...actual];
  for (let offset = 1; offset <= horizon; offset++) {
    const value = Math.max(0, intercept + slope * (n - 1 + offset));
    points.push({
      period: m ? `${prefix}-W${String(start + offset).padStart(2, "0")}` : `forecast-${offset}`,
      amount: Math.round(value * 100) / 100,
      projected: true,
      lower_bound: Math.round(Math.max(0, value - margin) * 100) / 100,
      upper_bound: Math.round((value + margin) * 100) / 100,
    });
  }
  return points;
}

// Backtest by withholding the last N actual points and projecting them
// (mirrors the Python forecast service). Returns null when data is insufficient.
export function backtestForecast(
  entries: { period: string; amount_spent: number }[],
  holdout: number,
): {
  algorithm: string; holdout_periods: number; n: number; mae: number; rmse: number;
  mape_percent: number | null; mape_unavailable_reason: string | null;
  actuals: number[]; predictions: number[]; review_status: string; generated_at: string;
} | null {
  holdout = Math.min(10, Math.max(1, holdout));
  if (entries.length < 3 + holdout) return null;
  const train = entries.slice(0, entries.length - holdout);
  const heldOut = entries.slice(entries.length - holdout);
  const projected = forecastSpend(train, holdout).filter((p) => p.projected);
  if (projected.length < holdout) return null;
  const actuals = heldOut.map((e) => num(e.amount_spent));
  const predictions = projected.slice(0, holdout).map((p) => p.amount);
  const n = actuals.length;
  const mae = actuals.reduce((sum, a, i) => sum + Math.abs(a - predictions[i]), 0) / n;
  const rmse = Math.sqrt(actuals.reduce((sum, a, i) => sum + (a - predictions[i]) ** 2, 0) / n);
  let mape: number | null = null;
  if (actuals.every((a) => a !== 0)) {
    mape = (100 * actuals.reduce((sum, a, i) => sum + Math.abs((a - predictions[i]) / a), 0)) / n;
  }
  return {
    algorithm: "linear_trend_v1",
    holdout_periods: holdout,
    n,
    mae: Math.round(mae * 10000) / 10000,
    rmse: Math.round(rmse * 10000) / 10000,
    mape_percent: mape === null ? null : Math.round(mape * 10000) / 10000,
    mape_unavailable_reason: mape === null ? "actuals_contain_zero" : null,
    actuals,
    predictions: predictions.map((p) => Math.round(p * 100) / 100),
    review_status: "pending",
    generated_at: new Date().toISOString(),
  };
}
