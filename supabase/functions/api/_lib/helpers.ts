// Small shared HTTP/response helpers.
import { corsHeaders } from "./constants.ts";

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...headers },
  });
}

export function csvResponse(rows: Record<string, unknown>[], filename: string): Response {
  const lines: string[] = [];
  if (rows.length) {
    const keys = Object.keys(rows[0]);
    lines.push(keys.join(","));
    for (const row of rows) {
      lines.push(
        keys.map((k) => {
          const v = String(row[k] ?? "");
          return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(","),
      );
    }
  }
  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") return Number(v);
  return Number(v ?? 0);
};
export const money = (v: unknown): number => Math.round(num(v) * 100) / 100;

export function pageItems<T>(items: T[], page: number | null, pageSize: number | null): T[] | { items: T[]; page: number; page_size: number; total: number; pages: number } {
  if (page === null && pageSize === null) return items;
  const p = page ?? 1;
  const ps = pageSize ?? 50;
  if (p < 1 || ps < 1 || ps > 500) throw new HttpError(422, "page must be >= 1 and page_size must be between 1 and 500");
  const total = items.length;
  const start = (p - 1) * ps;
  return { items: items.slice(start, start + ps), page: p, page_size: ps, total, pages: total ? Math.ceil(total / ps) : 0 };
}
