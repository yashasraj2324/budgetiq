import { Link, useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();

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
        </div>

        {/* Login Form */}
        <form className="space-y-space-lg" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-1">
            <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
              Work Email
            </label>
            <input
              type="email"
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
              <Link to="#" className="font-code-sm text-code-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
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
            />
            <label htmlFor="remember" className="font-body-sm text-body-sm text-on-surface-variant cursor-pointer">
              Remember me for 30 days
            </label>
          </div>

          <div
            className="w-full h-10 bg-primary-container hover:bg-primary active:bg-on-primary-fixed-variant text-on-primary font-body-md text-body-md font-semibold rounded shadow-sm transition-colors duration-150 flex items-center justify-center gap-space-xs mt-space-md cursor-pointer"
            onClick={() => {
              const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
              if (emailInput && emailInput.value) {
                // simple name extraction from email
                const nameParts = emailInput.value.split("@")[0].split(".");
                const name = nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
                localStorage.setItem("actor_name", name);
              }
              navigate("/onboarding");
            }}
          >
            <span>Sign In</span>
            <span className="material-symbols-outlined text-[18px]">login</span>
          </div>
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
