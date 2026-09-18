"use client";

import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenHash = searchParams.get("token_hash");
  const isRecovery = searchParams.get("type") === "recovery" || Boolean(tokenHash);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoverySession, setRecoverySession] = useState(false);

  // Recovery link (from the reset email): verify the token_hash and obtain a
  // session so the user can set a new password.
  useEffect(() => {
    if (!isRecovery) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey || !tokenHash) {
      setMessage("Enter Cloud password recovery is not configured.");
      return;
    }
    let cancelled = false;
    fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ type: "recovery", token_hash: tokenHash }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("This password reset link is invalid or has expired.");
        const body = await response.json();
        if (!cancelled && body.access_token) {
          sessionStorage.setItem("budgetiq_access_token", body.access_token);
          setRecoverySession(true);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) setMessage(error.message);
      });
    return () => { cancelled = true; };
  }, [isRecovery, tokenHash]);

  const requestReset = (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      setMessage("Enter Cloud password recovery is not configured.");
      setBusy(false);
      return;
    }
    fetch(`${url}/auth/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, redirect_to: `${window.location.origin}/reset-password` }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Password reset request failed.");
        setMessage("If the account exists, a password reset email has been sent.");
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setBusy(false));
  };

  const setNewPassword = (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const token = sessionStorage.getItem("budgetiq_access_token");
    if (!url || !anonKey || !token) {
      setMessage("Enter Cloud password recovery is not configured.");
      setBusy(false);
      return;
    }
    fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ new_password: password }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error_description ?? body.msg ?? "Unable to update the password.");
        }
        setMessage("Password updated. Redirecting to your workspace…");
        window.setTimeout(() => navigate("/dashboard"), 800);
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setBusy(false));
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-space-lg">
      <div className="w-full max-w-md space-y-space-lg bg-surface-container-lowest border border-outline-variant rounded-xl p-space-xl shadow-sm">
        <div>
          <h1 className="font-headline-md text-on-surface">
            {recoverySession ? "Set a new password" : "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {recoverySession
              ? "Choose a new password for your account."
              : "Enter your work email to request a reset."}
          </p>
        </div>

        {recoverySession ? (
          <form className="space-y-space-lg" onSubmit={setNewPassword}>
            <label className="block text-sm font-semibold text-on-surface">
              New password
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded"
                placeholder="At least 8 characters"
                required
              />
            </label>
            <label className="block text-sm font-semibold text-on-surface">
              Confirm new password
              <input
                type="password"
                minLength={8}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="mt-1 w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded"
                placeholder="Repeat the new password"
                required
              />
            </label>
            <button type="submit" disabled={busy} className="w-full h-10 bg-primary-container text-on-primary rounded font-semibold disabled:opacity-50">
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : (
          <form className="space-y-space-lg" onSubmit={requestReset}>
            <label className="block text-sm font-semibold text-on-surface">
              Work email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded"
                required
              />
            </label>
            <button type="submit" disabled={busy} className="w-full h-10 bg-primary-container text-on-primary rounded font-semibold disabled:opacity-50">
              {busy ? "Sending…" : "Request reset"}
            </button>
          </form>
        )}

        {message && <p role="status" className="text-sm text-on-surface-variant">{message}</p>}
        <Link to="/" className="block text-center text-sm text-primary hover:underline">Back to sign in</Link>
      </div>
    </main>
  );
}
