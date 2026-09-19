/**
 * Shared formatting helpers that respect the workspace's configured currency
 * (INR / USD / EUR / GBP) instead of hardcoding ₹, plus a stable decision-id
 * that uses the record's actual year rather than a hardcoded 2025.
 */
import { useEffect, useState } from "react";
import { API, apiFetch } from "./api";

export function currencySymbol(currency: string): string {
  switch (String(currency).toUpperCase()) {
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    case "INR": return "₹";
    default: return `${currency} `; // unknown code shown as a prefix
  }
}

export function formatMoney(value: number, currency = "INR"): string {
  const symbol = currencySymbol(currency);
  return symbol + value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** Compact display: INR uses lakh notation; others use M/K. */
export function formatCompact(value: number, currency = "INR"): string {
  const symbol = currencySymbol(currency);
  const code = String(currency).toUpperCase();
  const abs = Math.abs(value);
  if (code === "INR") return `${symbol}${(value / 100000).toFixed(1)}L`;
  if (abs >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  return formatMoney(value, currency);
}

/** e.g. REC-2026-007 — derived from the record's real timestamp. */
export function decisionId(createdAt: string | number | null | undefined, id: number | null | undefined): string {
  let year: number;
  if (createdAt) {
    const d = new Date(createdAt);
    year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  } else {
    year = new Date().getFullYear();
  }
  return `REC-${year}-${String(id ?? 0).padStart(3, "0")}`;
}

/** Loads the workspace currency once and re-renders when it arrives. */
export function useOrgCurrency(): { currency: string } {
  const [currency, setCurrency] = useState("INR");
  useEffect(() => {
    let cancelled = false;
    apiFetch(`${API}/onboarding/config`)
      .then(async (response) => {
        if (!response.ok) return;
        const config = await response.json();
        if (!cancelled && typeof config.currency === "string" && config.currency) {
          setCurrency(config.currency);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return { currency };
}
