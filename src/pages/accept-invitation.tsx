"use client";

import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API, apiError, apiFetch } from "@/lib/api";

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (): Promise<boolean> => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      setError("Enter Cloud authentication is not configured.");
      return false;
    }
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error_description ?? body.msg ?? "Sign-in failed.");
      return false;
    }
    const session = await response.json();
    sessionStorage.setItem("budgetiq_access_token", session.access_token);
    sessionStorage.setItem("budgetiq_actor_name", email.split("@")[0]);
    return true;
  };

  const accept = async (): Promise<void> => {
    if (!token) {
      setError("This invitation link is missing its token. Ask the sender to resend it.");
      return;
    }
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (!sessionStorage.getItem("budgetiq_access_token")) {
        const signedIn = await signIn();
        if (!signedIn) return;
      }
      const response = await apiFetch(`${API}/organization/invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        setError(await apiError(response, "Unable to accept the invitation"));
        return;
      }
      setInfo("Invitation accepted. Opening your workspace…");
      window.setTimeout(() => navigate("/dashboard"), 600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to accept the invitation");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void accept();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-space-lg">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-space-xl">
        <div className="flex flex-col items-center text-center mb-space-xl">
          <div className="flex items-center gap-space-xs mb-space-sm">
            <span className="material-symbols-outlined text-outline text-[24px]">account_balance</span>
            <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">BudgetIQ</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Accept invitation</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Sign in with the invited work email to join the workspace.
          </p>
        </div>

        <form className="space-y-space-lg" onSubmit={submit}>
          <div className="space-y-1">
            <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-error" role="alert">{error}</p>}
          {info && <p className="text-sm text-primary-container" role="status">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 bg-primary-container hover:bg-primary active:bg-on-primary-fixed-variant text-on-primary font-body-md text-body-md font-semibold rounded shadow-sm transition-colors duration-150 flex items-center justify-center gap-space-xs mt-space-md cursor-pointer disabled:opacity-50"
          >
            <span>{busy ? "Accepting…" : "Accept invitation"}</span>
            <span className="material-symbols-outlined text-[18px]">person_add</span>
          </button>
        </form>

        <div className="mt-space-xl pt-space-md border-t border-outline-variant text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No account yet?{" "}
            <Link to="/signup" className="text-primary font-semibold hover:underline">
              Create one first
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
