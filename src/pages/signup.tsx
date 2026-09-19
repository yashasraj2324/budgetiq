"use client";
import { Link, useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";
import { trackEvent } from '@enter-pro/analytics-sdk';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const signUp = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const url = SUPABASE_URL;
    const anonKey = SUPABASE_PUBLISHABLE_KEY;
    setSubmitting(true);
    try {
      const response = await fetch(`${url}/auth/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({
          email,
          password,
          email_redirect_to: `${window.location.origin}/`,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error_description ?? body.msg ?? "Sign-up failed.");
        return;
      }
      trackEvent('signup_completed', { eventType: 'conversion' });
      if (body.access_token) {
        sessionStorage.setItem("budgetiq_access_token", body.access_token);
        sessionStorage.setItem("budgetiq_actor_name", email.split("@")[0]);
        navigate("/onboarding");
        return;
      }
      setInfo("Account created. A confirmation email may be required before you can sign in.");
    } catch {
      setError("Unable to reach the authentication service.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-space-lg bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(0,74,198,0.08),transparent),radial-gradient(1000px_500px_at_80%_90%,rgba(26,127,55,0.06),transparent)]">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-space-xl">

        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-space-xl">
          <div className="flex items-center gap-space-xs mb-space-sm">
            <span className="material-symbols-outlined text-outline text-[24px]">account_balance</span>
            <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">BudgetIQ</span>
            <span className="w-2 h-2 rounded-full bg-primary-container mt-1.5"></span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Create your account</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Set up your Ledger Workspace
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
            Detect · Calculate · Explain · Approve — AI explains, the engine decides, humans approve.
          </p>
        </div>

        {/* Signup Form */}
        <form className="space-y-space-lg" onSubmit={signUp}>
          <div className="space-y-1">
            <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
              placeholder="alex.rivera@company.com"
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
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
              placeholder="Repeat your password"
              minLength={8}
              required
            />
          </div>

          {error && <p className="text-sm text-error" role="alert">{error}</p>}
          {info && <p className="text-sm text-primary" role="status">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 bg-primary-container hover:bg-primary active:bg-on-primary-fixed-variant active:scale-[0.98] text-on-primary font-body-md text-body-md font-semibold rounded shadow-sm hover:shadow-md transition-all duration-150 flex items-center justify-center gap-space-xs mt-space-md cursor-pointer disabled:opacity-50"
          >
            <span>{submitting ? "Creating account…" : "Create Account"}</span>
            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
          </button>
        </form>

        {/* Footer */}
        <div className="mt-space-xl pt-space-md border-t border-outline-variant text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Already have an account?{" "}
            <Link to="/" className="text-primary font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
