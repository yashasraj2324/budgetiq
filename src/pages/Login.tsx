import { Link, useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const signIn = (event: FormEvent) => {
    event.preventDefault();
    // Local development authentication; email and password are not sent.
    if (!email) {
      setError("Enter your work email to continue.");
      return;
    }
    sessionStorage.setItem("budgetiq_access_token", `dev_${Date.now()}`);
    if (email) sessionStorage.setItem("budgetiq_actor_name", email.split("@")[0]);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-space-lg">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-space-xl">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-space-xl">
          <div className="flex items-center gap-space-xs mb-space-sm">
            <span className="material-symbols-outlined text-outline text-[24px]">account_balance</span>
            <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">BudgetIQ</span>
            <span className="w-2 h-2 rounded-full bg-primary-container mt-1.5"></span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Sign in to your account</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Enterprise FP&amp;A Ledger Engine
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Local development authentication; email and password are not sent.
          </p>
        </div>

        {/* Login Form */}
        <form className="space-y-space-lg" onSubmit={signIn}>
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
            <div className="flex items-center justify-between">
              <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
                Password
              </label>
              <Link to="/reset-password" className="font-code-sm text-code-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex items-center gap-space-xs pt-space-xs">
            <input
              type="checkbox"
              id="remember"
              className="w-4 h-4 rounded border-outline-variant text-primary-container focus:ring-primary-container"
              onChange={(event) => {
                if (event.target.checked) {
                  localStorage.setItem("budgetiq_remember_session", "true");
                } else {
                  localStorage.removeItem("budgetiq_remember_session");
                }
              }}
            />
            <label htmlFor="remember" className="font-body-sm text-body-sm text-on-surface-variant cursor-pointer">
              Remember me for 30 days
            </label>
          </div>

          <button
            className="w-full h-10 bg-primary-container hover:bg-primary active:bg-on-primary-fixed-variant text-on-primary font-body-md text-body-md font-semibold rounded shadow-sm transition-colors duration-150 flex items-center justify-center gap-space-xs mt-space-md cursor-pointer"
            type="submit"
          >
            <span>Sign In</span>
            <span className="material-symbols-outlined text-[18px]">login</span>
          </button>
          {error && <p className="text-sm text-error" role="alert">{error}</p>}
        </form>

        {/* Footer */}
        <div className="mt-space-xl pt-space-md border-t border-outline-variant text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary font-semibold hover:underline">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
