/**
 * Browser and server-side API base URL.
 */
export const API = (
  import.meta.env.VITE_API_URL ?? "/api"
).replace(/\/+$/, "");

const authMode = (import.meta.env.VITE_AUTH_MODE ?? "dev").toLowerCase();

// Local-dev fallback (mirrors BUDGETIQ_DEV_AUTH_TOKEN); overridden by VITE_DEV_AUTH_TOKEN when set.
const DEV_FALLBACK_TOKEN = "dev-token-for-local";

export function accessToken(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem("budgetiq_access_token");
  if (stored) return stored;
  if (authMode === "dev") return import.meta.env.VITE_DEV_AUTH_TOKEN ?? DEV_FALLBACK_TOKEN;
  return null;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = accessToken();
  if (token) headers.set("Authorization", "Bearer " + token);
  headers.set("Accept", "application/json");
  if (!headers.has("X-Request-ID") && typeof crypto !== "undefined" && crypto.randomUUID) {
    headers.set("X-Request-ID", crypto.randomUUID());
  }
  let response: Response;
  try {
    response = await fetch(input, { ...init, headers });
  } catch {
    throw new Error("Unable to reach BudgetIQ API. Check that the backend is running.");
  }
  if (response.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.assign("/");
  }
  return response;
}

export async function apiError(response: Response, fallback = "Request failed"): Promise<string> {
  const body = await response.json().catch(() => null);
  if (typeof body?.detail === "string") return body.detail;
  if (typeof body?.error?.message === "string") return body.error.message;
  return fallback;
}
